const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Compute hours from HH:MM strings, supporting wrap-past-midnight (e.g., 22:00 -> 02:00).
function hoursBetween(start, end, breakMin = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  mins -= (breakMin || 0);
  return Math.max(0, mins) / 60;
}

function isoWeekKey(dateStr) {
  // Use Monday of the date's ISO week as the key
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// GET /api/reports/hours?group=employee|day|week|month&from=&to=&employeeId=
router.get('/hours', authRequired, async (req, res) => {
  const group = req.query.group || 'employee';
  const from = req.query.from;
  const to = req.query.to;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const params = [from, to];
  let where = `s.shift_date BETWEEN $1 AND $2`;

  // Employees only see themselves
  if (req.user.role === 'employee') {
    params.push(req.user.employeeId);
    where += ` AND s.employee_id = $${params.length}`;
  } else if (req.query.employeeId) {
    params.push(req.query.employeeId);
    where += ` AND s.employee_id = $${params.length}`;
  }

  const rows = await db.query(
    `SELECT s.id, s.employee_id, s.shift_date, s.start_time, s.end_time, s.break_minutes, s.status,
            e.full_name
       FROM schedules s
       JOIN employees e ON e.id = s.employee_id
      WHERE ${where}
      ORDER BY s.shift_date, s.start_time`,
    params,
  );

  const buckets = new Map();
  for (const r of rows) {
    const hours = hoursBetween(r.start_time, r.end_time, r.break_minutes);
    let key, label;
    switch (group) {
      case 'day':      key = r.shift_date; label = r.shift_date; break;
      case 'week':     key = isoWeekKey(r.shift_date); label = `Week of ${key}`; break;
      case 'month':    key = r.shift_date.slice(0, 7); label = key; break;
      case 'employee':
      default:         key = String(r.employee_id); label = r.full_name; break;
    }
    if (!buckets.has(key)) buckets.set(key, { key, label, hours: 0, shifts: 0 });
    const b = buckets.get(key);
    b.hours += hours;
    b.shifts += 1;
  }

  const out = [...buckets.values()].map((b) => ({ ...b, hours: Math.round(b.hours * 100) / 100 }));
  out.sort((a, b) => a.key < b.key ? -1 : 1);
  res.json({ group, from, to, rows: out });
});

// GET /api/reports/drilldown?employeeId=&from=&to=
router.get('/drilldown', authRequired, async (req, res) => {
  const from = req.query.from;
  const to = req.query.to;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const params = [from, to];
  let where = `s.shift_date BETWEEN $1 AND $2`;

  if (req.user.role === 'employee') {
    params.push(req.user.employeeId);
    where += ` AND s.employee_id = $${params.length}`;
  } else if (req.query.employeeId) {
    params.push(req.query.employeeId);
    where += ` AND s.employee_id = $${params.length}`;
  }

  const rows = await db.query(
    `SELECT s.id, s.shift_date, s.start_time, s.end_time, s.break_minutes, s.status, s.position,
            e.id AS employee_id, e.full_name
       FROM schedules s
       JOIN employees e ON e.id = s.employee_id
      WHERE ${where}
      ORDER BY s.shift_date, s.start_time`,
    params,
  );
  const enriched = rows.map((r) => ({
    ...r,
    total_hours: Math.round(hoursBetween(r.start_time, r.end_time, r.break_minutes) * 100) / 100,
  }));
  res.json({ from, to, rows: enriched });
});

module.exports = router;
