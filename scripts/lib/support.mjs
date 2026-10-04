// Pure logic behind `npm run support -- doctor|logs|repair` (scripts/support.mjs).
// No I/O here: the CLI gathers "facts" (docker state, ports, API health, logs)
// and these functions turn them into findings with a concrete next action.

export const EXPECTED_SERVICES = ['redis', 'api', 'renderer', 'renderer-2', 'audio', 'web'];

// Ports the Docker stack publishes on the host (docker-compose.yml).
export const STACK_PORTS = [
  { port: 8758, what: 'the editor' },
  { port: 3000, what: 'the API' },
];

const SUPPORT = 'npm run support --';

// Each repair is a fixed list of argv arrays — never interpolated from input.
// None of them may remove the project data or redis volumes (tested).
export const REPAIRS = {
  'node-modules': {
    describe:
      'Rebuild the api dependencies: removes only the cached root_node_modules volume (fixes ERR_MODULE_NOT_FOUND after a dependency change). Projects, renders and assets are kept.',
    destructive: true,
    steps: [
      ['docker', 'compose', 'down'],
      ['docker', 'volume', 'rm', 'manim_motion_root_node_modules'],
      ['docker', 'compose', 'up', '-d', '--build'],
    ],
  },
  workers: {
    describe:
      'Rebuild and restart both render workers (fixes a crashed or stuck renderer, e.g. ModuleNotFoundError after an update).',
    destructive: false,
    steps: [
      ['docker', 'compose', 'up', '-d', '--build', '--force-recreate', 'renderer', 'renderer-2'],
    ],
  },
  redis: {
    describe: 'Start or restart Redis (the render/audio job queue). Queued jobs are kept.',
    destructive: false,
    steps: [
      ['docker', 'compose', 'up', '-d', 'redis'],
      ['docker', 'compose', 'restart', 'redis'],
    ],
  },
};

/**
 * Parse `docker compose ps --all --format json`: newline-delimited objects
 * (compose >= 2.21) or a single JSON array (older releases).
 * @param {string} text
 * @returns {{service:string,state:string,health:string,ports:number[]}[]}
 */
export function parseComposePs(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const rows = trimmed.startsWith('[')
    ? JSON.parse(trimmed)
    : trimmed
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l));
  return rows.map((r) => ({
    service: String(r.Service ?? ''),
    state: String(r.State ?? '').toLowerCase(),
    health: String(r.Health ?? '').toLowerCase(),
    ports: (Array.isArray(r.Publishers) ? r.Publishers : [])
      .map((p) => Number(p.PublishedPort))
      .filter((p) => p > 0),
  }));
}

// Log signatures of problems that have bitten this project before.
const KNOWN_ISSUES = [
  {
    services: ['api'],
    pattern: /ERR_MODULE_NOT_FOUND/,
    message: 'The api cannot find an npm package (stale root_node_modules volume).',
    fix: `${SUPPORT} repair node-modules`,
  },
  {
    services: ['api', 'web'],
    pattern: /failed to resolve "extends"|tsconfig\.base\.json/,
    message: 'The image was built without tsconfig.base.json.',
    fix: 'docker compose build --no-cache api web && docker compose up -d',
  },
  {
    services: ['renderer', 'renderer-2'],
    pattern: /ModuleNotFoundError|No module named 'pkg_resources'/,
    message: 'A render worker crashed at startup (its image is missing a module).',
    fix: `${SUPPORT} repair workers`,
  },
  {
    services: EXPECTED_SERVICES,
    pattern: /EADDRINUSE|port is already allocated/,
    message: 'A container could not bind its port.',
    fix: 'Stop the other program using the port (see the port checks), then run start.bat again.',
  },
];

/**
 * @param {Record<string,string>} logsByService
 * @returns {{service:string,message:string,fix:string}[]}
 */
export function detectKnownIssues(logsByService) {
  const found = [];
  for (const issue of KNOWN_ISSUES) {
    for (const service of issue.services) {
      const log = logsByService?.[service];
      if (log && issue.pattern.test(log)) {
        found.push({ service, message: `${service}: ${issue.message}`, fix: issue.fix });
        break; // one finding per issue, even if several services show it
      }
    }
  }
  return found;
}

const ok = (check, message) => ({ level: 'ok', check, message });
const warn = (check, message, fix) => ({ level: 'warn', check, message, fix });
const error = (check, message, fix) => ({ level: 'error', check, message, fix });

