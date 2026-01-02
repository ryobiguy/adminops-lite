import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

import { initDb, get, all, run, dbFile } from './db.js';
import { authMiddleware, signToken } from './auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: corsOrigin ? corsOrigin.split(',').map((s) => s.trim()).filter(Boolean) : true,
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/debug/db', authMiddleware, (req, res) => {
  res.json({
    dbFile,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV || null,
  });
});

function nowIso() {
  return new Date().toISOString();
}

function genClientCode() {
  // Short, URL-safe code (not cryptographically strong, but sufficient to avoid guessing IDs)
  return Math.random().toString(36).slice(2, 10);
}

function genPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function safeUserRow(row) {
  return { id: row.id, email: row.email };
}

// Bootstrap default admin user from env if not exists
async function ensureAdminUser() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    return;
  }

  const existing = await get('SELECT id, email FROM users WHERE email = ?', [email]);
  if (existing) return;

  await run(
    'INSERT INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)',
    [randomUUID(), email, password, nowIso()]
  );
}

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { message: 'Email and password are required' } });
  }

  const user = await get('SELECT * FROM users WHERE email = ?', [email]);

  if (!user || user.password !== password) {
    return res.status(401).json({ error: { message: 'Invalid credentials' } });
  }

  const token = signToken(user);
  res.json({ token, user: safeUserRow(user) });
});

app.get('/me', authMiddleware, async (req, res) => {
  const row = await get('SELECT id, email FROM users WHERE id = ?', [req.user.userId]);
  if (!row) return res.status(404).json({ error: { message: 'User not found' } });
  res.json({ user: row });
});

app.get('/clients', authMiddleware, async (req, res) => {
  const includeArchived = String(req.query?.includeArchived || 'false') === 'true';
  const rows = includeArchived
    ? await all('SELECT * FROM clients ORDER BY created_at DESC')
    : await all('SELECT * FROM clients WHERE archived = 0 ORDER BY created_at DESC');
  res.json({ clients: rows });
});

app.post('/clients', authMiddleware, async (req, res) => {
  const { name } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: { message: 'Client name is required' } });
  }

  const id = randomUUID();
  const ts = nowIso();
  // Generate a unique client_code
  let clientCode = genClientCode();
  for (let i = 0; i < 5; i++) {
    const exists = await get('SELECT id FROM clients WHERE client_code = ?', [clientCode]);
    if (!exists) break;
    clientCode = genClientCode();
  }
  const pin = genPin();
  await run('INSERT INTO clients (id, name, client_code, customer_pin, created_at) VALUES (?, ?, ?, ?, ?)', [id, String(name).trim(), clientCode, pin, ts]);
  const row = await get('SELECT * FROM clients WHERE id = ?', [id]);
  res.status(201).json({ client: row });
});

app.post('/clients/:id/rotate-pin', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = await get('SELECT id FROM clients WHERE id = ?', [String(id)]);
  if (!existing) return res.status(404).json({ error: { message: 'Client not found' } });
  const pin = genPin();
  await run('UPDATE clients SET customer_pin = ? WHERE id = ?', [pin, String(id)]);
  const row = await get('SELECT * FROM clients WHERE id = ?', [String(id)]);
  res.json({ client: row });
});

app.get('/clients/:id/pin', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const row = await get('SELECT id, customer_pin FROM clients WHERE id = ?', [String(id)]);
  if (!row) return res.status(404).json({ error: { message: 'Client not found' } });
  res.json({ pin: row.customer_pin || null });
});

app.post('/clients/:id/archive', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = await get('SELECT id FROM clients WHERE id = ?', [String(id)]);
  if (!existing) return res.status(404).json({ error: { message: 'Client not found' } });
  await run('UPDATE clients SET archived = 1 WHERE id = ?', [String(id)]);
  const row = await get('SELECT * FROM clients WHERE id = ?', [String(id)]);
  res.json({ client: row });
});

app.post('/clients/:id/unarchive', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = await get('SELECT id FROM clients WHERE id = ?', [String(id)]);
  if (!existing) return res.status(404).json({ error: { message: 'Client not found' } });
  await run('UPDATE clients SET archived = 0 WHERE id = ?', [String(id)]);
  const row = await get('SELECT * FROM clients WHERE id = ?', [String(id)]);
  res.json({ client: row });
});

// Danger: permanently delete a client and all their requests
app.delete('/clients/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = await get('SELECT id, name FROM clients WHERE id = ?', [String(id)]);
  if (!existing) return res.status(404).json({ error: { message: 'Client not found' } });

  await run('DELETE FROM requests WHERE client_id = ?', [String(id)]);
  await run('DELETE FROM clients WHERE id = ?', [String(id)]);

  res.json({ ok: true });
});

