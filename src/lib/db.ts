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

  await sql`
    CREATE TABLE IF NOT EXISTS income_sources (
      id VARCHAR(50) PRIMARY KEY,
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'salary',
      expected_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS income_payments (
      id VARCHAR(50) PRIMARY KEY,
      source_id VARCHAR(50) NOT NULL REFERENCES income_sources(id) ON DELETE CASCADE,
      month VARCHAR(7) NOT NULL,
      amount NUMERIC NOT NULL,
      date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS habits (
      id VARCHAR(50) PRIMARY KEY,
      month VARCHAR(7) NOT NULL,
      name VARCHAR(120) NOT NULL,
      icon VARCHAR(20) DEFAULT '✨',
      color VARCHAR(20) DEFAULT '#4f9cf9',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS habit_entries (
      id VARCHAR(80) PRIMARY KEY,
      habit_id VARCHAR(50) NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      month VARCHAR(7) NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (habit_id, date)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS planned_expenses_month_idx ON planned_expenses(month)`;
  await sql`CREATE INDEX IF NOT EXISTS actual_expenses_month_idx ON actual_expenses(month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_sources_month_idx ON income_sources(month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_payments_month_idx ON income_payments(month)`;
  await sql`CREATE INDEX IF NOT EXISTS habits_month_idx ON habits(month)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_entries_month_idx ON habit_entries(month)`;
}
