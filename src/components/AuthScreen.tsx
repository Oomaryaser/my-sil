'use client';

import { FormEvent, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { AppUser } from '@/lib/types';

interface Props {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAuthenticated: (payload: { user: AppUser; showTodoAnnouncement?: boolean }) => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

type Mode = 'login' | 'register';

export default function AuthScreen({ theme, onToggleTheme, onAuthenticated, showToast }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isRegister && name.trim().length < 2) {
      showToast('اكتب اسمك بشكل صحيح', 'error');
      return;
    }

    if (!email.trim() || !password) {
      showToast('البريد وكلمة المرور مطلوبان', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          name,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'تعذر إكمال العملية', 'error');
        return;
      }

      onAuthenticated({
        user: data.user as AppUser,
        showTodoAnnouncement: Boolean(data.showTodoAnnouncement),
      });
      showToast(isRegister ? 'تم إنشاء الحساب' : 'تم تسجيل الدخول');
    } catch {
      showToast('تعذر الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', padding: 20, background: 'var(--bg)',
      position: 'fixed', inset: 0, zIndex: 1000,
    }}>
      <button
        className="theme-float"
        onClick={onToggleTheme}
        aria-label="تبديل الثيم"
        style={{
          position: 'fixed', top: 16, left: 16, background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: 10,
          padding: '6px 14px', fontSize: 13, color: 'var(--text)', cursor: 'pointer',
        }}
      >
        <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
      </button>

      <div className="fade-in" style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '36px 28px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--accent)' }}>
          <AppIcon name="logo" size={34} strokeWidth={1.6} />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>مدير الراتب</h1>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>سجّل دخولك للمتابعة</p>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 0, marginBottom: 24,
          background: 'var(--surface2)', borderRadius: 12, padding: 4,
          border: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setMode('login')}
            type="button"
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all .2s',
              background: mode === 'login' ? 'var(--accent)' : 'transparent',
              color: mode === 'login' ? '#fff' : 'var(--muted)',
            }}
          >
            تسجيل الدخول
          </button>
          <button
            onClick={() => setMode('register')}
            type="button"
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all .2s',
              background: mode === 'register' ? 'var(--accent)' : 'transparent',
              color: mode === 'register' ? '#fff' : 'var(--muted)',
            }}
          >
            إنشاء حساب
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>الاسم</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسم المستخدم"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>البريد الإلكتروني</label>
            <input
              className="form-control"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>كلمة المرور</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 أحرف أو أكثر"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          <button
            className="btn btn-primary btn-with-icon"
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 700, borderRadius: 12, marginTop: 4 }}
          >
            <AppIcon name={loading ? 'clock' : isRegister ? 'plus' : 'lock'} size={16} />
            <span>{loading ? 'جارٍ التنفيذ...' : isRegister ? 'إنشاء الحساب' : 'دخول'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
