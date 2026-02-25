'use client';
import { useState, useEffect, useRef } from 'react';

interface Props {
  onUnlocked: () => void;
}

export default function PinLock({ onUnlocked }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [lockedOut, setLockedOut] = useState(false);
  const didCheck = useRef(false);

  // On mount: verify session cookie with server
  useEffect(() => {
    if (didCheck.current) return;
    didCheck.current = true;
    fetch('/api/auth')
      .then(r => r.json())
      .then(data => {
        if (data.valid) onUnlocked();
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [onUnlocked]);

  const MAX_DIGITS = 6;

  function handleDigit(d: string) {
    if (loading || lockedOut) return;
    if (digits.length < MAX_DIGITS) {
      const next = [...digits, d];
      setDigits(next);
      if (next.length === MAX_DIGITS) submitPin(next.join(''));
    }
  }

  function handleDelete() {
    if (loading || lockedOut) return;
    setDigits(prev => prev.slice(0, -1));
    setError('');
  }

  async function submitPin(pin: string) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) {
        onUnlocked();
      } else {
        setShake(true);
        setDigits([]);
        setError(data.error || 'رمز خاطئ');
        if (res.status === 429) setLockedOut(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      setError('خطأ في الاتصال');
      setDigits([]);
    } finally {
      setLoading(false);
    }
  }

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  if (checking) {
    return (
      <div className="pin-overlay">
        <div className="pin-box">
          <div className="pin-logo">💰</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>جارٍ التحقق…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-overlay">
      <div className={`pin-box${shake ? ' pin-shake' : ''}`}>
        <div className="pin-logo">💰</div>
        <h2 className="pin-title">مدير الراتب</h2>
        <p className="pin-subtitle">أدخل رمز الدخول</p>

        {/* Dots indicator */}
        <div className="pin-dots">
          {Array.from({ length: MAX_DIGITS }).map((_, i) => (
            <div key={i} className={`pin-dot${i < digits.length ? ' filled' : ''}`} />
          ))}
        </div>

        {error && <p className="pin-error">{error}</p>}

        {/* Numpad */}
        <div className="pin-numpad">
          {keys.map((k, i) => (
            k === '' ? (
              <span key={i} className="pin-key pin-key-empty" />
            ) : k === '⌫' ? (
              <button
                key={i}
                className="pin-key pin-key-del"
                onClick={handleDelete}
                disabled={loading || lockedOut}
                aria-label="حذف"
              >
                ⌫
              </button>
            ) : (
              <button
                key={i}
                className="pin-key"
                onClick={() => handleDigit(k)}
                disabled={loading || lockedOut}
              >
                {k}
              </button>
            )
          ))}
        </div>

        {loading && <p className="pin-subtitle">جارٍ التحقق…</p>}
        {lockedOut && (
          <p className="pin-error">🔒 الحساب مقفل مؤقتاً. حاول بعد 15 دقيقة.</p>
        )}
      </div>
    </div>
  );
}
