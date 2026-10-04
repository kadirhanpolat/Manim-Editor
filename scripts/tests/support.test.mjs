// Unit tests for the pure support-tool logic (run: node --test scripts/tests/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPECTED_SERVICES,
  REPAIRS,
  parseComposePs,
  detectKnownIssues,
  diagnose,
  formatReport,
  redact,
} from '../lib/support.mjs';

const running = (service, extra = {}) => ({
  service,
  state: 'running',
  health: '',
  ports: [],
  ...extra,
});

const healthyFacts = () => ({
  dockerCli: true,
  dockerEngine: true,
  services: [
    running('redis', { health: 'healthy' }),
    running('api', { health: 'healthy', ports: [3000] }),
    running('renderer', { health: 'healthy' }),
    running('renderer-2', { health: 'healthy' }),
    running('audio'),
    running('web', { ports: [8758] }),
  ],
  ports: [
    { port: 8758, busy: true },
    { port: 3000, busy: true },
  ],
  health: { status: 'ok', redis: 'ok' },
  queue: { queueDepth: 0, workersOnline: 2, busyWorkers: 0, staleWorkers: 0 },
  logs: {},
});

const errors = (findings) => findings.filter((f) => f.level === 'error');

// --- parseComposePs -------------------------------------------------------

test('parseComposePs reads newline-delimited JSON (compose >= 2.21)', () => {
  const text = [
    '{"Service":"api","State":"running","Health":"healthy","Publishers":[{"PublishedPort":3000},{"PublishedPort":0}]}',
    '{"Service":"redis","State":"running","Health":"healthy","Publishers":[]}',
  ].join('\n');
  assert.deepEqual(parseComposePs(text), [
    { service: 'api', state: 'running', health: 'healthy', ports: [3000] },
    { service: 'redis', state: 'running', health: 'healthy', ports: [] },
  ]);
});

test('parseComposePs reads a JSON array (older compose) and empty output', () => {
  const text = '[{"Service":"web","State":"exited","Health":"","Publishers":null}]';
  assert.deepEqual(parseComposePs(text), [
    { service: 'web', state: 'exited', health: '', ports: [] },
  ]);
  assert.deepEqual(parseComposePs(''), []);
  assert.deepEqual(parseComposePs('  \n'), []);
});

// --- diagnose -------------------------------------------------------------

test('a healthy stack has no errors or warnings', () => {
  const findings = diagnose(healthyFacts());
  assert.equal(findings.filter((f) => f.level !== 'ok').length, 0);
  assert.ok(findings.length >= EXPECTED_SERVICES.length);
});

test('no Docker CLI → install Docker or use editor-only mode', () => {
  const findings = diagnose({ ...healthyFacts(), dockerCli: false, dockerEngine: false });
  assert.equal(errors(findings).length, 1);
  assert.match(errors(findings)[0].fix, /Docker Desktop/);
  assert.match(errors(findings)[0].fix, /editor-only/);
});

test('CLI without engine → start Docker Desktop, nothing else is checked', () => {
  const findings = diagnose({ ...healthyFacts(), dockerEngine: false });
  assert.equal(errors(findings).length, 1);
  assert.match(errors(findings)[0].fix, /Start Docker Desktop/);
});

test('stack not running at all → one start instruction, not one per service', () => {
  const findings = diagnose({
    ...healthyFacts(),
    services: [],
    ports: [
      { port: 8758, busy: false },
      { port: 3000, busy: false },
    ],
    health: null,
    queue: null,
  });
  const errs = errors(findings);
  assert.equal(errs.length, 1);
  assert.match(errs[0].fix, /start\.bat|docker compose up/);
});

test('a stopped service gets its own restart command', () => {
  const facts = healthyFacts();
  facts.services = facts.services.map((s) =>
    s.service === 'renderer-2' ? { ...s, state: 'exited', health: '' } : s
  );
  const errs = errors(diagnose(facts));
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /renderer-2/);
  assert.match(errs[0].fix, /docker compose up -d renderer-2/);
});

test('an unhealthy service is a warning pointing at its logs', () => {
  const facts = healthyFacts();
  facts.services = facts.services.map((s) =>
    s.service === 'api' ? { ...s, health: 'unhealthy' } : s
  );
  const warn = diagnose(facts).find((f) => f.level === 'warn' && /api/.test(f.message));
  assert.ok(warn);
  assert.match(warn.fix, /docker compose logs/);
});

test('Redis down behind a running api → restart Redis', () => {
  const facts = { ...healthyFacts(), health: { status: 'degraded', redis: 'error' } };
  const err = errors(diagnose(facts)).find((f) => /Redis/i.test(f.message));
  assert.ok(err);
  assert.match(err.fix, /repair redis/);
});

