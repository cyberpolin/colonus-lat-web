#!/usr/bin/env node

import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const shouldReseed = args.includes("--reseed");
const repoRoot = process.cwd();
const apiDbPath = resolve(repoRoot, "apps/api/keystone.db");

if (shouldReseed && existsSync(apiDbPath)) {
  rmSync(apiDbPath);
  // Keep log explicit so it is clear the database will be re-seeded on API boot.
  console.log("[dev:all] Removed apps/api/keystone.db (reseed requested).");
}

const child = spawn(
  "pnpm",
  ["--parallel", "--filter", "@colonus/web", "--filter", "@colonus/api", "dev"],
  { stdio: "inherit", shell: true }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

