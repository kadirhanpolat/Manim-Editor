const WEB_BASE = process.env.WEB_BASE ?? 'http://localhost:8758';
const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.FULL_STACK_SMOKE_TIMEOUT_MS ?? 180_000);
const POLL_MS = Number(process.env.FULL_STACK_SMOKE_POLL_MS ?? 2_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  return { res, text };
}

async function fetchJson(url, init) {
  const { res, text } = await fetchText(url, init);
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Expected JSON from ${url}, got: ${text.slice(0, 200)}`);
  }
  return { res, json };
}

async function waitFor(predicate, label) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < TIMEOUT_MS) {
    try {
      const value = await predicate();
      if (value) return value;
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    await sleep(POLL_MS);
  }
  throw new Error(`${label} timed out${lastError ? `: ${lastError.message}` : ''}`);
}

async function main() {
  console.log(`[smoke] web: ${WEB_BASE}`);
  console.log(`[smoke] api: ${API_BASE}`);

  await waitFor(async () => {
    const { res, text } = await fetchText(WEB_BASE);
    if (!res.ok) return null;
    if (!text.includes('id="app"')) return null;
    return true;
  }, 'web root');

  await waitFor(async () => {
    const { res, json } = await fetchJson(`${API_BASE}/health`);
    return res.ok && json?.status === 'ok';
  }, 'api health');

  const { res: createRes, json: project } = await fetchJson(`${API_BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CI Smoke', editorMode: 'visual' }),
  });
  if (createRes.status !== 201 || !project?.id) {
    throw new Error(`Project creation failed: ${createRes.status}`);
  }
  console.log(`[smoke] project: ${project.id}`);

  const { res: renderRes, json: renderStart } = await fetchJson(
    `${API_BASE}/api/projects/${project.id}/render`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'png', resolution: '854x480', fps: 15 }),
    }
  );
  if (renderRes.status !== 202 || !renderStart?.jobId) {
    throw new Error(`Render request was not accepted: ${renderRes.status}`);
  }
  console.log(`[smoke] job: ${renderStart.jobId}`);

  const terminalJob = await waitFor(async () => {
    const { res, json } = await fetchJson(`${API_BASE}/api/jobs/${renderStart.jobId}`);
    if (!res.ok) return null;
    const status = json?.status;
    if (status === 'queued' || status === 'running' || status === 'canceling') return null;
    return json;
  }, 'render job completion');

  if (terminalJob.status !== 'completed') {
    throw new Error(
      `Render job finished with ${terminalJob.status}: ${(terminalJob.error || terminalJob.stderr || '').toString()}`
    );
  }

  const latestUrl = `${API_BASE}/api/renders/${project.id}/latest.zip`;
  const { res: latestRes } = await fetchText(latestUrl);
  if (!latestRes.ok) {
    throw new Error(`Latest render asset not reachable: ${latestRes.status}`);
  }

  console.log('[smoke] stack render completed successfully');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});