test('no render worker online → repair workers', () => {
  const facts = healthyFacts();
  facts.queue = { ...facts.queue, workersOnline: 0 };
  const err = errors(diagnose(facts)).find((f) => /worker/i.test(f.message));
  assert.ok(err);
  assert.match(err.fix, /repair workers/);
});

test('an error body from the queue endpoint is not read as worker counts', () => {
  // With Redis down the endpoint answers {error: …}: say nothing about workers.
  const facts = { ...healthyFacts(), health: { status: 'degraded', redis: 'error' } };
  facts.queue = { error: 'Redis unavailable' };
  const findings = diagnose(facts);
  assert.ok(!findings.some((f) => /undefined/.test(f.message)));
  assert.ok(!findings.some((f) => f.check === 'Workers'));
});

test('stale workers are a warning', () => {
  const facts = healthyFacts();
  facts.queue = { ...facts.queue, staleWorkers: 1 };
  assert.ok(diagnose(facts).some((f) => f.level === 'warn' && /stale/i.test(f.message)));
});

test('a port held by another program (stack not publishing it) is an error', () => {
  const facts = { ...healthyFacts(), services: [], health: null, queue: null };
  facts.ports = [{ port: 8758, busy: true }];
  const err = errors(diagnose(facts)).find((f) => /8758/.test(f.message));
  assert.ok(err);
  assert.match(err.fix, /another program|stop/i);
});

test('a port published by the stack itself is fine', () => {
  const findings = diagnose(healthyFacts());
  assert.ok(!findings.some((f) => f.level !== 'ok' && /port/i.test(f.message)));
});

// --- detectKnownIssues ----------------------------------------------------

test('detects the stale node_modules volume from api logs', () => {
  const issues = detectKnownIssues({
    api: "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'zod' imported from /app/…",
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].fix, /repair node-modules/);
});

test('detects a renderer image missing a module or pkg_resources', () => {
  const a = detectKnownIssues({ renderer: "ModuleNotFoundError: No module named 'safety'" });
  const b = detectKnownIssues({ 'renderer-2': "No module named 'pkg_resources'" });
  for (const issues of [a, b]) {
    assert.equal(issues.length, 1);
    assert.match(issues[0].fix, /repair workers/);
  }
});

test('detects a missing tsconfig.base.json in the api image', () => {
  const issues = detectKnownIssues({
    api: 'failed to resolve "extends":"../../tsconfig.base.json"',
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].fix, /--no-cache api/);
});

test('known issues found in logs become errors in the diagnosis', () => {
  const facts = { ...healthyFacts(), logs: { api: 'ERR_MODULE_NOT_FOUND' } };
  assert.ok(errors(diagnose(facts)).some((f) => /repair node-modules/.test(f.fix)));
});

test('clean logs report nothing', () => {
  assert.deepEqual(
    detectKnownIssues({ api: 'listening on 3000', renderer: 'Waiting for jobs' }),
    []
  );
});

// --- repairs never touch user data ----------------------------------------

test('repairs never remove the data or redis volumes', () => {
  for (const [name, repair] of Object.entries(REPAIRS)) {
    for (const step of repair.steps) {
      const cmd = step.join(' ');
      assert.doesNotMatch(cmd, /_data\b/, `${name}: ${cmd}`);
      assert.ok(
        !(step.includes('down') && (step.includes('-v') || step.includes('--volumes'))),
        cmd
      );
    }
  }
});

test('the node-modules repair removes exactly the root_node_modules volume', () => {
  const rm = REPAIRS['node-modules'].steps.filter((s) => s.includes('rm'));
  assert.deepEqual(rm, [['docker', 'volume', 'rm', 'manim_motion_root_node_modules']]);
  assert.equal(REPAIRS['node-modules'].destructive, true);
});

// --- report + redaction ----------------------------------------------------

test('formatReport marks each finding and lists fixes', () => {
  const text = formatReport([
    { level: 'ok', check: 'Docker', message: 'Docker engine is running' },
    {
      level: 'error',
      check: 'Workers',
      message: 'No render worker online',
      fix: 'npm run support -- repair workers',
    },
  ]);
  assert.match(text, /OK\s+Docker engine is running/);
  assert.match(text, /FAIL\s+No render worker online/);
  assert.match(text, /→ npm run support -- repair workers/);
  assert.match(text, /1 problem/);
});

test('redact hides secret-looking values', () => {
  const out = redact('REDIS_URL=redis://redis:6379\nAPI_KEY=abc123\npassword: hunter2\ntoken=xyz');
  assert.match(out, /REDIS_URL=redis:\/\/redis:6379/);
  assert.doesNotMatch(out, /abc123|hunter2|xyz/);
});
