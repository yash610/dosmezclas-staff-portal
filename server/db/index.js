// Tiny database adapter exposing the same async API for SQLite and PostgreSQL.
// All queries use $1, $2, ... positional placeholders; SQLite's `?` is translated
// at the adapter boundary so route code stays engine-agnostic.
//
// SQLite is provided by Node's built-in `node:sqlite` module (no native build
// required). PostgreSQL is provided by `pg`.

require('dotenv').config();

const client = process.env.DB_CLIENT || 'sqlite';

let db;

if (client === 'pg') {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = {
    client: 'pg',
    async query(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows;
    },
    async get(sql, params = []) {
      const result = await pool.query(sql, params);
      return result.rows[0];
    },
    async run(sql, params = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    close() {
      return pool.end();
    },
  };
} else {
  // Built-in to Node 22.5+. Stable in Node 24. Zero native build.
  const { DatabaseSync } = require('node:sqlite');
  const path = require('path');
  const file = process.env.SQLITE_PATH || path.join(__dirname, '..', 'dosmezclas.db');
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  // Translate $1, $2, ... -> ? so we can share SQL between engines.
  const toSqlite = (sql) => sql.replace(/\$(\d+)/g, '?');

  // node:sqlite returns rows that may include bigints for INTEGER columns.
  // Normalize to Number for ergonomics (our IDs comfortably fit in JS numbers).
  const normalize = (row) => {
    if (!row || typeof row !== 'object') return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
  };

  db = {
    client: 'sqlite',
    raw: sqlite,
    async query(sql, params = []) {
      const rows = sqlite.prepare(toSqlite(sql)).all(...params);
      return rows.map(normalize);
    },
    async get(sql, params = []) {
      const row = sqlite.prepare(toSqlite(sql)).get(...params);
      return normalize(row);
    },
    async run(sql, params = []) {
      const stmt = sqlite.prepare(toSqlite(sql));
      const info = stmt.run(...params);
      return {
        lastID: typeof info.lastInsertRowid === 'bigint' ? Number(info.lastInsertRowid) : info.lastInsertRowid,
        changes: typeof info.changes === 'bigint' ? Number(info.changes) : info.changes,
      };
    },
    async exec(sql) {
      sqlite.exec(sql);
    },
    close() {
      sqlite.close();
    },
  };
}

module.exports = db;
