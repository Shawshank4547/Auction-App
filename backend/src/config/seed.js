require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('./database');

async function seed() {
  try {
    console.log('Seeding database...');

    // Create super admin
    const hash = await bcrypt.hash('Admin@123', 12);
    await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['admin@auctionpro.com', hash, 'Super Admin', 'super_admin']
    );

    // Create organizer
    const orgHash = await bcrypt.hash('Organizer@123', 12);
    await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['organizer@auctionpro.com', orgHash, 'Test Organizer', 'organizer']
    );

    // Create bidder
    const bidHash = await bcrypt.hash('Bidder@123', 12);
    await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      ['bidder@auctionpro.com', bidHash, 'Test Bidder', 'bidder']
    );

    console.log('Seed complete!');
    console.log('');
    console.log('Test accounts:');
    console.log('  Super Admin:  admin@auctionpro.com / Admin@123');
    console.log('  Organizer:    organizer@auctionpro.com / Organizer@123');
    console.log('  Bidder:       bidder@auctionpro.com / Bidder@123');
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await pool.end();
  }
}

seed();
