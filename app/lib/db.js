import { Pool } from "pg";

let pool;
let cachedTables;
let cachedColumnsByTable;

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
  if (!hasDatabaseUrl()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
  }

  return pool;
}

export async function query(text, values = []) {
  const db = getPool();
  if (!db) {
    return [];
  }

  const result = await db.query(text, values);
  return result.rows;
}

export async function getPublicTables() {
  if (cachedTables) {
    return cachedTables;
  }

  const rows = await query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
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
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
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
  if (!table) {
    return [];
  }

  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(Number(limit), 200)) : 50;
  const rows = await query(`SELECT * FROM ${quoteIdentifier(table)} LIMIT ${safeLimit}`);
  return rows;
}

export async function fetchById(table, id) {
  if (!table || id === undefined || id === null || id === "") {
    return null;
  }

  const rows = await query(`SELECT * FROM ${quoteIdentifier(table)} WHERE id::text = $1 LIMIT 1`, [String(id)]);
  return rows[0] ?? null;
}