// Minimal in-memory rate limit for public submit (per IP)
const publicRate = new Map();
function publicRateLimit(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const key = String(ip);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 20;

  const item = publicRate.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > item.resetAt) {
    item.count = 0;
    item.resetAt = now + windowMs;
  }
  item.count += 1;
  publicRate.set(key, item);

  if (item.count > max) {
    return res.status(429).json({ error: { message: 'Too many requests, try again shortly' } });
  }
  next();
}

// Public: fetch client info for a submit link
app.get('/public/clients/by-code/:clientCode', publicRateLimit, async (req, res) => {
  const { clientCode } = req.params;
  const row = await get('SELECT id, name, client_code, customer_pin, archived FROM clients WHERE client_code = ?', [String(clientCode)]);
  if (!row) return res.status(404).json({ error: { message: 'Client not found' } });
  if (row.archived) return res.status(404).json({ error: { message: 'Client not found' } });
  // Owner-only intake uses a PIN. We never return the PIN here.
  res.json({ client: { id: row.id, name: row.name, clientCode: row.client_code, pinRequired: true } });
});

// Public: create a request for a client submit link
app.post('/public/clients/by-code/:clientCode/requests', publicRateLimit, async (req, res) => {
  const { clientCode } = req.params;
  const { title, details, customerName, dueDate, pin } = req.body || {};

  const client = await get('SELECT id, archived, customer_pin FROM clients WHERE client_code = ?', [String(clientCode)]);
  if (!client) return res.status(404).json({ error: { message: 'Client not found' } });
  if (client.archived) return res.status(404).json({ error: { message: 'Client not found' } });

  if (!client.customer_pin) {
    return res.status(403).json({ error: { message: 'PIN is required' } });
  }
  if (String(pin || '') !== String(client.customer_pin)) {
    return res.status(403).json({ error: { message: 'Invalid PIN' } });
  }

  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ error: { message: 'Title is required' } });
  }

  const id = randomUUID();
  const ts = nowIso();

  await run(
    `INSERT INTO requests (
      id, client_id, title, details, customer_name, due_date, tags, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      client.id,
      String(title).trim(),
      details ? String(details) : null,
      customerName ? String(customerName) : null,
      dueDate ? String(dueDate) : null,
      null,
      'new',
      'owner_link',
      ts,
      ts,
    ]
  );

  const row = await get('SELECT * FROM requests WHERE id = ?', [id]);
  res.status(201).json({ request: row });
});

app.get('/requests', authMiddleware, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: { message: 'clientId is required' } });
  }

  const { q, status } = req.query;
  const where = ['client_id = ?'];
  const params = [String(clientId)];

  if (status && ['new', 'doing', 'waiting', 'done'].includes(String(status))) {
    where.push('status = ?');
    params.push(String(status));
  }

  if (q && String(q).trim()) {
    where.push('(title LIKE ? OR customer_name LIKE ? OR tags LIKE ?)');
    const like = `%${String(q).trim()}%`;
    params.push(like, like, like);
  }

  const rows = await all(
    `SELECT * FROM requests WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    params
  );
  res.json({ requests: rows });
});

app.get('/reports/weekly', authMiddleware, async (req, res) => {
  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: { message: 'clientId is required' } });
  }

  const client = await get('SELECT id, name FROM clients WHERE id = ?', [String(clientId)]);
  if (!client) {
    return res.status(400).json({ error: { message: 'Invalid clientId' } });
  }

  const now = Date.now();
  const weekAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const waitingCutoffIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const created = await get(
    'SELECT COUNT(1) as c FROM requests WHERE client_id = ? AND created_at >= ?',
    [String(clientId), weekAgoIso]
  );

  const completed = await get(
    'SELECT COUNT(1) as c FROM requests WHERE client_id = ? AND status = "done" AND updated_at >= ?',
    [String(clientId), weekAgoIso]
  );

  const overdue = await get(
    'SELECT COUNT(1) as c FROM requests WHERE client_id = ? AND status != "done" AND due_date IS NOT NULL AND due_date < ?',
    [String(clientId), new Date(now).toISOString()]
  );

  const waitingStale = await get(
    'SELECT COUNT(1) as c FROM requests WHERE client_id = ? AND status = "waiting" AND updated_at < ?',
    [String(clientId), waitingCutoffIso]
  );

  // Top tags (very simple parsing, assumes comma separated)
  const rows = await all(
    'SELECT tags FROM requests WHERE client_id = ? AND tags IS NOT NULL AND tags != ""',
    [String(clientId)]
  );

  const freq = {};
  for (const r of rows) {
    const parts = String(r.tags)
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    for (const t of parts) {
      freq[t] = (freq[t] || 0) + 1;
    }
  }
  const topTags = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  res.json({
    client,
    window: { days: 7 },
    stats: {
      created: Number(created?.c || 0),
      completed: Number(completed?.c || 0),
      overdue: Number(overdue?.c || 0),
      waiting24hPlus: Number(waitingStale?.c || 0),
    },
    topTags,
  });
});

