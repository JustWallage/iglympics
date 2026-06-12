import { pbkdf2Sync, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const password = process.argv[2];
const dbName = process.argv[3];
const remoteFlag = process.argv[4] === "--remote" ? "--remote" : "--local";

if (!password || !dbName) {
  console.error(
    "Usage: tsx scripts/seed-db.ts <password> <db-binding> [--remote]",
  );
  process.exit(1);
}

if (!/^[A-Za-z0-9_-]+$/.test(dbName)) {
  console.error(`Invalid db binding name: ${dbName}`);
  process.exit(1);
}

const PBKDF2_ITERATIONS = 100_000;
const userIds = Array.from({ length: 14 }, (_, i) => i + 1);

// `wrangler d1 execute` has no parameter binding, so values are inlined.
// They never include user input: only crypto-generated hex (asserted below)
// and integer ids.
function assertHex(value: string): string {
  if (!/^[0-9a-f]+$/.test(value)) throw new Error("expected hex string");
  return value;
}

const stmts = userIds.map((id) => {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return `UPDATE users SET password_hash = '${assertHex(hash.toString("hex"))}', salt = '${assertHex(salt.toString("hex"))}' WHERE id = ${id};`;
});

// Write to a temp file and use --file so the SQL never passes through a shell
const dir = mkdtempSync(join(tmpdir(), "iglympics-seed-"));
const sqlFile = join(dir, "seed.sql");
try {
  writeFileSync(sqlFile, stmts.join("\n"));
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", dbName, remoteFlag, "--file", sqlFile],
    { stdio: "inherit" },
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\nSeeded ${userIds.length} users`);