function portFindings(facts) {
  const published = new Set((facts.services || []).flatMap((s) => s.ports || []));
  return (facts.ports || []).map(({ port, busy }) => {
    const what = STACK_PORTS.find((p) => p.port === port)?.what ?? 'the stack';
    if (!busy) return ok('Ports', `Port ${port} is free for ${what}`);
    if (published.has(port)) return ok('Ports', `Port ${port} is served by the stack (${what})`);
    return error(
      'Ports',
      `Port ${port} (${what}) is used by another program`,
      `Stop the other program using port ${port}, then run start.bat again.`
    );
  });
}

function serviceFindings(services) {
  const byName = new Map(services.map((s) => [s.service, s]));
  return EXPECTED_SERVICES.map((name) => {
    const s = byName.get(name);
    if (!s || s.state !== 'running') {
      return error(
        'Services',
        `${name} is not running${s ? ` (${s.state})` : ''}`,
        `docker compose up -d ${name}   (then: docker compose logs ${name})`
      );
    }
    if (s.health === 'unhealthy') {
      return warn(
        'Services',
        `${name} is running but unhealthy`,
        `docker compose logs --tail=100 ${name}`
      );
    }
    return ok('Services', `${name} is running${s.health ? ` (${s.health})` : ''}`);
  });
}

function backendFindings(facts) {
  const out = [];
  const apiUp = (facts.services || []).some((s) => s.service === 'api' && s.state === 'running');
  if (!apiUp) return out;
  if (!facts.health) {
    out.push(
      error(
        'API',
        'The API is not answering on http://localhost:3000/health',
        'docker compose logs --tail=100 api'
      )
    );
    return out;
  }
  if (facts.health.redis !== 'ok') {
    out.push(
      error(
        'Redis',
        'The API cannot reach Redis (renders will fail with 503)',
        `${SUPPORT} repair redis`
      )
    );
  } else {
    out.push(ok('Redis', 'The API reaches Redis'));
  }
  const q = facts.queue;
  // Only trust real counts: the endpoint answers {error: …} when Redis is down.
  if (q && Number.isFinite(q.workersOnline)) {
    if (q.workersOnline === 0) {
      out.push(
        error(
          'Workers',
          'No render worker is online (renders will wait forever)',
          `${SUPPORT} repair workers`
        )
      );
    } else {
      out.push(
        ok('Workers', `${q.workersOnline} render worker(s) online, ${q.queueDepth} job(s) queued`)
      );
    }
    if (q.staleWorkers > 0) {
      out.push(
        warn(
          'Workers',
          `${q.staleWorkers} worker(s) look stale (busy without a recent heartbeat)`,
          `${SUPPORT} repair workers`
        )
      );
    }
  }
  return out;
}

/**
 * Turn gathered facts into ordered findings. Stops early when a missing
 * prerequisite makes the remaining checks meaningless.
 */
export function diagnose(facts) {
  if (!facts.dockerCli) {
    return [
      error(
        'Docker',
        'Docker is not installed (no `docker` on PATH)',
        'Install Docker Desktop for the full stack, or run start.bat for the editor-only mode (no server rendering).'
      ),
    ];
  }
  if (!facts.dockerEngine) {
    return [
      error(
        'Docker',
        'The Docker engine is not running',
        'Start Docker Desktop and wait until it reports "Engine running", then run start.bat again.'
      ),
    ];
  }
  const findings = [ok('Docker', 'Docker engine is running'), ...portFindings(facts)];
  const services = facts.services || [];
  if (services.filter((s) => s.state === 'running').length === 0) {
    findings.push(
      error(
        'Services',
        'The stack is not running',
        'Run start.bat (or: docker compose up -d --build)'
      )
    );
    return findings;
  }
  findings.push(...serviceFindings(services), ...backendFindings(facts));
  for (const issue of detectKnownIssues(facts.logs || {})) {
    findings.push(error('Logs', issue.message, issue.fix));
  }
  return findings;
}

const TAGS = { ok: 'OK  ', warn: 'WARN', error: 'FAIL' };

export function formatReport(findings) {
  const lines = findings.map((f) => {
    const head = `${TAGS[f.level]}  ${f.message}`;
    return f.fix && f.level !== 'ok' ? `${head}\n       → ${f.fix}` : head;
  });
  const problems = findings.filter((f) => f.level === 'error').length;
  const warnings = findings.filter((f) => f.level === 'warn').length;
  lines.push(
    '',
    problems || warnings
      ? `${problems} problem${problems === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}.`
      : 'Everything looks fine.'
  );
  return lines.join('\n');
}

// Hide values of secret-looking keys before logs are shared.
const SECRET_KEY =
  /\b([A-Za-z0-9_]*(?:password|passwd|secret|token|api[_-]?key)[A-Za-z0-9_]*)(\s*[:=]\s*)(\S+)/gi;

export function redact(text) {
  return String(text ?? '').replace(SECRET_KEY, (_m, key, sep) => `${key}${sep}***`);
}
