import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react(), tsconfigPaths()],
        resolve: {
          alias: {
            "server-only": path.resolve(__dirname, "./test/stubs/server-only.ts"),
          },
        },
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "test/**/*.test.ts", "scripts/**/*.test.ts"],
          exclude: ["**/*.test.tsx"],
          setupFiles: ["./test/setup.node.ts"],
        },
      },
      {
        plugins: [react(), tsconfigPaths()],
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/setup.jsdom.ts"],
        },
      },
    ],
  },
});
