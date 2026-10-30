import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = join(process.cwd(), "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const applicationFiles = sourceFiles(sourceRoot)
  .map((path) => relative(process.cwd(), path))
  .filter((path) => path !== join("src", "lib", "auth", "provisioning.ts"));

describe("privileged credential isolation", () => {
  it("finds the application source files", () => {
    expect(applicationFiles.length).toBeGreaterThan(20);
  });

  it.each(applicationFiles)("%s does not read the secret key or import provisioning", (path) => {
    const source = readFileSync(path, "utf8");

    expect(source).not.toContain("SUPABASE_SECRET_KEY");
    expect(source).not.toContain("SERVICE_ROLE");
    expect(source).not.toMatch(/from ["'][^"']*provisioning["']/);
  });

  it("exposes no Supabase settings to browser code through NEXT_PUBLIC variables", () => {
    for (const path of applicationFiles) {
      expect(readFileSync(path, "utf8")).not.toContain("NEXT_PUBLIC_");
    }
  });
});
