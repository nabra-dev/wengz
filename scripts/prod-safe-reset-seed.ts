/**
 * Production-safe DB reset + seed that preserves PENDING users.
 *
 * Gates (all required):
 *   CONFIRM_PROD_RESET=RESET
 *   KEEP_PENDING_MODE=1
 *   NODE_ENV=production
 *
 * Flow: maintenance on → export PENDING → pg_dump → stop app → generate
 * passwords → force-reset → seed → restore PENDING → verify → redis flush →
 * start app → maintenance off.
 *
 * On verify failure: restore dump, start app, leave maintenance ON, exit 1.
 *
 * Usage (on VPS):
 *   CONFIRM_PROD_RESET=RESET KEEP_PENDING_MODE=1 npm run db:safe-reset
 */

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type PayoutMethod, type Role } from "@prisma/client";

const APP_DIR = process.env.APP_DIR || process.cwd();
const BACKUP_ROOT = process.env.NABRA_BACKUP_ROOT || "/var/backups/nabra";
const PM2_APP = process.env.PM2_APP_NAME || "nabra-ai-system";
const MIN_DUMP_BYTES = Number(process.env.MIN_DUMP_BYTES || 1024);

const SEED_APPROVED_EMAILS = [
  "nabraagency20@gmail.com",
  "pm@wengz.tech",
  "finance@wengz.tech",
  "client@wengz.tech",
  "provider@wengz.tech",
] as const;

const EXPECTED_SERVICE_COUNT = 9;
const EXPECTED_PACKAGE_COUNT = 5;

type PendingExport = {
  exportedAt: string;
  count: number;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    emailVerified: Date | null;
    password: string | null;
    passwordChangedAt: Date | null;
    image: string | null;
    phone: string | null;
    role: Role;
    approvalStatus: string;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
    registrationIp: string | null;
    preferredLocale: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    providerProfile: {
      id: string;
      bio: string | null;
      portfolio: string | null;
      cvUrl: string | null;
      skillsTags: string[];
      isActive: boolean;
      payoutMethod: PayoutMethod | null;
      accountHolder: string | null;
      bankName: string | null;
      bankAccount: string | null;
      eWalletNumber: string | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }>;
};

function log(msg: string) {
  console.log(`[safe-reset] ${msg}`);
}

function fail(msg: string): never {
  console.error(`[safe-reset] ERROR: ${msg}`);
  process.exit(1);
}

function requireGates() {
  if (process.env.NODE_ENV !== "production") {
    fail("NODE_ENV must be production");
  }
  if (process.env.CONFIRM_PROD_RESET !== "RESET") {
    fail("CONFIRM_PROD_RESET must be exactly RESET");
  }
  if (process.env.KEEP_PENDING_MODE !== "1") {
    fail("KEEP_PENDING_MODE must be 1 (PENDING-preserving reset only)");
  }
  if (!existsSync(join(APP_DIR, ".env"))) {
    fail(`missing ${join(APP_DIR, ".env")}`);
  }
}

function run(
  command: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv; cwd?: string; input?: string | Buffer }
) {
  const result = spawnSync(command, args, {
    cwd: opts?.cwd ?? APP_DIR,
    env: opts?.env ?? process.env,
    input: opts?.input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    fail(
      `${command} ${args.join(" ")} failed (exit ${result.status}): ${stderr || stdout || "no output"}`
    );
  }
  return result.stdout || "";
}

function parseDatabaseUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    fail(`unsupported DATABASE_URL protocol: ${url.protocol}`);
  }
  return {
    host: url.hostname || "127.0.0.1",
    port: url.port || "5432",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "").split("?")[0],
  };
}

function generatePassword(bytes = 24): string {
  // Env-safe alphabet (no quotes / spaces / $ that break naive .env edits)
  return randomBytes(bytes).toString("base64url");
}

function upsertEnvFile(envPath: string, updates: Record<string, string>) {
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (!content.endsWith("\n") && content.length > 0) content += "\n";

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}="${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += `${line}\n`;
    }
  }
  writeFileSync(envPath, content, { mode: 0o600 });
}

async function setMaintenance(prisma: PrismaClient, enabled: boolean) {
  await prisma.systemSettings.upsert({
    where: { key: "maintenance_mode" },
    create: {
      key: "maintenance_mode",
      value: { enabled },
      description: "When enabled, only SUPER_ADMIN users can log in.",
    },
    update: {
      value: { enabled },
    },
  });
  log(`maintenance_mode=${enabled}`);
}

