import sqlite3 from 'sqlite3';

sqlite3.verbose();

const dbFile = process.env.DB_FILE || 'adminops.sqlite';
const db = new sqlite3.Database(dbFile);

export function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

export async function initDb() {
  await run('PRAGMA journal_mode = WAL');

  await run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_code TEXT,
      customer_pin TEXT,
      archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      client_id TEXT,
      title TEXT NOT NULL,
      details TEXT,
      customer_name TEXT,
      due_date TEXT,
      tags TEXT,
      status TEXT NOT NULL CHECK (status IN ('new','doing','waiting','done')),
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await run('CREATE INDEX IF NOT EXISTS idx_requests_status_updated ON requests(status, updated_at)');

  const clientCols = await all('PRAGMA table_info(clients)');
  const hasClientCode = Array.isArray(clientCols) && clientCols.some((c) => c?.name === 'client_code');
  if (!hasClientCode) {
    await run('ALTER TABLE clients ADD COLUMN client_code TEXT');
  }

  const hasArchived = Array.isArray(clientCols) && clientCols.some((c) => c?.name === 'archived');
  if (!hasArchived) {
    await run('ALTER TABLE clients ADD COLUMN archived INTEGER DEFAULT 0');
  }

  const hasCustomerPin = Array.isArray(clientCols) && clientCols.some((c) => c?.name === 'customer_pin');
  if (!hasCustomerPin) {
    await run('ALTER TABLE clients ADD COLUMN customer_pin TEXT');
  }

  await run('CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_client_code ON clients(client_code)');
  await run('CREATE INDEX IF NOT EXISTS idx_clients_archived_created ON clients(archived, created_at)');

  // Lightweight migration for older DBs: add client_id column if missing
  const cols = await all('PRAGMA table_info(requests)');
  const hasClientId = Array.isArray(cols) && cols.some((c) => c?.name === 'client_id');
  if (!hasClientId) {
    await run('ALTER TABLE requests ADD COLUMN client_id TEXT');
  }

  const hasTags = Array.isArray(cols) && cols.some((c) => c?.name === 'tags');
  if (!hasTags) {
    await run('ALTER TABLE requests ADD COLUMN tags TEXT');
  }

  await run('CREATE INDEX IF NOT EXISTS idx_requests_client_updated ON requests(client_id, updated_at)');
}
