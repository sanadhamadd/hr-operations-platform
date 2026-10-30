import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Runs against the local Supabase services (`npm run supabase:start`) and a production build
// (`npm run build`), which the global setup serves with `next start`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 90_000,
  },
});