app.post('/requests', authMiddleware, async (req, res) => {
  const { clientId, title, details, customerName, dueDate, tags } = req.body || {};

  if (!clientId) {
    return res.status(400).json({ error: { message: 'clientId is required' } });
  }

  const client = await get('SELECT id FROM clients WHERE id = ?', [String(clientId)]);
  if (!client) {
    return res.status(400).json({ error: { message: 'Invalid clientId' } });
  }

  if (!title || String(title).trim().length < 2) {
    return res.status(400).json({ error: { message: 'Title is required' } });
  }

  const id = randomUUID();
  const ts = nowIso();

  await run(
    `INSERT INTO requests (
      id, client_id, title, details, customer_name, due_date, tags, status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      String(clientId),
      String(title).trim(),
      details ? String(details) : null,
      customerName ? String(customerName) : null,
      dueDate ? String(dueDate) : null,
      tags ? String(tags) : null,
      'new',
      req.user.userId,
      ts,
      ts,
    ]
  );

  const row = await get('SELECT * FROM requests WHERE id = ?', [id]);
  res.status(201).json({ request: row });
});

app.patch('/requests/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, title, details, customerName, dueDate, tags } = req.body || {};

  const existing = await get('SELECT * FROM requests WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: { message: 'Request not found' } });
  }

  const next = {
    title: title !== undefined ? String(title).trim() : existing.title,
    details: details !== undefined ? (details === null ? null : String(details)) : existing.details,
    customer_name: customerName !== undefined ? (customerName === null ? null : String(customerName)) : existing.customer_name,
    due_date: dueDate !== undefined ? (dueDate === null ? null : String(dueDate)) : existing.due_date,
    status: status !== undefined ? String(status) : existing.status,
    tags: tags !== undefined ? (tags === null ? null : String(tags)) : existing.tags,
  };

  if (!['new','doing','waiting','done'].includes(next.status)) {
    return res.status(400).json({ error: { message: 'Invalid status' } });
  }

  await run(
    `UPDATE requests
     SET title = ?, details = ?, customer_name = ?, due_date = ?, tags = ?, status = ?, updated_at = ?
     WHERE id = ?`,
    [next.title, next.details, next.customer_name, next.due_date, next.tags, next.status, nowIso(), id]
  );

  const row = await get('SELECT * FROM requests WHERE id = ?', [id]);
  res.json({ request: row });
});

app.delete('/requests/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const existing = await get('SELECT * FROM requests WHERE id = ?', [id]);
  if (!existing) {
    return res.status(404).json({ error: { message: 'Request not found' } });
  }

  await run('DELETE FROM requests WHERE id = ?', [id]);
  res.json({ ok: true });
});

async function start() {
  await initDb();
  await ensureAdminUser();

  // Ensure a default client exists for first-time use
  const existingDefault = await get('SELECT id FROM clients ORDER BY created_at ASC LIMIT 1');
  if (!existingDefault) {
    const id = randomUUID();
    const code = genClientCode();
    await run('INSERT INTO clients (id, name, client_code, created_at) VALUES (?, ?, ?, ?)', [id, 'Default Client', code, nowIso()]);
  }

  // Backfill any missing client_code values
  const missingCodes = await all('SELECT id FROM clients WHERE client_code IS NULL OR client_code = ""');
  for (const c of missingCodes) {
    let code = genClientCode();
    for (let i = 0; i < 5; i++) {
      const exists = await get('SELECT id FROM clients WHERE client_code = ?', [code]);
      if (!exists) break;
      code = genClientCode();
    }
    await run('UPDATE clients SET client_code = ? WHERE id = ?', [code, c.id]);
  }

  app.listen(PORT, () => {
    console.log(`AdminOps Lite API listening on :${PORT}`);
  });
}

start().catch((e) => {
  console.error('Failed to start API:', e);
  process.exit(1);
});
