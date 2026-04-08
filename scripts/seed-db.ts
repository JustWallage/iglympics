import { pbkdf2Sync, randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const password = process.argv[2];
const dbName = process.argv[3];
const remoteFlag = process.argv[4] === "--remote" ? "--remote" : "--local";

if (!password || !dbName) {
  console.error(
    "Usage: tsx scripts/seed-db.ts <password> <db-binding> [--remote]",
  );
  process.exit(1);
}

const PBKDF2_ITERATIONS = 100_000;
const userIds = Array.from({ length: 14 }, (_, i) => i + 1);

// Generate all SQL statements, then execute as one batch
const stmts = userIds.map((id) => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `UPDATE users SET password_hash = '${hash.toString("hex")}', salt = '${salt.toString("hex")}' WHERE id = ${id}`;
});

const sql = stmts.join("; ");
execSync(
  `pnpm exec wrangler d1 execute ${dbName} ${remoteFlag} --command "${sql};"`,
  {
    stdio: "inherit",
  },
);

console.log(`\nSeeded ${userIds.length} users`);
