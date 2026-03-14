import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getDB, initDB } from '@/lib/db';
import { encryptUserSecret } from '@/lib/user-secrets';

function isLikelyGroqKey(value: string) {
  return value.startsWith('gsk_') && value.length >= 24;
}

export async function GET(req: Request) {
  const auth = await requireUser(req, { requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const rows = await sql`
      SELECT groq_api_key_encrypted
      FROM users
      WHERE id = ${auth.user.id}
      LIMIT 1
    `;

    return NextResponse.json({
      hasGroqApiKey: Boolean(rows[0]?.groq_api_key_encrypted),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req, { requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();
    const body = await req.json();
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!isLikelyGroqKey(apiKey)) {
      return NextResponse.json({ error: 'مفتاح Groq غير صالح. تأكد أنه يبدأ بـ gsk_' }, { status: 400 });
    }

    await sql`
      UPDATE users
      SET groq_api_key_encrypted = ${encryptUserSecret(apiKey)}, updated_at = NOW()
      WHERE id = ${auth.user.id}
    `;

    return NextResponse.json({ ok: true, hasGroqApiKey: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req, { requireSubscription: false });
  if ('response' in auth) return auth.response;

  try {
    await initDB();
    const sql = getDB();

    await sql`
      UPDATE users
      SET groq_api_key_encrypted = NULL, updated_at = NOW()
      WHERE id = ${auth.user.id}
    `;

    return NextResponse.json({ ok: true, hasGroqApiKey: false });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
