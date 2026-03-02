import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionUser, normalizeUser, setSessionCookie } from '@/lib/auth';
import { claimLegacyDataForUser, getDB, initDB } from '@/lib/db';

interface AuthUserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  subscription_status: 'active' | 'suspended';
  subscription_started_at: string;
  subscription_expires_at: string;
  created_at: string;
}

const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAdminEmail(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(adminEmail) && adminEmail === normalizeEmail(email);
}

async function registerUser(body: Record<string, unknown>) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (name.length < 2) {
    return NextResponse.json({ error: 'الاسم يجب أن يكون حرفين أو أكثر' }, { status: 400 });
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'البريد الإلكتروني غير صالح' }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' }, { status: 400 });
  }

  await initDB();
  const sql = getDB();

  const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length > 0) {
    return NextResponse.json({ error: 'هذا البريد مسجل بالفعل' }, { status: 409 });
  }

  const countRows = await sql`SELECT COUNT(*)::int AS count FROM users`;
  const isFirstUser = Number(countRows[0]?.count || 0) === 0;
  const role = isFirstUser || isAdminEmail(email) ? 'admin' : 'user';
  const userId = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  const rows = await sql`
    INSERT INTO users (
      id,
      name,
      email,
      password_hash,
      role,
      subscription_status,
      subscription_started_at,
      subscription_expires_at,
      updated_at
    )
    VALUES (
      ${userId},
      ${name},
      ${email},
      ${passwordHash},
      ${role},
      'active',
      NOW(),
      NOW() + INTERVAL '1 year',
      NOW()
    )
    RETURNING id, name, email, role, subscription_status, subscription_started_at, subscription_expires_at, created_at
  `;

  if (isFirstUser) {
    await claimLegacyDataForUser(userId);
  }

  const response = NextResponse.json({ ok: true, user: normalizeUser(rows[0] as AuthUserRow) });
  setSessionCookie(response, userId);
  return response;
}

async function loginUser(body: Record<string, unknown>) {
  const email = typeof body.email === 'string' ? normalizeEmail(body.email) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'البريد وكلمة المرور مطلوبان' }, { status: 400 });
  }

  await initDB();
  const sql = getDB();
  const rows = await sql`
    SELECT id, name, email, password_hash, role, subscription_status, subscription_started_at, subscription_expires_at, created_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
  }

  const user = rows[0] as AuthUserRow & { password_hash: string };

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return NextResponse.json({ error: 'كلمة المرور غير صحيحة' }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    user: normalizeUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription_status: user.subscription_status,
      subscription_started_at: user.subscription_started_at,
      subscription_expires_at: user.subscription_expires_at,
      created_at: user.created_at,
    }),
  });
  setSessionCookie(response, user.id);
  return response;
}

export async function GET(req: Request) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({ authenticated: true, user });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'register') return registerUser(body);
    if (action === 'login') return loginUser(body);

    return NextResponse.json({ error: 'الإجراء غير مدعوم' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
