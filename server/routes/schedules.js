const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');
const {
  SHIFT_TYPES,
  computeShiftTimes,
  weekdayLabelFromIso,
  mondayOfIso,
  availabilityDowFromIso,
} = require('../lib/shiftTimes');

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

// True only when the employee explicitly submitted "off" (available=false)
// for the week+day containing shiftDateIso. An employee who never submitted
// availability at all is NOT considered off — admins can assign them freely
// and the shift goes straight to 'scheduled' with no approval gate.
async function isMarkedOff(employeeId, shiftDateIso) {
  const weekStart = mondayOfIso(shiftDateIso);
  const dow = availabilityDowFromIso(shiftDateIso);
  const row = await db.get(
    `SELECT available FROM availability WHERE employee_id=$1 AND week_start=$2 AND day_of_week=$3`,
    [employeeId, weekStart, dow],
  );
  return !!row && !row.available;
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
// Body: { employee_id, shift_date, shift_type: 'lunch'|'dinner'|'both', break_minutes, position, notes }
// Start/end times are derived from shift_type + the shift_date's weekday —
// admins pick a shift type, not manual clock times. If the employee marked
// themselves off that day, the shift is created but flagged as needing the
// employee's own approval before it counts as a real assignment.
router.post('/', authRequired, adminOnly, async (req, res) => {
  const { employee_id, shift_date, shift_type, break_minutes, position, notes } = req.body || {};
  if (!employee_id || !shift_date || !SHIFT_TYPES.includes(shift_type)) {
    return res.status(400).json({ error: 'employee_id, shift_date, and a valid shift_type (lunch/dinner/both) are required' });
  }
  const { start_time, end_time } = computeShiftTimes(weekdayLabelFromIso(shift_date), shift_type);
  const employeeApproval = (await isMarkedOff(employee_id, shift_date)) ? 'pending' : null;

  const result = await db.run(
    `INSERT INTO schedules (employee_id, shift_date, shift_type, start_time, end_time, break_minutes, position, notes, status, employee_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled', $9)`,
    [employee_id, shift_date, shift_type, start_time, end_time, break_minutes ?? 30, position || null, notes || null, employeeApproval],
  );
  const id = db.client === 'pg'
    ? (await db.get(`SELECT id FROM schedules WHERE employee_id=$1 AND shift_date=$2 AND start_time=$3 ORDER BY id DESC LIMIT 1`, [employee_id, shift_date, start_time])).id
    : result.lastID;
  const created = await db.get(`SELECT * FROM schedules WHERE id = $1`, [id]);
  res.status(201).json(created);
});

// PATCH /api/schedules/:id
router.patch('/:id', authRequired, adminOnly, async (req, res) => {
  const { shift_date, shift_type, break_minutes, position, notes, status, employee_id } = req.body || {};

  let start_time = null;
  let end_time = null;
  let employeeApproval; // undefined = leave whatever is already stored alone

  if (shift_date || shift_type || employee_id) {
    const current = await db.get(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Not found' });
    const effectiveDate = shift_date || current.shift_date;
    const effectiveType = shift_type || current.shift_type;
    const effectiveEmployee = employee_id || current.employee_id;
    const computed = computeShiftTimes(weekdayLabelFromIso(effectiveDate), effectiveType);
    start_time = computed.start_time;
    end_time = computed.end_time;

    // Only re-check the off-day approval gate if the employee or the date
    // actually changed — those are the only two things that can change
    // whether this employee is marked off for this shift.
    if (employee_id || shift_date) {
      employeeApproval = (await isMarkedOff(effectiveEmployee, effectiveDate)) ? 'pending' : null;
    }
  }

  await db.run(
    `UPDATE schedules
        SET shift_date    = COALESCE($1, shift_date),
            shift_type    = COALESCE($2, shift_type),
            start_time    = COALESCE($3, start_time),
            end_time      = COALESCE($4, end_time),
            break_minutes = COALESCE($5, break_minutes),
            position      = COALESCE($6, position),
            notes         = COALESCE($7, notes),
            status        = COALESCE($8, status),
            employee_id   = COALESCE($9, employee_id)
      WHERE id = $10`,
    [shift_date, shift_type, start_time, end_time, break_minutes, position, notes, status, employee_id, req.params.id],
  );

  // Applied as its own statement (not folded into the COALESCE update above)
  // because we sometimes need to explicitly clear this back to NULL, which
  // COALESCE can't distinguish from "leave it alone".
  if (employeeApproval !== undefined) {
    await db.run(`UPDATE schedules SET employee_approval = $1 WHERE id = $2`, [employeeApproval, req.params.id]);
  }

  const updated = await db.get(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
  res.json(updated);
});

// PATCH /api/schedules/:id/employee-approval
// The employee's own response to a shift assigned on a day they marked off.
router.patch('/:id/employee-approval', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.status(403).json({ error: 'Employees only' });
  const { decision } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }

  const row = await db.get(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.employee_id !== req.user.employeeId) return res.status(403).json({ error: 'Not your shift' });
  if (row.employee_approval !== 'pending') {
    return res.status(400).json({ error: 'This shift is not awaiting your approval' });
  }

  if (decision === 'rejected') {
    await db.run(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true, deleted: true });
  }

  await db.run(`UPDATE schedules SET employee_approval = 'approved' WHERE id = $1`, [req.params.id]);
  const updated = await db.get(`SELECT * FROM schedules WHERE id = $1`, [req.params.id]);
  res.json(updated);
});

// DELETE /api/schedules/:id
router.delete('/:id', authRequired, adminOnly, async (req, res) => {
  // Mark any approved requests for this shift as rejected so employees see the change
  await db.run(
    `UPDATE shift_requests SET status = 'rejected' WHERE schedule_id = $1 AND status = 'approved'`,
    [req.params.id],
  );
  // If this shift was created from an approved availability submission,
  // flip that submission back so the admin availability view reflects that
  // the shift is no longer on the schedule.
  await db.run(
    `UPDATE availability SET status = 'rejected', schedule_id = NULL WHERE schedule_id = $1`,
    [req.params.id],
  );
  await db.run(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
