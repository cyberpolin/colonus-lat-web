#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const env = (process.env.NODE_ENV || "").toLowerCase();
const isProduction = env === "production";

if (!isProduction) {
  run("pnpm", ["exec", "prisma", "db", "push", "--schema=schema.prisma"]);
}

run("pnpm", ["exec", "prisma", "generate", "--schema=schema.prisma"]);
run("pnpm", ["exec", "keystone", "start", "--config", "keystone.ts"]);
