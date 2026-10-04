#!/usr/bin/env node
// Startup/support helper for the Docker stack.
//
//   npm run support -- doctor            diagnose Docker, ports, services, Redis, workers
//   npm run support -- logs              write one shareable log bundle (secrets redacted)
//   npm run support -- repair <name>     run a known fix (node-modules | workers | redis)
//
// Windows users can run the same through start.bat: `start.bat doctor`, …
// The decision logic lives in scripts/lib/support.mjs (unit-tested).
import { execFile, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_SERVICES,
  REPAIRS,
  STACK_PORTS,
  diagnose,
  formatReport,
  parseComposePs,
  redact,
} from './lib/support.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const DOCTOR_LOG_LINES = 200;
const BUNDLE_LOG_LINES = 300;

/** Run a command without a shell; never throws. */
function run(cmd, args, timeoutMs = 30_000) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { cwd: ROOT, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) })
    );
  });
}

/** A port is busy when something accepts a TCP connection on it. */
function portBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function fetchJson(url) {
  try {
    // /health answers 503 with a JSON body when degraded: read it either way.
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return await res.json();
  } catch {
    return null;
  }
}

async function serviceLogs(services, lines) {
  const entries = await Promise.all(
    services.map(async (s) => {
      const r = await run('docker', ['compose', 'logs', '--no-color', `--tail=${lines}`, s]);
      return [s, `${r.stdout}${r.stderr}`];
    })
  );
  return Object.fromEntries(entries);
}

async function gatherFacts(logLines = DOCTOR_LOG_LINES) {
  const dockerCli = (await run('docker', ['--version'])).ok;
  const dockerEngine =
    dockerCli && (await run('docker', ['info', '--format', '{{.ServerVersion}}'])).ok;
  const ports = await Promise.all(
    STACK_PORTS.map(async ({ port }) => ({ port, busy: await portBusy(port) }))
  );
  if (!dockerEngine) return { dockerCli, dockerEngine, services: [], ports, logs: {} };
  const ps = await run('docker', ['compose', 'ps', '--all', '--format', 'json']);
  let services = [];
  try {
    services = parseComposePs(ps.stdout);
  } catch {
    services = [];
  }
  const [health, queue, logs] = await Promise.all([
    fetchJson(`${API_BASE}/health`),
    fetchJson(`${API_BASE}/api/jobs/render-queue`),
    serviceLogs(EXPECTED_SERVICES, logLines),
  ]);
  return { dockerCli, dockerEngine, services, ports, health, queue, logs, rawPs: ps.stdout };
}

async function doctor() {
  console.log('Checking the Manim Motion stack…\n');
  const findings = diagnose(await gatherFacts());
  console.log(formatReport(findings));
  const failed = findings.some((f) => f.level === 'error');
  if (failed) console.log(`\nTo share the details: npm run support -- logs`);
  return failed ? 1 : 0;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

async function logs() {
  console.log('Collecting logs…');
  const facts = await gatherFacts(BUNDLE_LOG_LINES);
  const [git, dockerVersion] = await Promise.all([
    run('git', ['rev-parse', '--short', 'HEAD']),
    run('docker', ['version']),
  ]);
  const section = (title, body) => `\n===== ${title} =====\n${String(body ?? '').trimEnd()}\n`;
  const json = (v) => (v ? JSON.stringify(v, null, 2) : '(no answer)');
  const parts = [
    'Manim Motion support bundle',
    `created:  ${new Date().toISOString()}`,
    `commit:   ${git.ok ? git.stdout.trim() : 'unknown'}`,
    `node:     ${process.version}  platform: ${process.platform} ${process.arch}`,
    section('doctor', formatReport(diagnose(facts))),
    section('docker version', dockerVersion.stdout || dockerVersion.stderr),
    section('docker compose ps', facts.rawPs ?? '(docker engine not running)'),
    section('GET /health', json(facts.health)),
    section('GET /api/jobs/render-queue', json(facts.queue)),
    ...Object.entries(facts.logs).map(([s, text]) =>
      section(`logs: ${s} (last ${BUNDLE_LOG_LINES} lines)`, text || '(none)')
    ),
  ];
  const dir = path.join(ROOT, 'support-logs');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `manim-motion-support-${timestamp()}.txt`);
  writeFileSync(file, redact(parts.join('\n')), 'utf8');
  console.log(`\nWrote ${path.relative(ROOT, file)}`);
  console.log('Attach this file when you report a problem (secret-looking values are redacted).');
  return 0;
}

function runInherit(argv) {
  return new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function repair(name, yes) {
  const fix = REPAIRS[name];
  if (!fix) {
    console.log('Usage: npm run support -- repair <name> [--yes]\n');
    for (const [n, r] of Object.entries(REPAIRS)) console.log(`  ${n.padEnd(13)} ${r.describe}`);
    return 1;
  }
  console.log(`${fix.describe}\n`);
  for (const step of fix.steps) console.log(`  ${step.join(' ')}`);
  console.log('');
  if (fix.destructive && !yes && !(await confirm('Run these commands?'))) {
    console.log('Nothing changed. Re-run with --yes to skip this question.');
    return 1;
  }
  for (const step of fix.steps) {
    const isVolumeRm = step[1] === 'volume' && step[2] === 'rm';
    if (isVolumeRm) {
      // A missing volume is fine: there is simply nothing stale to remove.
      const r = await run(step[0], step.slice(1));
      if (!r.ok && !/no such volume/i.test(r.stderr)) {
        console.error(r.stderr.trim());
        return 1;
      }
      continue;
    }
    const code = await runInherit(step);
    if (code !== 0) {
      console.error(`\n"${step.join(' ')}" failed (exit ${code}).`);
      return code;
    }
  }
  console.log('\nDone. Checking the stack again:\n');
  return doctor();
}

const HELP = `Usage: npm run support -- <command>

  doctor            Diagnose Docker, ports, services, Redis and render workers
  logs              Write a shareable log bundle to support-logs/
  repair <name>     Run a known fix: ${Object.keys(REPAIRS).join(' | ')}  (add --yes to skip the prompt)
`;

async function main(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case 'doctor':
      return doctor();
    case 'logs':
      return logs();
    case 'repair':
      return repair(
        rest.find((a) => !a.startsWith('-')),
        rest.includes('--yes') || rest.includes('-y')
      );
    default:
      console.log(HELP);
      return command && command !== 'help' && command !== '--help' ? 1 : 0;
  }
}

process.exitCode = await main(process.argv.slice(2));
