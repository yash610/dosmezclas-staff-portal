const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Helpers
function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
function addDaysIso(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// GET /api/schedules?week=YYYY-MM-DD  (admin: everyone; employee: self)
router.get('/', authRequired, async (req, res) => {
  const weekStart = mondayOf(req.query.week);
  const weekEnd = addDaysIso(weekStart, 6);

  const params = [weekStart, weekEnd];
  let where = `s.shift_date BETWEEN $1 AND $2`;

  if (req.user.role === 'employee') {
    params.push(req.user.employeeId);
    where += ` AND s.employee_id = $${params.length}`;
  }

  const rows = await db.query(
    `SELECT s.*, e.full_name, r.name AS role_name
       FROM schedules s
       JOIN employees e ON e.id = s.employee_id
       LEFT JOIN roles r ON r.id = e.role_id
      WHERE ${where}
      ORDER BY s.shift_date, s.start_time, e.full_name`,
    params,
  );
  res.json({ weekStart, weekEnd, shifts: rows });
});

// GET /api/schedules/me/today
router.get('/me/today', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.json({ shifts: [] });
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.query(
    `SELECT s.*, e.full_name FROM schedules s
        JOIN employees e ON e.id = s.employee_id
       WHERE s.employee_id = $1 AND s.shift_date = $2
       ORDER BY s.start_time`,
    [req.user.employeeId, today],
  );
  res.json({ date: today, shifts: rows });
});

// GET /api/schedules/me/week
router.get('/me/week', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.json({ shifts: [] });
  const weekStart = mondayOf(req.query.week);
  const weekEnd = addDaysIso(weekStart, 6);
  const rows = await db.query(
    `SELECT s.*, e.full_name FROM schedules s
        JOIN employees e ON e.id = s.employee_id
       WHERE s.employee_id = $1 AND s.shift_date BETWEEN $2 AND $3
       ORDER BY s.shift_date, s.start_time`,
    [req.user.employeeId, weekStart, weekEnd],
  );
  res.json({ weekStart, weekEnd, shifts: rows });
});

// POST /api/schedules   (admin: create shift)
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { employee_id, shift_date, start_time, end_time, break_minutes, position, notes } = req.body || {};
  if (!employee_id || !shift_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'employee_id, shift_date, start_time, end_time are required' });
  }
  const result = await db.run(
    `INSERT INTO schedules (employee_id, shift_date, start_time, end_time, break_minutes, position, notes, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')`,
    [employee_id, shift_date, start_time, end_time, break_minutes ?? 30, position || null, notes || null],
  );
  const id = db.client === 'pg'
    ? (await db.get(`SELECT id FROM schedules WHERE employee_id=$1 AND shift_date=$2 AND start_time=$3 ORDER BY id DESC LIMIT 1`, [employee_id, shift_date, start_time])).id
    : result.lastID;
  const created = await db.get(`SELECT * FROM schedules WHERE id = $1`, [id]);
  res.status(201).json(created);
});

// PATCH /api/schedules/:id
router.patch('/:id', authRequired, adminOnly, async (req, res) => {
  const { shift_date, start_time, end_time, break_minutes, position, notes, status, employee_id } = req.body || {};
  await db.run(
    `UPDATE schedules
        SET shift_date    = COALESCE($1, shift_date),
            start_time    = COALESCE($2, start_time),
            end_time      = COALESCE($3, end_time),
            break_minutes = COALESCE($4, break_minutes),
            position      = COALESCE($5, position),
            notes         = COALESCE($6, notes),
            status        = COALESCE($7, status),
            employee_id   = COALESCE($8, employee_id)
      WHERE id = $9`,
    [shift_date, start_time, end_time, break_minutes, position, notes, status, employee_id, req.params.id],
  );
  const updated = await db.get(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
  res.json(updated);
});

// DELETE /api/schedules/:id
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  await db.run(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
