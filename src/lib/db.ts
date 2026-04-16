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
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      subscription_status VARCHAR(20) NOT NULL DEFAULT 'active',
      subscription_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      subscription_expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
      todo_announcement_seen BOOLEAN NOT NULL DEFAULT FALSE,
      groq_api_key_encrypted TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS todo_announcement_seen BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS groq_api_key_encrypted TEXT
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS salaries (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(64),
      month VARCHAR(7) NOT NULL UNIQUE,
      base NUMERIC NOT NULL DEFAULT 0,
      allowances NUMERIC NOT NULL DEFAULT 0,
      deductions NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE salaries ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`ALTER TABLE salaries DROP CONSTRAINT IF EXISTS salaries_month_key`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS salaries_user_month_uidx ON salaries (user_id, month)`;

  await sql`
    CREATE TABLE IF NOT EXISTS planned_expenses (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(64),
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE planned_expenses ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS planned_expenses_user_month_idx ON planned_expenses (user_id, month)`;

  await sql`
    CREATE TABLE IF NOT EXISTS actual_expenses (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(64),
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      notes TEXT,
      date DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE actual_expenses ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`ALTER TABLE actual_expenses ADD COLUMN IF NOT EXISTS epic_goal_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS actual_expenses_user_month_idx ON actual_expenses (user_id, month, date)`;
  await sql`CREATE INDEX IF NOT EXISTS actual_expenses_goal_idx ON actual_expenses (user_id, epic_goal_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS epic_goals (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      name VARCHAR(255) NOT NULL,
      target_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE epic_goals ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS epic_goals_user_idx ON epic_goals (user_id, created_at ASC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS epic_goal_allocations (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      epic_goal_id VARCHAR(64) NOT NULL,
      month VARCHAR(7) NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE epic_goal_allocations ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS epic_goal_allocations_user_month_idx ON epic_goal_allocations (user_id, month, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS epic_goal_allocations_goal_idx ON epic_goal_allocations (user_id, epic_goal_id, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS surplus_adjustments (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      allocation_id VARCHAR(64),
      month VARCHAR(7) NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE surplus_adjustments ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`ALTER TABLE surplus_adjustments ADD COLUMN IF NOT EXISTS allocation_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS surplus_adjustments_user_month_idx ON surplus_adjustments (user_id, month, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS surplus_adjustments_allocation_idx ON surplus_adjustments (user_id, allocation_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS income_sources (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'salary',
      expected_amount NUMERIC NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS income_sources_user_month_idx ON income_sources (user_id, month)`;

  await sql`
    CREATE TABLE IF NOT EXISTS income_payments (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      source_id VARCHAR(64) NOT NULL,
      month VARCHAR(7) NOT NULL,
      amount NUMERIC NOT NULL,
      date DATE,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE income_payments ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS income_payments_user_month_idx ON income_payments (user_id, month, date)`;
  await sql`CREATE INDEX IF NOT EXISTS income_payments_source_idx ON income_payments (source_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS habits (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      month VARCHAR(7) NOT NULL,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(50) DEFAULT 'sparkles',
      color VARCHAR(20) DEFAULT '#4f9cf9',
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS habits_user_month_idx ON habits (user_id, month)`;

  await sql`
    CREATE TABLE IF NOT EXISTS habit_entries (
      id VARCHAR(80) PRIMARY KEY,
      user_id VARCHAR(64),
      habit_id VARCHAR(64) NOT NULL,
      month VARCHAR(7) NOT NULL,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE habit_entries ADD COLUMN IF NOT EXISTS user_id VARCHAR(64)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_entries_user_month_idx ON habit_entries (user_id, month, date)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_entries_habit_idx ON habit_entries (habit_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS feature_requests (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      details TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT DEFAULT 'راح تصير هاي الخاصية خلال أقل من يوم.',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS feature_requests_user_idx ON feature_requests (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS feature_requests_status_idx ON feature_requests (status, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS todos (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      notes TEXT,
      due_date DATE,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS todos_user_completed_idx ON todos (user_id, completed, created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS freelance_clients (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      parent_id VARCHAR(64),
      color VARCHAR(20) DEFAULT '#a78bfa',
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS freelance_clients_user_idx ON freelance_clients (user_id, created_at ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS freelance_clients_parent_idx ON freelance_clients (parent_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS freelance_jobs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      title VARCHAR(255) NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      month VARCHAR(7) NOT NULL,
      work_date DATE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
      payment_date DATE,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS freelance_jobs_user_month_idx ON freelance_jobs (user_id, month, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS freelance_jobs_client_idx ON freelance_jobs (client_id, created_at DESC)`;

  const ownerRows = await sql`
    SELECT id
    FROM users
    WHERE LOWER(email) = ${'omar@ratbi.app'}
    LIMIT 1
  `;

  if (ownerRows.length) {
    const ownerId = ownerRows[0].id as string;
    await sql`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = ${ownerId}`;

    await sql`UPDATE salaries SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE planned_expenses SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE actual_expenses SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE income_sources SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE income_payments SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE habits SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE habit_entries SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE epic_goals SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE epic_goal_allocations SET user_id = ${ownerId} WHERE user_id IS NULL`;
    await sql`UPDATE surplus_adjustments SET user_id = ${ownerId} WHERE user_id IS NULL`;
  }
}
