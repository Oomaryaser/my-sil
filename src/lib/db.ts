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
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
      subscription_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      subscription_expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id VARCHAR(60) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      details TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT DEFAULT 'راح تصير هاي الخاصية خلال أقل من يوم.',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

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
      icon VARCHAR(20) DEFAULT 'sparkles',
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

  await sql`ALTER TABLE salaries ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE planned_expenses ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE actual_expenses ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE income_payments ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS user_id VARCHAR(50) REFERENCES users(id) ON DELETE CASCADE`;

  await sql`ALTER TABLE salaries DROP CONSTRAINT IF EXISTS salaries_month_key`;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS salaries_user_month_idx ON salaries(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS users_email_idx ON users(email)`;
  await sql`CREATE INDEX IF NOT EXISTS feature_requests_user_idx ON feature_requests(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS feature_requests_status_idx ON feature_requests(status)`;
  await sql`CREATE INDEX IF NOT EXISTS salaries_user_month_lookup_idx ON salaries(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS planned_expenses_user_month_idx ON planned_expenses(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS actual_expenses_user_month_idx ON actual_expenses(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_sources_user_month_idx ON income_sources(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_payments_user_month_idx ON income_payments(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS habits_user_month_idx ON habits(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_entries_user_month_idx ON habit_entries(user_id, month)`;
  await sql`CREATE INDEX IF NOT EXISTS planned_expenses_month_idx ON planned_expenses(month)`;
  await sql`CREATE INDEX IF NOT EXISTS actual_expenses_month_idx ON actual_expenses(month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_sources_month_idx ON income_sources(month)`;
  await sql`CREATE INDEX IF NOT EXISTS income_payments_month_idx ON income_payments(month)`;
  await sql`CREATE INDEX IF NOT EXISTS habits_month_idx ON habits(month)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_entries_month_idx ON habit_entries(month)`;
  await sql`ALTER TABLE habits ALTER COLUMN icon SET DEFAULT 'sparkles'`;
}

export async function claimLegacyDataForUser(userId: string) {
  const sql = getDB();

  await sql`UPDATE salaries SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE planned_expenses SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE actual_expenses SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE income_sources SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE income_payments SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE habits SET user_id = ${userId} WHERE user_id IS NULL`;
  await sql`UPDATE habit_entries SET user_id = ${userId} WHERE user_id IS NULL`;
}
