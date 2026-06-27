const express = require('express');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

// GET /api/requests  — admin sees all, employee sees own
router.get('/', authRequired, async (req, res) => {
  const params = [];
  let where = '1=1';
  if (req.user.role === 'employee') {
    params.push(req.user.employeeId);
    where = `r.requester_id = $${params.length}`;
  }
  if (req.query.status) {
    params.push(req.query.status);
    where += ` AND r.status = $${params.length}`;
  }
  const rows = await db.query(
    `SELECT r.*, e.full_name AS requester_name
       FROM shift_requests r
       JOIN employees e ON e.id = r.requester_id
      WHERE ${where}
      ORDER BY r.created_at DESC, r.id DESC`,
    params,
  );
  res.json(rows);
});

// POST /api/requests  — employee creates a transfer or extra request
router.post('/', authRequired, async (req, res) => {
  if (!req.user.employeeId) return res.status(400).json({ error: 'No employee profile' });
  const { type, schedule_id, shift_date, start_time, end_time, position, reason } = req.body || {};
  if (!['transfer', 'extra'].includes(type)) {
    return res.status(400).json({ error: 'type must be "transfer" or "extra"' });
  }
  if (type === 'transfer' && !schedule_id) {
    return res.status(400).json({ error: 'schedule_id required for transfer' });
  }
  if (type === 'extra' && (!shift_date || !start_time || !end_time)) {
    return res.status(400).json({ error: 'shift_date, start_time, end_time required for extra' });
  }

  let resolved = { schedule_id: null, shift_date, start_time, end_time, position };
  if (type === 'transfer') {
    const s = await db.get(`SELECT * FROM schedules WHERE id = $1`, [schedule_id]);
    if (!s) return res.status(404).json({ error: 'Shift not found' });
    if (s.employee_id !== req.user.employeeId) {
      return res.status(403).json({ error: 'Cannot transfer someone else\'s shift' });
    }
    resolved = {
      schedule_id: s.id,
      shift_date: s.shift_date,
      start_time: s.start_time,
      end_time: s.end_time,
      position: s.position,
    };
  }

  const r = await db.run(
    `INSERT INTO shift_requests
       (requester_id, type, schedule_id, shift_date, start_time, end_time, position, reason, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')`,
    [
      req.user.employeeId, type, resolved.schedule_id,
      resolved.shift_date, resolved.start_time, resolved.end_time,
      resolved.position || null, reason || null,
    ],
  );
  const id = db.client === 'pg'
    ? (await db.get(`SELECT id FROM shift_requests WHERE requester_id=$1 ORDER BY id DESC LIMIT 1`, [req.user.employeeId])).id
    : r.lastID;
  const created = await db.get(`SELECT * FROM shift_requests WHERE id = $1`, [id]);
  res.status(201).json(created);
});

// PATCH /api/requests/:id/decide  — admin approve/reject
router.patch('/:id/decide', authRequired, adminOnly, async (req, res) => {
  const { decision, assign_to } = req.body || {}; // decision: 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "approved" or "rejected"' });
  }
  const reqRow = await db.get(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Not found' });
  if (reqRow.status !== 'pending') return res.status(400).json({ error: 'Already decided' });

  await db.run(
    `UPDATE shift_requests
        SET status = $1, decided_by = $2, decided_at = CURRENT_TIMESTAMP
      WHERE id = $3`,
    [decision, req.user.id, req.params.id],
  );

  // Side effects: when approved, mutate the schedule accordingly.
  if (decision === 'approved') {
    if (reqRow.type === 'transfer' && reqRow.schedule_id) {
      if (assign_to) {
        await db.run(
          `UPDATE schedules SET employee_id = $1, status = 'scheduled' WHERE id = $2`,
          [assign_to, reqRow.schedule_id],
        );
      } else {
        await db.run(
          `UPDATE schedules SET status = 'swapped' WHERE id = $1`,
          [reqRow.schedule_id],
        );
      }
    } else if (reqRow.type === 'extra') {
      await db.run(
        `INSERT INTO schedules (employee_id, shift_date, start_time, end_time, break_minutes, position, notes, status)
         VALUES ($1, $2, $3, $4, 30, $5, $6, 'scheduled')`,
        [
          reqRow.requester_id, reqRow.shift_date, reqRow.start_time, reqRow.end_time,
          reqRow.position, `From request #${reqRow.id}`,
        ],
      );
    }
  }

  const updated = await db.get(`SELECT * FROM shift_requests WHERE id = $1`, [req.params.id]);
  res.json(updated);
});

module.exports = router;
