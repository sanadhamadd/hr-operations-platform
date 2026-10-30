import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    appUrl: string;
    supabaseUrl: string;
    publishableKey: string;
    secretKey: string;
    mailpitUrl: string;
    serverLogPath: string;
  }
}

type SupabaseStatus = {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
  MAILPIT_URL: string;
};

function readSupabaseStatus(): SupabaseStatus {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    env: { ...process.env, DO_NOT_TRACK: "1" },
    stdio: ["ignore", "pipe", "ignore"],
  });
  const status = JSON.parse(output) as Partial<SupabaseStatus>;
  if (!status.API_URL || !status.PUBLISHABLE_KEY || !status.SECRET_KEY || !status.MAILPIT_URL) {
    throw new Error("Start the local Supabase services first: npm run supabase:start");
  }
  return status as SupabaseStatus;
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // Not accepting connections yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`The application did not start at ${url}.`);
}

export default async function setup(project: TestProject) {
  if (!existsSync(join(process.cwd(), ".next", "BUILD_ID"))) {
    throw new Error("Create a production build first: npm run build");
  }

  const status = readSupabaseStatus();
  const port = process.env.INTEGRATION_APP_PORT ?? "3100";
  const appUrl = `http://127.0.0.1:${port}`;

  try {
    await fetch(appUrl);
    throw new Error(`Port ${port} is already in use. Set INTEGRATION_APP_PORT to a free port.`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Port")) throw error;
  }

  const serverLogPath = join(mkdtempSync(join(tmpdir(), "hr-auth-integration-")), "server.log");
  const log = openSync(serverLogPath, "a");

  // The secret key is deliberately present in the server environment, as it may be in a developer's
  // .env.local, so the tests can show that the application never exposes it.
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        SUPABASE_URL: status.API_URL,
        SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
        SUPABASE_SECRET_KEY: status.SECRET_KEY,
      },
      stdio: ["ignore", log, log],
    },
  );

  try {
    await waitForServer(`${appUrl}/login`, 60_000);
  } catch (error) {
    server.kill();
    throw error;
  }

  project.provide("appUrl", appUrl);
  project.provide("supabaseUrl", status.API_URL);
  project.provide("publishableKey", status.PUBLISHABLE_KEY);
  project.provide("secretKey", status.SECRET_KEY);
  project.provide("mailpitUrl", status.MAILPIT_URL);
  project.provide("serverLogPath", serverLogPath);

  return () => {
    server.kill();
  };
}