async function exportPending(prisma: PrismaClient, outPath: string): Promise<PendingExport> {
  const users = await prisma.user.findMany({
    where: { approvalStatus: "PENDING", deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { providerProfile: true },
  });

  const payload: PendingExport = {
    exportedAt: new Date().toISOString(),
    count: users.length,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      password: u.password,
      passwordChangedAt: u.passwordChangedAt,
      image: u.image,
      phone: u.phone,
      role: u.role,
      approvalStatus: u.approvalStatus,
      approvedAt: u.approvedAt,
      rejectedAt: u.rejectedAt,
      rejectionReason: u.rejectionReason,
      registrationIp: u.registrationIp,
      preferredLocale: u.preferredLocale,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      deletedAt: u.deletedAt,
      providerProfile: u.providerProfile
        ? {
            id: u.providerProfile.id,
            bio: u.providerProfile.bio,
            portfolio: u.providerProfile.portfolio,
            cvUrl: u.providerProfile.cvUrl,
            skillsTags: u.providerProfile.skillsTags,
            isActive: u.providerProfile.isActive,
            payoutMethod: u.providerProfile.payoutMethod,
            accountHolder: u.providerProfile.accountHolder,
            bankName: u.providerProfile.bankName,
            bankAccount: u.providerProfile.bankAccount,
            eWalletNumber: u.providerProfile.eWalletNumber,
            createdAt: u.providerProfile.createdAt,
            updatedAt: u.providerProfile.updatedAt,
          }
        : null,
    })),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  if (payload.count > 0 && statSync(outPath).size < 10) {
    fail("PENDING export file unexpectedly tiny");
  }
  log(`exported ${payload.count} PENDING user(s) → ${outPath}`);
  return payload;
}

async function restorePending(prisma: PrismaClient, payload: PendingExport) {
  log(`restoring ${payload.count} PENDING user(s)…`);
  for (const u of payload.users) {
    if ((SEED_APPROVED_EMAILS as readonly string[]).includes(u.email)) {
      fail(`PENDING export collides with seed email ${u.email}`);
    }
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        password: u.password,
        passwordChangedAt: u.passwordChangedAt,
        image: u.image,
        phone: u.phone,
        role: u.role,
        approvalStatus: "PENDING",
        approvedAt: null,
        rejectedAt: null,
        rejectionReason: null,
        registrationIp: u.registrationIp,
        preferredLocale: u.preferredLocale,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt,
      },
    });

    if (u.providerProfile) {
      const p = u.providerProfile;
      await prisma.providerProfile.create({
        data: {
          id: p.id,
          userId: u.id,
          bio: p.bio,
          portfolio: p.portfolio,
          cvUrl: p.cvUrl,
          skillsTags: p.skillsTags,
          isActive: p.isActive,
          payoutMethod: p.payoutMethod,
          accountHolder: p.accountHolder,
          bankName: p.bankName,
          bankAccount: p.bankAccount,
          eWalletNumber: p.eWalletNumber,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      });
    }
  }
  log("PENDING restore complete");
}

