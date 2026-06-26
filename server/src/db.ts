import dotenv from 'dotenv';
import knex, { Knex } from 'knex';

dotenv.config();

// Configure Knex to connect to Supabase PostgreSQL using connection string
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('WARNING: DATABASE_URL environment variable is not defined!');
}

export const db: Knex = knex({
  client: 'pg',
  connection: {
    connectionString,
    ssl: connectionString && (connectionString.includes('supabase') || connectionString.includes('localhost') === false)
      ? { rejectUnauthorized: false }
      : false,
  },
  pool: {
    min: 2,
    max: 10,
  }
});

export async function initDb() {
  console.log('Database initialization: checking connection to PostgreSQL...');
  try {
    await db.raw('SELECT 1');
    console.log('Database connection verified successfully.');
  } catch (err) {
    console.error('Database connection failed! Ensure DATABASE_URL is set correctly in your environment variables.');
    console.error(err);
  }
}
