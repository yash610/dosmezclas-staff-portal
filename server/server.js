require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { migrate } = require('./db/schema');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const scheduleRoutes = require('./routes/schedules');
const availabilityRoutes = require('./routes/availability');
const requestRoutes = require('./routes/requests');
const reportRoutes = require('./routes/reports');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : true; // allow all in dev

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Dos Mezclas Scheduler' }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

// Memoised migration — Vercel cold-starts run it once per instance
let migrated = false;
async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  // Local dev — start the HTTP server directly
  (async () => {
    try {
      await ensureMigrated();
      app.listen(PORT, () => {
        console.log(`Dos Mezclas Scheduler API listening on http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error('Failed to start:', err);
      process.exit(1);
    }
  })();
} else {
  // Vercel serverless — export an async handler that migrates on first request
  module.exports = async (req, res) => {
    await ensureMigrated();
    app(req, res);
  };
}
