import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { getDB, initDB } from '@/lib/db';
import { AppUser } from '@/lib/types';

const SESSION_COOKIE = 'sal_session';

interface DBUserRow {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  subscription_status: 'active' | 'suspended';
  subscription_started_at: string;
  subscription_expires_at: string;
  created_at: string;
  todo_announcement_seen?: boolean;
}

interface RequireUserOptions {
  requireAdmin?: boolean;
  requireSubscription?: boolean;
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'default_secret';
}

function signSession(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

function readSessionCookie(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/sal_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createSessionValue(userId: string) {
  const issuedAt = Date.now().toString();
  const payload = `${userId}:${issuedAt}`;
  return `${payload}:${signSession(payload)}`;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionValue(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export function isSubscriptionActive(user: Pick<AppUser, 'subscription_status' | 'subscription_expires_at'>) {
  const expiresAt = new Date(user.subscription_expires_at).getTime();
  return user.subscription_status === 'active' && Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function normalizeUser(row: DBUserRow): AppUser {
  return {
    ...row,
    isSubscriptionActive: isSubscriptionActive(row),
  };
}

export async function getSessionUser(req: Request): Promise<AppUser | null> {
  await initDB();

  const raw = readSessionCookie(req);
  if (!raw) return null;

  const [userId, issuedAt, signature] = raw.split(':');
  if (!userId || !issuedAt || !signature) return null;

  const payload = `${userId}:${issuedAt}`;
  if (signSession(payload) !== signature) return null;

  const sql = getDB();
  const rows = await sql`
    SELECT id, name, email, role, subscription_status, subscription_started_at, subscription_expires_at, created_at, todo_announcement_seen
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!rows.length) return null;
  return normalizeUser(rows[0] as DBUserRow);
}

export async function requireUser(req: Request, options: RequireUserOptions = {}) {
  const user = await getSessionUser(req);
  if (!user) {
    return {
      response: NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 }),
    };
  }

  if (options.requireAdmin && user.role !== 'admin') {
    return {
      response: NextResponse.json({ error: 'هذه العملية للمشرف فقط' }, { status: 403 }),
    };
  }

  if (options.requireSubscription !== false && user.role !== 'admin' && !user.isSubscriptionActive) {
    return {
      response: NextResponse.json({ error: 'الاشتراك غير مفعل حالياً' }, { status: 403 }),
    };
  }

  return { user };
}