async function verify(prisma: PrismaClient, expectedPending: number) {
  const pending = await prisma.user.count({
    where: { approvalStatus: "PENDING", deletedAt: null },
  });
  const rejected = await prisma.user.count({ where: { approvalStatus: "REJECTED" } });
  const approvedEmails = (
    await prisma.user.findMany({
      where: { approvalStatus: "APPROVED", deletedAt: null },
      select: { email: true },
    })
  )
    .map((u) => u.email)
    .sort();

  const services = await prisma.serviceType.count();
  const packages = await prisma.package.count();
  const standard = await prisma.package.findFirst({
    where: { name: "Standard Package - 10.000 Credits" },
  });
  const premium = await prisma.package.findFirst({
    where: { name: "Premium Package - 20.000 Credits" },
  });

  const errors: string[] = [];
  if (pending !== expectedPending) {
    errors.push(`PENDING count ${pending} !== exported ${expectedPending}`);
  }
  if (rejected !== 0) errors.push(`REJECTED count ${rejected} !== 0`);

  const expectedApproved = [...SEED_APPROVED_EMAILS].sort();
  if (JSON.stringify(approvedEmails) !== JSON.stringify(expectedApproved)) {
    errors.push(
      `APPROVED emails ${JSON.stringify(approvedEmails)} !== ${JSON.stringify(expectedApproved)}`
    );
  }
  if (services !== EXPECTED_SERVICE_COUNT) {
    errors.push(`ServiceType count ${services} !== ${EXPECTED_SERVICE_COUNT}`);
  }
  if (packages !== EXPECTED_PACKAGE_COUNT) {
    errors.push(`Package count ${packages} !== ${EXPECTED_PACKAGE_COUNT}`);
  }
  if (!standard || standard.credits !== 11000) {
    errors.push(`Standard package credits expected 11000, got ${standard?.credits}`);
  }
  if (!premium || premium.credits !== 23000 || !premium.isFeatured) {
    errors.push(
      `Premium expected 23000 credits + featured, got credits=${premium?.credits} featured=${premium?.isFeatured}`
    );
  }

  if (errors.length) {
    throw new Error(`verify failed:\n  - ${errors.join("\n  - ")}`);
  }
  log(
    `verify OK (pending=${pending}, approved=${approvedEmails.length}, services=${services}, packages=${packages})`
  );
}

