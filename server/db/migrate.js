#!/usr/bin/env node
const { migrate } = require('./schema');

(async () => {
  try {
    await migrate();
    console.log('[migrate] schema is up to date');
    process.exit(0);
  } catch (err) {
    console.error('[migrate] failed:', err);
    process.exit(1);
  }
})();
