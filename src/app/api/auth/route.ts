import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDB } from '@/lib/db';

// In-memory rate limiter (per IP)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

export async function POST(req: Request) {
  const ip = getClientIP(req);
  const now = Date.now();

  // Check rate limit
  const record = attempts.get(ip);
  if (record) {
    if (now < record.resetAt && record.count >= MAX_ATTEMPTS) {
      const waitMin = Math.ceil((record.resetAt - now) / 60000);
      return NextResponse.json(
        { ok: false, error: `تم تجاوز المحاولات. انتظر ${waitMin} دقيقة.` },
        { status: 429 }
      );
    }
    if (now >= record.resetAt) {
      attempts.delete(ip);
    }
  }

  try {
    const { pin } = await req.json();
    if (!pin || typeof pin !== 'string' || pin.length < 4 || pin.length > 12) {
      return NextResponse.json({ ok: false, error: 'رمز غير صالح' }, { status: 400 });
    }

    const sql = getDB();
    const rows = await sql`SELECT value FROM app_config WHERE key = 'pin_hash'`;

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'لم يتم إعداد الرمز بعد' }, { status: 500 });
    }

    const hash = rows[0].value as string;
    const valid = await bcrypt.compare(pin, hash);

    if (!valid) {
      // Increment attempts
      const cur = attempts.get(ip) || { count: 0, resetAt: now + LOCKOUT_MS };
      cur.count += 1;
      if (cur.count === 1) cur.resetAt = now + LOCKOUT_MS;
      attempts.set(ip, cur);

      const remaining = MAX_ATTEMPTS - cur.count;
      const msg = remaining > 0
        ? `رمز خاطئ. تبقى ${remaining} محاولة`
        : `تم تجاوز المحاولات. انتظر 15 دقيقة`;

      return NextResponse.json({ ok: false, error: msg }, { status: 401 });
    }

    // Success — clear attempts
    attempts.delete(ip);

    // Return a signed token (simple HMAC using SESSION_SECRET)
    const secret = process.env.SESSION_SECRET || 'default_secret';
    const payload = `unlocked:${Date.now()}`;
    const { createHmac } = await import('crypto');
    const token = createHmac('sha256', secret).update(payload).digest('hex');

    const response = NextResponse.json({ ok: true });
    // Set secure httpOnly cookie valid for 8 hours
    response.cookies.set('sal_session', `${payload}:${token}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Verify session cookie
export async function GET(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/sal_session=([^;]+)/);
  if (!match) return NextResponse.json({ valid: false });

  try {
    const raw = decodeURIComponent(match[1]);
    const parts = raw.split(':');
    if (parts.length < 3) return NextResponse.json({ valid: false });

    const token = parts.pop()!;
    const payload = parts.join(':');

    const secret = process.env.SESSION_SECRET || 'default_secret';
    const { createHmac } = await import('crypto');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');

    const valid = token === expected;
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
