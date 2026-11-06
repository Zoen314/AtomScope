import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const LOCAL_VIEWER_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_VIEWER_PORT = 43117;

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, "..");
const SERVER_ENTRY = resolve(PROJECT_ROOT, "dist", "server", "index.js");
const VINEXT_CLI = resolve(PROJECT_ROOT, "node_modules", "vinext", "dist", "cli.js");
export const VIEWER_TITLE = "AtomScope";

export function parseViewerPort(value?: string): number {
  const port = value === undefined ? DEFAULT_LOCAL_VIEWER_PORT : Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("ATOM_VIEWER_PORT must be an integer from 1024 to 65535");
  }
  return port;
}

export function getLocalViewerBaseUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  return `http://${LOCAL_VIEWER_HOST}:${parseViewerPort(env.ATOM_VIEWER_PORT)}/`;
}

async function isViewerHealthy(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_500) });
    if (!response.ok) return false;
    return (await response.text()).includes(VIEWER_TITLE);
  } catch {
    return false;
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

export async function ensureLocalViewer(
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  const baseUrl = getLocalViewerBaseUrl(env);
  if (await isViewerHealthy(baseUrl)) return baseUrl;

  try {
    await access(SERVER_ENTRY);
    await access(VINEXT_CLI);
  } catch {
    throw new Error("Local viewer build is missing. Run npm run build first.");
  }

  const port = parseViewerPort(env.ATOM_VIEWER_PORT);
  const child = spawn(
    process.execPath,
    [VINEXT_CLI, "start", "--hostname", LOCAL_VIEWER_HOST, "--port", String(port)],
    {
      cwd: PROJECT_ROOT,
      detached: true,
      env: { ...process.env, ...env, PORT: String(port) },
      stdio: "ignore",
      windowsHide: true,
    },
  );
  child.unref();

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (await isViewerHealthy(baseUrl)) return baseUrl;
    await wait(250);
  }
  throw new Error(
    `Local viewer did not start at ${baseUrl}. The port may already be in use.`,
  );
}

export async function resolveViewerBaseUrl(
  explicitBaseUrl: string | undefined,
  env: Record<string, string | undefined> = process.env,
  startLocalViewer: (
    startEnv?: Record<string, string | undefined>,
  ) => Promise<string> = ensureLocalViewer,
): Promise<string> {
  const override =
    explicitBaseUrl || env.VIEWER_BASE_URL || env.MAKE_VIEW_BASE_URL;
  if (override) return override;
  return startLocalViewer(env);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  ensureLocalViewer()
    .then((baseUrl) => console.log(baseUrl))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
