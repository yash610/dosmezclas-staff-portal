// Schema written to work on both SQLite and PostgreSQL.
// We branch on engine for the small handful of incompatible details
// (autoincrement, boolean defaults, IF NOT EXISTS on triggers, etc.).

const db = require('./index');

const isPg = db.client === 'pg';

const pkAuto = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const bool = isPg ? 'BOOLEAN' : 'INTEGER';
const boolTrue  = isPg ? 'TRUE' : '1';
const now = isPg ? 'CURRENT_TIMESTAMP' : "(datetime('now'))";

const statements = [
  `CREATE TABLE IF NOT EXISTS roles (
    id ${pkAuto},
    name TEXT NOT NULL UNIQUE
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id ${pkAuto},
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','employee')),
    is_active ${bool} NOT NULL DEFAULT ${boolTrue},
    created_at TIMESTAMP DEFAULT ${now}
  )`,

  `CREATE TABLE IF NOT EXISTS employees (
    id ${pkAuto},
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role_id INTEGER REFERENCES roles(id),
    hourly_rate REAL DEFAULT 0,
    hire_date TEXT,
    is_active ${bool} NOT NULL DEFAULT ${boolTrue},
    notes TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS schedules (
    id ${pkAuto},
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_date TEXT NOT NULL,
    shift_type TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    break_minutes INTEGER DEFAULT 30,
    position TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','swapped')),
    employee_approval TEXT,
    created_at TIMESTAMP DEFAULT ${now}
  )`,

  `CREATE INDEX IF NOT EXISTS idx_schedules_employee_date ON schedules(employee_id, shift_date)`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(shift_date)`,

  `CREATE TABLE IF NOT EXISTS availability (
    id ${pkAuto},
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    available ${bool} NOT NULL DEFAULT ${boolTrue},
    shift_type TEXT,
    start_time TEXT,
    end_time TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    UNIQUE (employee_id, week_start, day_of_week)
  )`,

  `CREATE TABLE IF NOT EXISTS shift_requests (
    id ${pkAuto},
    requester_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('transfer','extra')),
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE SET NULL,
    shift_date TEXT,
    start_time TEXT,
    end_time TEXT,
    position TEXT,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    decided_by INTEGER REFERENCES users(id),
    decided_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT ${now}
  )`,

  `CREATE TABLE IF NOT EXISTS time_logs (
    id ${pkAuto},
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    break_minutes INTEGER DEFAULT 0,
    notes TEXT
  )`,
];

const defaultRoles = ['Waiter', 'Bartender', 'Manager', 'Chipper', 'Cook', 'Dishwasher'];

// Adds a column to an already-existing table. Safe to call every time
// migrate() runs — if the column is already there this just fails quietly,
// which is how we upgrade a live database without a real migration tool.
async function addColumnIfMissing(table, columnDef) {
  try {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
  } catch (_) {
    // Column already exists — nothing to do.
  }
}

async function migrate() {
  for (const sql of statements) {
    await db.exec(sql);
  }

  // Upgrade path for databases created before shift-type-based scheduling.
  // No-ops on a fresh install since these columns are already in the
  // CREATE TABLE statements above.
  await addColumnIfMissing('availability', 'shift_type TEXT');
  await addColumnIfMissing('availability', `status TEXT NOT NULL DEFAULT 'pending'`);
  await addColumnIfMissing('availability', 'schedule_id INTEGER');
  await addColumnIfMissing('schedules', 'shift_type TEXT');
  // Lets an admin assign a shift to an employee who marked themselves off —
  // the shift sits in this column as 'pending' until the employee approves
  // or rejects it themselves.
  await addColumnIfMissing('schedules', 'employee_approval TEXT');

  // Seed default roles if not present
  for (const name of defaultRoles) {
    try {
      await db.run(`INSERT INTO roles (name) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = $1)`, [name]);
    } catch (_) {}
  }
}

module.exports = { migrate };
