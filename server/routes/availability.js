const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const {
  SHIFT_TYPES,
  computeShiftTimes,
  weekdayLabelFromAvailabilityIndex,
} = require('../lib/shiftTimes');

const router = express.Router();

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

function normalizeShiftType(shiftType) {
  return SHIFT_TYPES.includes(shiftType) ? shiftType : null;
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
    `SELECT id, day_of_week, available, shift_type, start_time, end_time, notes, status, schedule_id
       FROM availability
      WHERE employee_id = $1 AND week_start = $2
      ORDER BY day_of_week`,
    [req.user.employeeId, week_start],
  );
  res.json({ week_start, days: rows });
});

// Admin: all employees' availability for a given week
router.get('/all', authRequired, adminOnly, async (req, res) => {
  const week_start = mondayOf(req.query.week_start || new Date().toISOString().slice(0, 10));
  const rows = await db.query(
    `SELECT a.*, e.full_name, e.id AS emp_id
       FROM availability a
       JOIN employees e ON e.id = a.employee_id
      WHERE a.week_start = $1
      ORDER BY e.full_name, a.day_of_week`,
    [week_start],
  );
  res.json({ week_start, rows });
});

// Admin: any employee's availability
router.get('/:employeeId', authRequired, adminOnly, async (req, res) => {
  const week_start = req.query.week_start || mondayOf(req.query.week);
  const rows = await db.query(
    `SELECT id, day_of_week, available, shift_type, start_time, end_time, notes, status, schedule_id
       FROM availability
      WHERE employee_id = $1 AND week_start = $2
      ORDER BY day_of_week`,
    [req.params.employeeId, week_start],
  );
  res.json({ week_start, days: rows });
});

// Employee submits weekly availability (upsert per day).
// Body: { week_start, days: [{ day_of_week, shift_type: 'lunch'|'dinner'|'both'|null, notes }] }
// Times are never sent by the client — they're derived here from shift_type
// so lunch/dinner hours always match the restaurant's official schedule.
router.post('/', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.status(400).json({ error: 'No employee profile' });
  const { week_start, days } = req.body || {};
  if (!week_start || !Array.isArray(days)) {
    return res.status(400).json({ error: 'week_start and days[] required' });
  }
  const ws = mondayOf(week_start);

  for (const d of days) {
    const { day_of_week, notes } = d;
    const shiftType = normalizeShiftType(d.shift_type);
    const available = shiftType ? 1 : 0; // node:sqlite can't bind raw booleans; 1/0 works on both engines
    const weekday = weekdayLabelFromAvailabilityIndex(day_of_week);
    const { start_time, end_time } = computeShiftTimes(weekday, shiftType);

    const existing = await db.get(
      `SELECT * FROM availability WHERE employee_id=$1 AND week_start=$2 AND day_of_week=$3`,
      [req.user.employeeId, ws, day_of_week],
    );

    // Same shift type as before — just refresh notes, leave any existing
    // approval decision (and its linked schedule shift) untouched.
    if (existing && existing.shift_type === shiftType) {
      await db.run(`UPDATE availability SET notes=$1 WHERE id=$2`, [notes || null, existing.id]);
      continue;
    }

    // The employee changed what they're submitting — any prior approval is
    // no longer valid for the new selection, so undo it before overwriting.
    // Delete the availability row (the thing pointing at the schedule) before
    // deleting the schedule itself, so we never trip a foreign key error.
    if (existing) {
      await db.run(`DELETE FROM availability WHERE id=$1`, [existing.id]);
      if (existing.schedule_id) {
        await db.run(`DELETE FROM schedules WHERE id=$1`, [existing.schedule_id]);
      }
    }
    await db.run(
      `INSERT INTO availability (employee_id, week_start, day_of_week, available, shift_type, start_time, end_time, notes, status, schedule_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NULL)`,
      [req.user.employeeId, ws, day_of_week, available, shiftType, start_time, end_time, notes || null],
    );
  }
  res.json({ ok: true, week_start: ws });
});

// Admin: approve or reject a single day's submitted availability.
// Approving creates (or refreshes) a matching row in `schedules` so the
// shift immediately shows up on the schedule. Rejecting removes it.
router.patch('/:id/status', authRequired, adminOnly, async (req, res) => {
  const { status } = req.body || {};
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
  }

  const row = await db.get(`SELECT * FROM availability WHERE id=$1`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.available || !row.shift_type) {
    return res.status(400).json({ error: 'Employee marked themselves unavailable that day — nothing to approve' });
  }

  if (status === 'rejected') {
    // Null out the link before deleting the schedule it points to, so we
    // never trip a foreign key error.
    const oldScheduleId = row.schedule_id;
    await db.run(`UPDATE availability SET status='rejected', schedule_id=NULL WHERE id=$1`, [req.params.id]);
    if (oldScheduleId) {
      await db.run(`DELETE FROM schedules WHERE id=$1`, [oldScheduleId]);
    }
  } else {
    const shiftDate = addDaysIso(row.week_start, row.day_of_week);
    let scheduleId = row.schedule_id;

    if (scheduleId) {
      await db.run(
        `UPDATE schedules SET shift_date=$1, shift_type=$2, start_time=$3, end_time=$4, status='scheduled' WHERE id=$5`,
        [shiftDate, row.shift_type, row.start_time, row.end_time, scheduleId],
      );
    } else {
      const result = await db.run(
        `INSERT INTO schedules (employee_id, shift_date, shift_type, start_time, end_time, break_minutes, position, notes, status)
         VALUES ($1, $2, $3, $4, $5, 30, NULL, 'Approved from availability', 'scheduled')`,
        [row.employee_id, shiftDate, row.shift_type, row.start_time, row.end_time],
      );
      scheduleId = db.client === 'pg'
        ? (await db.get(
            `SELECT id FROM schedules WHERE employee_id=$1 AND shift_date=$2 AND start_time=$3 ORDER BY id DESC LIMIT 1`,
            [row.employee_id, shiftDate, row.start_time],
          )).id
        : result.lastID;
    }

    await db.run(`UPDATE availability SET status='approved', schedule_id=$1 WHERE id=$2`, [scheduleId, req.params.id]);
  }

  const updated = await db.get(`SELECT * FROM availability WHERE id=$1`, [req.params.id]);
  res.json(updated);
});

module.exports = router;
