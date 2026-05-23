import { Pool } from "pg";

let pool;
let cachedTables;
let cachedColumnsByTable;

const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "08000", // connection_exception
  "08003", // connection_does_not_exist
  "08006", // connection_failure
]);

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function isSafeIdentifier(value) {
  return typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
}

function quoteIdentifier(value) {
  if (!isSafeIdentifier(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!hasDatabaseUrl()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });

    // Prevent unhandled rejection crashes on pool-level errors
    pool.on("error", (err) => {
      console.error("[db] Pool error:", err.message);
    });
  }

  return pool;
}

function isTransient(err) {
  return (
    TRANSIENT_ERROR_CODES.has(err.code) ||
    TRANSIENT_ERROR_CODES.has(err.errno) ||
    (err.message ?? "").toLowerCase().includes("timeout") ||
    (err.message ?? "").toLowerCase().includes("connection")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function query(text, values = []) {
  const db = getPool();
  if (!db) return [];

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.query(text, values);
      return result.rows;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES && isTransient(err)) {
        console.warn(`[db] Transient error on attempt ${attempt}/${MAX_RETRIES}: ${err.message}. Retrying...`);
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

export async function getPublicTables() {
  if (cachedTables) return cachedTables;

  const rows = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );

  cachedTables = rows.map((row) => row.table_name);
  return cachedTables;
}

export async function getTableColumns(table) {
  if (!table) return [];

  if (!cachedColumnsByTable) {
    cachedColumnsByTable = new Map();
  }

  if (cachedColumnsByTable.has(table)) {
    return cachedColumnsByTable.get(table);
  }

  const rows = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );

  const columns = rows.map((row) => row.column_name);
  cachedColumnsByTable.set(table, columns);
  return columns;
}

export async function hasTableColumn(table, column) {
  if (!table || !column) return false;
  const columns = await getTableColumns(table);
  return columns.includes(column);
}

export async function resolveTable(candidates = []) {
  const available = await getPublicTables();
  return candidates.find((name) => available.includes(name)) ?? null;
}

export async function fetchMany(table, limit = 50) {
  if (!table) return [];
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 200)) : 50;
  return query(`SELECT * FROM ${quoteIdentifier(table)} LIMIT ${safeLimit}`);
}

export async function fetchById(table, id) {
  if (!table || id === undefined || id === null || id === "") return null;
  const rows = await query(`SELECT * FROM ${quoteIdentifier(table)} WHERE id::text = $1 LIMIT 1`, [String(id)]);
  return rows[0] ?? null;
}
