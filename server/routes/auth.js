const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await db.get(
    `SELECT u.id, u.email, u.password_hash, u.role, u.is_active, e.id AS employee_id, e.full_name
     FROM users u
     LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.email = $1`,
    [email],
  );

  if (!user || !user.is_active) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({
    id: user.id, email: user.email, role: user.role, employeeId: user.employee_id,
  });

  res.json({
    token,
    user: {
      id: user.id, email: user.email, role: user.role,
      employeeId: user.employee_id, fullName: user.full_name,
    },
  });
});

router.post('/register', async (req, res) => {
  const { full_name, email, password, role, admin_code } = req.body || {};

  if (!full_name || !email || !password || !role) {
    return res.status(400).json({ error: 'full_name, email, password, and role are required' });
  }
  if (!['admin', 'employee'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or employee' });
  }

  // Admin registration requires a secret code
  if (role === 'admin') {
    const code = process.env.ADMIN_REGISTRATION_CODE;
    if (!code) return res.status(403).json({ error: 'Admin registration is disabled' });
    if (admin_code !== code) return res.status(403).json({ error: 'Invalid admin code' });
  }

  const existing = await db.get(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

  const hash = await bcrypt.hash(password, 10);
  await db.run(
    `INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, 1)`,
    [email, hash, role],
  );
  const newUser = await db.get(`SELECT id FROM users WHERE email = $1`, [email]);

  // Create employee record for both roles so they appear on the roster
  await db.run(
    `INSERT INTO employees (user_id, full_name, is_active) VALUES ($1, $2, 1)`,
    [newUser.id, full_name],
  );
  const emp = await db.get(`SELECT id FROM employees WHERE user_id = $1`, [newUser.id]);

  const token = signToken({
    id: newUser.id, email, role, employeeId: emp.id,
  });

  res.status(201).json({
    token,
    user: { id: newUser.id, email, role, employeeId: emp.id, fullName: full_name },
  });
});

router.get('/me', authRequired, async (req, res) => {
  const user = await db.get(
    `SELECT u.id, u.email, u.role, e.id AS employee_id, e.full_name
     FROM users u LEFT JOIN employees e ON e.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id],
  );
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: user.id, email: user.email, role: user.role,
    employeeId: user.employee_id, fullName: user.full_name,
  });
});

module.exports = router;