function pgDump(db: ReturnType<typeof parseDatabaseUrl>, dumpPath: string) {
  log(`pg_dump → ${dumpPath}`);
  const env = { ...process.env, PGPASSWORD: db.password };
  const sql = run(
    "pg_dump",
    [
      "-h",
      db.host,
      "-p",
      db.port,
      "-U",
      db.user,
      "-d",
      db.database,
      "--no-owner",
      "--no-acl",
      "--clean",
      "--if-exists",
    ],
    { env }
  );
  const gz = spawnSync("gzip", ["-c"], {
    input: sql,
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (gz.status !== 0) {
    fail(`gzip failed: ${gz.stderr?.toString() || "unknown"}`);
  }
  writeFileSync(dumpPath, gz.stdout as Buffer, { mode: 0o600 });
  const size = statSync(dumpPath).size;
  if (size < MIN_DUMP_BYTES) {
    fail(`dump too small (${size} bytes < ${MIN_DUMP_BYTES})`);
  }
  const sha = createHash("sha256")
    .update(gz.stdout as Buffer)
    .digest("hex");
  writeFileSync(`${dumpPath}.sha256`, `${sha}  ${dumpPath}\n`, { mode: 0o600 });
  log(`dump ok (${size} bytes, sha256=${sha.slice(0, 12)}…)`);
}

function pgRestoreFromGzip(db: ReturnType<typeof parseDatabaseUrl>, dumpPath: string) {
  log(`ROLLBACK: restoring ${dumpPath}`);
  const gunzip = spawnSync("gunzip", ["-c", dumpPath], {
    encoding: "buffer",
    maxBuffer: 512 * 1024 * 1024,
  });
  if (gunzip.status !== 0) {
    fail(`gunzip failed during rollback: ${gunzip.stderr?.toString() || "unknown"}`);
  }
  const env = { ...process.env, PGPASSWORD: db.password };
  const psql = spawnSync(
    "psql",
    ["-h", db.host, "-p", db.port, "-U", db.user, "-d", db.database, "-v", "ON_ERROR_STOP=1"],
    {
      input: gunzip.stdout as Buffer,
      env,
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    }
  );
  if (psql.status !== 0) {
    fail(`psql restore failed: ${psql.stderr || psql.stdout || "unknown"}`);
  }
  log("ROLLBACK: dump restored");
}

function pm2Stop() {
  log(`pm2 stop ${PM2_APP}`);
  const result = spawnSync("pm2", ["stop", PM2_APP], {
    cwd: APP_DIR,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    log("pm2 stop failed or app not running — continuing");
  }
}

function pm2Start() {
  log(`pm2 start ${PM2_APP} --update-env`);
  const started = spawnSync("pm2", ["start", PM2_APP, "--update-env"], {
    cwd: APP_DIR,
    encoding: "utf8",
  });
  if (started.status !== 0) {
    log("pm2 start failed; trying pm2 restart…");
    run("pm2", ["restart", PM2_APP, "--update-env"]);
  }
}

function flushRedis() {
  if (spawnSync("bash", ["-lc", "command -v redis-cli"], { encoding: "utf8" }).status === 0) {
    log("redis-cli FLUSHDB");
    spawnSync("redis-cli", ["FLUSHDB"], { encoding: "utf8" });
  } else {
    log("redis-cli not found — skip FLUSHDB");
  }
}

async function main() {
  requireGates();
  process.chdir(APP_DIR);

  const databaseUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!databaseUrl) fail("DATABASE_URL (or DIRECT_URL) is required");
  const db = parseDatabaseUrl(databaseUrl);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(BACKUP_ROOT, ts);
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  chmodSync(backupDir, 0o700);

  const dumpPath = join(backupDir, "full.sql.gz");
  const pendingPath = join(backupDir, "pending-users.json");
  const credsPath = join(backupDir, "credentials.txt");

  log(`backup dir: ${backupDir}`);

  let prisma = new PrismaClient();
  let pendingPayload: PendingExport | null = null;
  let wiped = false;

  try {
    await setMaintenance(prisma, true);

    pendingPayload = await exportPending(prisma, pendingPath);
    pgDump(db, dumpPath);

    await prisma.$disconnect();

    pm2Stop();

    const adminPassword = generatePassword();
    const demoPassword = generatePassword();
    log("generated new SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD");

    upsertEnvFile(join(APP_DIR, ".env"), {
      SEED_ADMIN_PASSWORD: adminPassword,
      SEED_DEMO_PASSWORD: demoPassword,
    });

    log("prisma db push --force-reset…");
    run("npx", ["prisma", "db", "push", "--force-reset", "--accept-data-loss"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        SEED_ADMIN_PASSWORD: adminPassword,
        SEED_DEMO_PASSWORD: demoPassword,
      },
    });
    wiped = true;

    log("npm run db:seed…");
    run("npm", ["run", "db:seed"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        SEED_ADMIN_PASSWORD: adminPassword,
        SEED_DEMO_PASSWORD: demoPassword,
        HUSKY: "0",
      },
    });

    prisma = new PrismaClient();
    await setMaintenance(prisma, true);
    await restorePending(prisma, pendingPayload);
    await verify(prisma, pendingPayload.count);

    flushRedis();

    writeFileSync(
      credsPath,
      [
        `# Wengz seed credentials — ${new Date().toISOString()}`,
        `# chmod 600; store in password manager; do not commit`,
        "",
        `SUPER_ADMIN  nabraagency20@gmail.com  ${adminPassword}`,
        `PROJECT_MANAGER  pm@wengz.tech  ${demoPassword}`,
        `FINANCE_MANAGER  finance@wengz.tech  ${demoPassword}`,
        `CLIENT  client@wengz.tech  ${demoPassword}`,
        `PROVIDER  provider@wengz.tech  ${demoPassword}`,
        "",
        `PENDING users restored: ${pendingPayload.count}`,
        `Dump: ${dumpPath}`,
        "",
      ].join("\n"),
      { mode: 0o600 }
    );
    chmodSync(credsPath, 0o600);
    log(`credentials written to ${credsPath} (not printed)`);

    pm2Start();
    await setMaintenance(prisma, false);

    log("DONE — safe reset completed");
    log(`PENDING restored: ${pendingPayload.count}`);
    log(`Credentials file: ${credsPath}`);
    log(`Full dump: ${dumpPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[safe-reset] FAILED: ${message}`);

    try {
      await prisma.$disconnect().catch(() => undefined);
    } catch {
      /* ignore */
    }

    if (wiped && existsSync(dumpPath)) {
      try {
        pgRestoreFromGzip(db, dumpPath);
        pm2Start();
        const rollbackPrisma = new PrismaClient();
        try {
          await setMaintenance(rollbackPrisma, true);
        } finally {
          await rollbackPrisma.$disconnect();
        }
        log("auto-rollback finished; maintenance_mode LEFT ON for inspection");
      } catch (rollbackErr) {
        console.error(
          `[safe-reset] AUTO-ROLLBACK FAILED: ${
            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)
          }`
        );
        console.error(`[safe-reset] Manual restore: gunzip -c ${dumpPath} | psql …`);
      }
    } else if (!wiped) {
      try {
        pm2Start();
      } catch {
        /* ignore */
      }
    }

    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
