// Run this once: node src/config/migrate_auth.js
// Adds Google OAuth and OTP columns to the users table

require('dotenv').config();
const { pool } = require('./database');

const migration = `
  -- Add Google OAuth support
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';

  -- OTP verification
  ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

  -- Make password_hash nullable (Google users won't have one)
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

  -- Index for google_id lookups
  CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running auth migration...');
    await client.query(migration);
    console.log('Auth migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();