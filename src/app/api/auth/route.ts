import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';
import { clearSessionCookie, getSessionUser, normalizeUser, setSessionCookie } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';

const OWNER_EMAIL = 'omar@ratbi.app';

interface DBAuthRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'user';
  subscription_status: 'active' | 'suspended';
  subscription_started_at: string;
  subscription_expires_at: string;
  created_at: string;
  todo_announcement_seen?: boolean;
  groq_api_key_encrypted?: string | null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function consumeTodoAnnouncement(userId: string) {
  const sql = getDB();
  const rows = await sql`
    UPDATE users
    SET todo_announcement_seen = TRUE, updated_at = NOW()
    WHERE id = ${userId} AND todo_announcement_seen = FALSE
    RETURNING id
  `;
  return rows.length > 0;
}

export async function POST(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();

    const action = typeof body.action === 'string' ? body.action : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const rawEmail = typeof body.email === 'string' ? body.email : '';
    const email = normalizeEmail(rawEmail);
    const password = typeof body.password === 'string' ? body.password : '';

    if (action !== 'login' && action !== 'register') {
      return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صالح' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف أو أكثر' }, { status: 400 });
    }

    if (action === 'register') {
      if (name.length < 2) {
        return NextResponse.json({ error: 'الاسم غير صالح' }, { status: 400 });
      }

      const exists = await sql`
        SELECT id
        FROM users
        WHERE LOWER(email) = ${email}
        LIMIT 1
      `;

      if (exists.length > 0) {
        return NextResponse.json({ error: 'البريد مستخدم مسبقاً' }, { status: 409 });
      }

      const id = randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const expires = new Date(now);
      expires.setFullYear(expires.getFullYear() + 1);
      const role: 'admin' | 'user' = email === OWNER_EMAIL ? 'admin' : 'user';

      const inserted = await sql`
        INSERT INTO users (
          id,
          name,
          email,
          password_hash,
          role,
          subscription_status,
          subscription_started_at,
          subscription_expires_at
        )
        VALUES (
          ${id},
          ${name},
          ${email},
          ${passwordHash},
          ${role},
          'active',
          ${now.toISOString()}::timestamp,
          ${expires.toISOString()}::timestamp
        )
        RETURNING id, name, email, role, subscription_status, subscription_started_at, subscription_expires_at, created_at, todo_announcement_seen, groq_api_key_encrypted
      `;

      const user = normalizeUser(inserted[0] as DBAuthRow);
      const showTodoAnnouncement = await consumeTodoAnnouncement(user.id);
      const response = NextResponse.json({ user, showTodoAnnouncement });
      setSessionCookie(response, user.id);
      return response;
    }

    const rows = await sql`
      SELECT id, name, email, password_hash, role, subscription_status, subscription_started_at, subscription_expires_at, created_at, todo_announcement_seen, groq_api_key_encrypted
      FROM users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;

    if (!rows.length) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    const dbUser = rows[0] as DBAuthRow;
    const validPassword = await bcrypt.compare(password, dbUser.password_hash);
    if (!validPassword) {
      return NextResponse.json({ error: 'بيانات الدخول غير صحيحة' }, { status: 401 });
    }

    let finalRole = dbUser.role;
    if (email === OWNER_EMAIL && dbUser.role !== 'admin') {
      await sql`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = ${dbUser.id}`;
      finalRole = 'admin';
    }

    const user = normalizeUser({
      ...dbUser,
      role: finalRole,
    });
    const showTodoAnnouncement = await consumeTodoAnnouncement(user.id);

    const response = NextResponse.json({ user, showTodoAnnouncement });
    setSessionCookie(response, user.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await initDB();
    const sql = getDB();
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return NextResponse.json({ authenticated: false, user: null, showTodoAnnouncement: false });
    }

    let role = sessionUser.role;
    if (normalizeEmail(sessionUser.email) === OWNER_EMAIL && sessionUser.role !== 'admin') {
      await sql`UPDATE users SET role = 'admin', updated_at = NOW() WHERE id = ${sessionUser.id}`;
      role = 'admin';
    }

    const user = {
      ...sessionUser,
      role,
      isSubscriptionActive:
        role === 'admin'
          ? true
          : sessionUser.subscription_status === 'active' &&
            new Date(sessionUser.subscription_expires_at).getTime() > Date.now(),
    };
    const showTodoAnnouncement = await consumeTodoAnnouncement(user.id);

    return NextResponse.json({
      authenticated: true,
      user,
      showTodoAnnouncement,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, user: null, error: String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
