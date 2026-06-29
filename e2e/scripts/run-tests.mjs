import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const e2eDir = path.resolve(__dirname, '..');
const webDir = path.resolve(__dirname, '../../services/web');
const viteBin = path.resolve(__dirname, '../../node_modules/vite/bin/vite.js');
const playwrightCli = path.resolve(e2eDir, 'node_modules/playwright/cli.js');
const preferredPort = Number.parseInt(process.env.E2E_WEB_PORT ?? '5188', 10);

async function isPortAvailable(port) {
  return await new Promise((resolve) => {
    const server = createServer();

    server.unref();
    server.once('error', () => resolve(false));
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close(() => resolve(true));
    });
  });
}

async function pickWebPort(startPort) {
  const initialPort = Number.isInteger(startPort) && startPort > 0 ? startPort : 5188;

  for (let port = initialPort; port < initialPort + 25; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`Unable to find a free Playwright web port starting at ${initialPort}.`);
}

async function waitForServerReady(url, child, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Vite exited before it was ready at ${url}.`);
    }

    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Timed out waiting for Vite to become ready at ${url}.`);
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill();

  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
}

const webPort = await pickWebPort(preferredPort);
const env = {
  ...process.env,
  E2E_WEB_PORT: String(webPort),
};
const server = spawn(
  process.execPath,
  [viteBin, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
  {
    cwd: webDir,
    env,
    stdio: 'inherit',
  }
);

await waitForServerReady(`http://127.0.0.1:${webPort}/`, server);

let exitCode = 0;
try {
  execFileSync(process.execPath, [playwrightCli, 'test', ...process.argv.slice(2)], {
    cwd: e2eDir,
    env,
    stdio: 'inherit',
  });
} catch (error) {
  exitCode = error?.status ?? 1;
} finally {
  await stopServer(server);
}

process.exit(exitCode);
