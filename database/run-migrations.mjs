import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { PG_MIGRATE_LOCK_ID, runner } from "node-pg-migrate";
import { Client } from "pg";

const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);
const utcFilenamePattern = /^(\d{17})_([a-z0-9][a-z0-9_-]*)\.sql$/;

export function parseMigrationFilename(filename) {
  const match = utcFilenamePattern.exec(filename);
  if (!match) {
    throw new Error(
      `Invalid migration filename "${filename}". Expected YYYYMMDDHHmmssSSS_description.sql.`,
    );
  }

  const [, timestamp, description] = match;
  const isoTimestamp = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}.${timestamp.slice(14, 17)}Z`;
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.valueOf())) {
    throw new Error(
      `Invalid UTC timestamp in migration filename "${filename}".`,
    );
  }
  const normalizedTimestamp = parsedDate.toISOString().replace(/\D/g, "");

  if (normalizedTimestamp !== timestamp) {
    throw new Error(
      `Invalid UTC timestamp in migration filename "${filename}".`,
    );
  }

  const currentName = `${timestamp}_${description}`;
  const legacyName = `${timestamp.slice(0, 14)}_${description}`;
  return { currentName, legacyName, timestamp };
}

export async function loadMigrationMetadata(directory = migrationDirectory) {
  const filenames = (await readdir(directory)).filter(
    (filename) => !filename.startsWith("."),
  );
  const migrations = filenames.map(parseMigrationFilename);

  migrations.sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
  for (let index = 1; index < migrations.length; index += 1) {
    if (migrations[index - 1].timestamp === migrations[index].timestamp) {
      throw new Error(
        `Duplicate migration timestamp ${migrations[index].timestamp}.`,
      );
    }
  }

  return migrations;
}

export async function preserveAppliedMigrationNames(client, migrations) {
  const tableResult = await client.query(
    "SELECT to_regclass('public.pgmigrations') AS table_name",
  );
  if (tableResult.rows[0]?.table_name === null) {
    return;
  }

  const appliedResult = await client.query(
    "SELECT name FROM public.pgmigrations",
  );
  const appliedNames = new Set(appliedResult.rows.map(({ name }) => name));

  for (const { currentName, legacyName } of migrations) {
    if (!appliedNames.has(legacyName)) {
      continue;
    }
    if (appliedNames.has(currentName)) {
      throw new Error(
        `Both legacy and current migration records exist for "${currentName}".`,
      );
    }

    await client.query(
      "UPDATE public.pgmigrations SET name = $1 WHERE name = $2",
      [currentName, legacyName],
    );
    appliedNames.delete(legacyName);
    appliedNames.add(currentName);
  }
}

export async function runMigrations() {
  const connectionString = globalThis.process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const migrations = await loadMigrationMetadata();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [PG_MIGRATE_LOCK_ID]);
    await client.query("BEGIN");
    try {
      await preserveAppliedMigrationNames(client, migrations);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    await runner({
      dbClient: client,
      direction: "up",
      dir: migrationDirectory,
      migrationsTable: "pgmigrations",
    });
  } finally {
    await client.end();
  }
}

const isMainModule =
  globalThis.process.argv[1] !== undefined &&
  pathToFileURL(resolve(globalThis.process.argv[1])).href === import.meta.url;

if (isMainModule) {
  runMigrations().catch((error) => {
    globalThis.console.error(error);
    globalThis.process.exitCode = 1;
  });
}
