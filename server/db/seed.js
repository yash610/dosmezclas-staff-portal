#!/usr/bin/env node
// Idempotent seed: creates schema if missing, wipes existing rows, then
// inserts a sample admin + 5 employees + a week of shifts, availability,
// and a couple of pending requests.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./index');
const { migrate } = require('./schema');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function mondayOf(date) {
  const d = new Date(date);
  const day = d.getUTCDay();           // 0 (Sun) .. 6 (Sat)
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

async function clear() {
  // Order matters because of FKs
  await db.exec(`DELETE FROM time_logs`);
  await db.exec(`DELETE FROM shift_requests`);
  await db.exec(`DELETE FROM availability`);
  await db.exec(`DELETE FROM schedules`);
  await db.exec(`DELETE FROM employees`);
  await db.exec(`DELETE FROM users`);
  await db.exec(`DELETE FROM roles`);
  // Reset autoincrement counters on SQLite
  if (db.client === 'sqlite') {
    try { await db.exec(`DELETE FROM sqlite_sequence`); } catch (_) {}
  } else {
    // Postgres — reset the SERIAL sequences
    for (const t of ['roles','users','employees','schedules','availability','shift_requests','time_logs']) {
      try { await db.exec(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`); } catch (_) {}
    }
  }
}

async function insertRole(name) {
  const r = await db.run(`INSERT INTO roles (name) VALUES ($1)`, [name]);
  if (db.client === 'pg') {
    const row = await db.get(`SELECT id FROM roles WHERE name = $1`, [name]);
    return row.id;
  }
  return r.lastID;
}

async function insertUser(email, password, role) {
  const hash = await bcrypt.hash(password, 10);
  const r = await db.run(
    `INSERT INTO users (email, password_hash, role, is_active) VALUES ($1, $2, $3, 1)`,
    [email, hash, role],
  );
  if (db.client === 'pg') {
    const row = await db.get(`SELECT id FROM users WHERE email = $1`, [email]);
    return row.id;
  }
  return r.lastID;
}

async function insertEmployee({ user_id, full_name, phone, role_id, hourly_rate, hire_date, notes }) {
  const r = await db.run(
    `INSERT INTO employees (user_id, full_name, phone, role_id, hourly_rate, hire_date, is_active, notes)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [user_id, full_name, phone, role_id, hourly_rate, hire_date, notes],
  );
  if (db.client === 'pg') {
    const row = await db.get(`SELECT id FROM employees WHERE user_id = $1`, [user_id]);
    return row.id;
  }
  return r.lastID;
}

async function insertShift(employee_id, date, start, end, position, breakMin = 30) {
  await db.run(
    `INSERT INTO schedules (employee_id, shift_date, start_time, end_time, break_minutes, position, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')`,
    [employee_id, date, start, end, breakMin, position],
  );
}

async function insertAvailability(employee_id, week_start, day, available, start, end) {
  await db.run(
    `INSERT INTO availability (employee_id, week_start, day_of_week, available, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [employee_id, week_start, day, available ? 1 : 0, start, end],
  );
}

(async () => {
  try {
    await migrate();
    await clear();

    // Roles
    const roleServer  = await insertRole('Server');
    const roleCook    = await insertRole('Line Cook');
    const roleBar     = await insertRole('Bartender');
    const roleHost    = await insertRole('Host');
    const roleManager = await insertRole('Manager');

    // Admin user (and an employee row so admin can appear on the floor too)
    const adminUserId = await insertUser('manager@dosmezclas.com', 'admin123', 'admin');
    await insertEmployee({
      user_id: adminUserId,
      full_name: 'Sofia Reyes',
      phone: '940-555-0100',
      role_id: roleManager,
      hourly_rate: 28,
      hire_date: '2024-01-15',
      notes: 'General Manager',
    });

    // Employees
    const seeds = [
      { email: 'maria@dosmezclas.com',  name: 'Maria Lopez',    phone: '940-555-0111', role: roleServer, rate: 14, hired: '2024-03-02' },
      { email: 'carlos@dosmezclas.com', name: 'Carlos Mendoza', phone: '940-555-0122', role: roleCook,   rate: 18, hired: '2024-02-10' },
      { email: 'priya@dosmezclas.com',  name: 'Priya Patel',    phone: '940-555-0133', role: roleBar,    rate: 16, hired: '2025-01-08' },
      { email: 'diego@dosmezclas.com',  name: 'Diego Ramirez',  phone: '940-555-0144', role: roleServer, rate: 14, hired: '2025-04-14' },
      { email: 'aisha@dosmezclas.com',  name: 'Aisha Khan',     phone: '940-555-0155', role: roleHost,   rate: 13, hired: '2025-06-20' },
    ];

    const employeeIds = {};
    for (const s of seeds) {
      const uid = await insertUser(s.email, 'pass123', 'employee');
      const eid = await insertEmployee({
        user_id: uid, full_name: s.name, phone: s.phone, role_id: s.role,
        hourly_rate: s.rate, hire_date: s.hired, notes: null,
      });
      employeeIds[s.email] = eid;
    }

    // This week's schedule (Mon-Sun)
    const today = new Date();
    const monday = mondayOf(today);

    const shiftPlan = [
      // [emailKey, dayOffset(0=Mon), start, end, position]
      ['maria@dosmezclas.com',  0, '11:00', '16:00', 'Floor — Lunch'],
      ['maria@dosmezclas.com',  2, '17:00', '22:00', 'Floor — Dinner'],
      ['maria@dosmezclas.com',  4, '17:00', '23:00', 'Floor — Dinner'],
      ['maria@dosmezclas.com',  5, '11:00', '17:00', 'Floor — Brunch'],

      ['carlos@dosmezclas.com', 0, '10:00', '18:00', 'Line — Hot'],
      ['carlos@dosmezclas.com', 1, '10:00', '18:00', 'Line — Hot'],
      ['carlos@dosmezclas.com', 3, '14:00', '22:00', 'Line — Hot'],
      ['carlos@dosmezclas.com', 5, '14:00', '23:00', 'Line — Hot'],
      ['carlos@dosmezclas.com', 6, '14:00', '22:00', 'Line — Hot'],

      ['priya@dosmezclas.com',  2, '16:00', '23:00', 'Bar'],
      ['priya@dosmezclas.com',  4, '16:00', '23:00', 'Bar'],
      ['priya@dosmezclas.com',  5, '16:00', '00:00', 'Bar'],
      ['priya@dosmezclas.com',  6, '12:00', '20:00', 'Bar — Brunch'],

      ['diego@dosmezclas.com',  1, '11:00', '16:00', 'Floor — Lunch'],
      ['diego@dosmezclas.com',  3, '17:00', '22:00', 'Floor — Dinner'],
      ['diego@dosmezclas.com',  5, '11:00', '17:00', 'Floor — Brunch'],

      ['aisha@dosmezclas.com',  2, '16:30', '22:00', 'Host'],
      ['aisha@dosmezclas.com',  4, '16:30', '22:00', 'Host'],
      ['aisha@dosmezclas.com',  5, '11:00', '16:00', 'Host'],
      ['aisha@dosmezclas.com',  6, '11:00', '16:00', 'Host'],
    ];

    for (const [email, offset, s, e, pos] of shiftPlan) {
      const date = isoDate(addDays(monday, offset));
      await insertShift(employeeIds[email], date, s, e, pos);
    }

    // A handful of last-week shifts so reports have something to chew on
    const lastMonday = addDays(monday, -7);
    const historicalPlan = [
      ['maria@dosmezclas.com',  0, '11:00', '16:00'], ['maria@dosmezclas.com',  3, '17:00', '22:00'],
      ['carlos@dosmezclas.com', 1, '10:00', '18:00'], ['carlos@dosmezclas.com', 4, '14:00', '22:00'],
      ['priya@dosmezclas.com',  2, '16:00', '23:00'], ['priya@dosmezclas.com',  5, '16:00', '00:00'],
      ['diego@dosmezclas.com',  1, '11:00', '16:00'], ['diego@dosmezclas.com',  4, '17:00', '22:00'],
      ['aisha@dosmezclas.com',  2, '16:30', '22:00'], ['aisha@dosmezclas.com',  5, '11:00', '16:00'],
    ];
    for (const [email, offset, s, e] of historicalPlan) {
      const date = isoDate(addDays(lastMonday, offset));
      // mark these as completed so reports show "completed" status
      await db.run(
        `INSERT INTO schedules (employee_id, shift_date, start_time, end_time, break_minutes, position, status)
         VALUES ($1, $2, $3, $4, 30, $5, 'completed')`,
        [employeeIds[email], date, s, e, 'Floor'],
      );
    }

    // Availability for the upcoming week
    const nextMonday = addDays(monday, 7);
    const nextWeekStart = isoDate(nextMonday);
    const availabilityPlan = {
      'maria@dosmezclas.com':  [[0,1,'11:00','22:00'],[1,0],[2,1,'11:00','22:00'],[3,1,'17:00','23:00'],[4,1,'17:00','23:00'],[5,1,'11:00','22:00'],[6,0]],
      'carlos@dosmezclas.com': [[0,1,'10:00','22:00'],[1,1,'10:00','22:00'],[2,0],[3,1,'14:00','22:00'],[4,1,'14:00','22:00'],[5,1,'14:00','23:00'],[6,1,'14:00','22:00']],
      'priya@dosmezclas.com':  [[0,0],[1,0],[2,1,'16:00','23:00'],[3,0],[4,1,'16:00','23:00'],[5,1,'16:00','00:00'],[6,1,'12:00','20:00']],
      'diego@dosmezclas.com':  [[0,0],[1,1,'11:00','22:00'],[2,0],[3,1,'17:00','22:00'],[4,0],[5,1,'11:00','22:00'],[6,1,'11:00','17:00']],
      'aisha@dosmezclas.com':  [[0,0],[1,0],[2,1,'16:30','22:00'],[3,0],[4,1,'16:30','22:00'],[5,1,'11:00','16:00'],[6,1,'11:00','16:00']],
    };
    for (const [email, days] of Object.entries(availabilityPlan)) {
      for (const d of days) {
        const [dayIdx, avail, start, end] = d;
        await insertAvailability(employeeIds[email], nextWeekStart, dayIdx, !!avail, start || null, end || null);
      }
    }

    // A few shift requests so the admin queue isn't empty
    const someShift = await db.get(
      `SELECT id, shift_date, start_time, end_time, position
       FROM schedules
       WHERE employee_id = $1
       ORDER BY shift_date ASC LIMIT 1`,
      [employeeIds['diego@dosmezclas.com']],
    );

    if (someShift) {
      await db.run(
        `INSERT INTO shift_requests
           (requester_id, type, schedule_id, shift_date, start_time, end_time, position, reason, status)
         VALUES ($1, 'transfer', $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          employeeIds['diego@dosmezclas.com'],
          someShift.id,
          someShift.shift_date,
          someShift.start_time,
          someShift.end_time,
          someShift.position,
          'Family event — looking for a cover.',
        ],
      );
    }

    const extraDate = isoDate(addDays(monday, 5));
    await db.run(
      `INSERT INTO shift_requests
         (requester_id, type, shift_date, start_time, end_time, position, reason, status)
       VALUES ($1, 'extra', $2, $3, $4, $5, $6, 'pending')`,
      [employeeIds['aisha@dosmezclas.com'], extraDate, '17:00', '22:00', 'Host', 'Saving up — happy to take more dinner shifts.'],
    );

    console.log('[seed] done.');
    console.log('       admin   : manager@dosmezclas.com / admin123');
    console.log('       employee: maria@dosmezclas.com / pass123 (and others — see README)');
    process.exit(0);
  } catch (err) {
    console.error('[seed] failed:', err);
    process.exit(1);
  }
})();
