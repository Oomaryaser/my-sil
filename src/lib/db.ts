import { neon } from '@neondatabase/serverless';

export function getDB() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Please add it to .env.local');
  }
  return neon(process.env.DATABASE_URL);
}

export async function initDB() {
  const sql = getDB();

  await sql`
    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      month VARCHAR(7) NOT NULL UNIQUE,
      base NUMERIC NOT NULL DEFAULT 0,
      allowances NUMERIC NOT NULL DEFAULT 0,
      deductions NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS planned_expenses (
      id VARCHAR(50) PRIMARY KEY,
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS actual_expenses (
      id VARCHAR(50) PRIMARY KEY,
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
}
