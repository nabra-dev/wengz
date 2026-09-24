#!/usr/bin/env node
/**
 * Runs `prisma generate`, using `--no-engine` when DATABASE_URL is Prisma Accelerate.
 * That matches production (prisma+postgres / prisma://) and clears the build-time
 * "recommend using prisma generate --no-engine" warning without breaking local/direct Postgres.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const forBuild = process.argv.includes("--for-build");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const raw of readFileSync(filePath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Next production builds load .env.production over .env — mirror that for generate.
  if (forBuild || process.env.NODE_ENV === "production") {
    const fromProduction = parseEnvFile(resolve(root, ".env.production")).DATABASE_URL;
    if (fromProduction) return fromProduction;
  }

  return parseEnvFile(resolve(root, ".env")).DATABASE_URL ?? "";
}

function isAccelerateUrl(url) {
  return /^(prisma\+postgres|prisma):\/\//i.test(url);
}

const databaseUrl = resolveDatabaseUrl();
const useNoEngine = isAccelerateUrl(databaseUrl);
const args = ["generate", "--no-hints"];
if (useNoEngine) args.push("--no-engine");

console.log(
  `[prisma-generate] ${useNoEngine ? "Accelerate URL → prisma generate --no-engine" : "direct URL → prisma generate"}`
);

execSync(`npx prisma ${args.join(" ")}`, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
