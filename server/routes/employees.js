const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

// List employees (admin only)
router.get('/', authRequired, adminOnly, async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const rows = await db.query(
    `SELECT e.id, e.full_name, e.phone, e.hourly_rate, e.hire_date, e.is_active, e.notes,
            r.name AS role_name, r.id AS role_id,
            u.id AS user_id, u.email, u.is_active AS user_active
     FROM employees e
     LEFT JOIN roles r ON r.id = e.role_id
     LEFT JOIN users u ON u.id = e.user_id
     ${includeInactive ? '' : 'WHERE e.is_active = 1'}
     ORDER BY e.full_name`,
    [],
  );
  res.json(rows);
});

router.get('/roles', authRequired, async (_req, res) => {
  const rows = await db.query(`SELECT id, name FROM roles ORDER BY name`, []);
  res.json(rows);
});

// Get a single employee
router.get('/:id', authRequired, adminOnly, async (req, res) => {
  const row = await db.get(
    `SELECT e.*, r.name AS role_name, u.email
     FROM employees e
     LEFT JOIN roles r ON r.id = e.role_id
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.id = $1`,
    [req.params.id],
  );
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// Create employee + user
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { full_name, email, phone, role_id, hourly_rate, hire_date, notes, password } = req.body || {};
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, password are required' });
  }

  const existing = await db.get(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) return res.status(409).json({ error: 'Email already exists' });

  const hash = await bcrypt.hash(password, 10);
  const u = await db.run(
    `INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, 'employee', 1)`,
    [email, hash],
  );
  const userId = db.client === 'pg'
    ? (await db.get(`SELECT id FROM users WHERE email = $1`, [email])).id
    : u.lastID;

  const e = await db.run(
    `INSERT INTO employees (user_id, full_name, phone, role_id, hourly_rate, hire_date, is_active, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [userId, full_name, phone, role_id || null, hourly_rate || 0, hire_date || null, notes || null],
  );
  const employeeId = db.client === 'pg'
    ? (await db.get(`SELECT id FROM employees WHERE user_id = $1`, [userId])).id
    : e.lastID;

  const created = await db.get(`SELECT * FROM employees WHERE id = $1`, [employeeId]);
  res.status(201).json(created);
});

// Edit employee
router.patch('/:id', authRequired, adminOnly, async (req, res) => {
  const { full_name, phone, role_id, hourly_rate, hire_date, notes } = req.body || {};
  await db.run(
    `UPDATE employees
        SET full_name   = COALESCE($1, full_name),
            phone       = COALESCE($2, phone),
            role_id     = COALESCE($3, role_id),
            hourly_rate = COALESCE($4, hourly_rate),
            hire_date   = COALESCE($5, hire_date),
            notes       = COALESCE($6, notes)
      WHERE id = $7`,
    [full_name, phone, role_id, hourly_rate, hire_date, notes, req.params.id],
  );
  const updated = await db.get(`SELECT * FROM employees WHERE id = $1`, [req.params.id]);
  res.json(updated);
});

// Deactivate (soft delete) — also deactivates the login
router.patch('/:id/deactivate', authRequired, adminOnly, async (req, res) => {
  const emp = await db.get(`SELECT user_id FROM employees WHERE id = $1`, [req.params.id]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  await db.run(`UPDATE employees SET is_active = 0 WHERE id = $1`, [req.params.id]);
  if (emp.user_id) {
    await db.run(`UPDATE users SET is_active = 0 WHERE id = $1`, [emp.user_id]);
  }
  res.json({ ok: true });
});

// Reactivate
router.patch('/:id/activate', authRequired, adminOnly, async (req, res) => {
  const emp = await db.get(`SELECT user_id FROM employees WHERE id = $1`, [req.params.id]);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  await db.run(`UPDATE employees SET is_active = 1 WHERE id = $1`, [req.params.id]);
  if (emp.user_id) {
    await db.run(`UPDATE users SET is_active = 1 WHERE id = $1`, [emp.user_id]);
  }
  res.json({ ok: true });
});

module.exports = router;
