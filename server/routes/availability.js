const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

function mondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T00:00:00Z') : new Date();
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// Employee: own availability for a given week_start (defaults to next Monday)
router.get('/me', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.json({ week_start: null, days: [] });
  const today = new Date();
  const nextMon = new Date(today);
  nextMon.setUTCDate(today.getUTCDate() + (8 - today.getUTCDay()) % 7);
  const defaultWeek = mondayOf(nextMon.toISOString().slice(0, 10));
  const week_start = req.query.week_start || defaultWeek;

  const rows = await db.query(
    `SELECT day_of_week, available, start_time, end_time, notes
       FROM availability
      WHERE employee_id = $1 AND week_start = $2
      ORDER BY day_of_week`,
    [req.user.employeeId, week_start],
  );
  res.json({ week_start, days: rows });
});

// Admin: any employee's availability
router.get('/:employeeId', authRequired, adminOnly, async (req, res) => {
  const week_start = req.query.week_start || mondayOf(req.query.week);
  const rows = await db.query(
    `SELECT day_of_week, available, start_time, end_time, notes
       FROM availability
      WHERE employee_id = $1 AND week_start = $2
      ORDER BY day_of_week`,
    [req.params.employeeId, week_start],
  );
  res.json({ week_start, days: rows });
});

// Employee submits weekly availability (upsert per day)
router.post('/', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.status(400).json({ error: 'No employee profile' });
  const { week_start, days } = req.body || {};
  if (!week_start || !Array.isArray(days)) {
    return res.status(400).json({ error: 'week_start and days[] required' });
  }
  const ws = mondayOf(week_start);
  for (const d of days) {
    const { day_of_week, available, start_time, end_time, notes } = d;
    // Upsert without relying on engine-specific ON CONFLICT syntax.
    await db.run(
      `DELETE FROM availability WHERE employee_id=$1 AND week_start=$2 AND day_of_week=$3`,
      [req.user.employeeId, ws, day_of_week],
    );
    await db.run(
      `INSERT INTO availability (employee_id, week_start, day_of_week, available, start_time, end_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user.employeeId, ws, day_of_week, available ? 1 : 0, start_time || null, end_time || null, notes || null],
    );
  }
  res.json({ ok: true, week_start: ws });
});

module.exports = router;
