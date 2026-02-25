'use client';

import { useState } from 'react';
import { IncomeSource, IncomePayment, IncomeType, INCOME_TYPE_LABEL, INCOME_TYPE_COLOR, formatNum } from '@/lib/types';

interface Props {
  month: string;
  sources: IncomeSource[];
  onRefresh: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function IncomePage({ month, sources, onRefresh, showToast }: Props) {
  const [showAddSource, setShowAddSource] = useState(false);
  const [showPaymentFor, setShowPaymentFor] = useState<string | null>(null);

  // Add source form
  const [srcName, setSrcName] = useState('');
  const [srcType, setSrcType] = useState<IncomeType>('salary');
  const [srcExpected, setSrcExpected] = useState('');
  const [srcNotes, setSrcNotes] = useState('');

  // Add payment form
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNotes, setPayNotes] = useState('');

  const totalExpected = sources.reduce((s, src) => s + Number(src.expected_amount), 0);
  const totalPaid = sources.reduce((s, src) => s + Number(src.paid_total ?? 0), 0);

  const addSource = async () => {
    if (!srcName.trim() || !srcExpected) { showToast('أدخل الاسم والمبلغ', 'error'); return; }
    const res = await fetch('/api/income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Date.now().toString(),
        month,
        name: srcName.trim(),
        type: srcType,
        expected_amount: parseFloat(srcExpected),
        notes: srcNotes,
      }),
    });
    if (!res.ok) { showToast('خطأ في الحفظ', 'error'); return; }
    setSrcName(''); setSrcExpected(''); setSrcNotes(''); setShowAddSource(false);
    showToast('✅ تم إضافة المصدر');
    onRefresh();
  };

  const deleteSource = async (id: string) => {
    await fetch(`/api/income?id=${id}`, { method: 'DELETE' });
    showToast('🗑️ تم الحذف');
    onRefresh();
  };

  const addPayment = async (sourceId: string) => {
    if (!payAmount) { showToast('أدخل المبلغ', 'error'); return; }
    const res = await fetch('/api/income/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: Date.now().toString(),
        source_id: sourceId,
        month,
        amount: parseFloat(payAmount),
        date: payDate,
        notes: payNotes,
      }),
    });
    if (!res.ok) { showToast('خطأ', 'error'); return; }
    setPayAmount(''); setPayNotes(''); setShowPaymentFor(null);
    showToast('✅ تم تسجيل الدفعة');
    onRefresh();
  };

  const deletePayment = async (id: string) => {
    await fetch(`/api/income/payment?id=${id}`, { method: 'DELETE' });
    showToast('🗑️ تم حذف الدفعة');
    onRefresh();
  };

  return (
    <div>
      {/* Summary */}
      <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-label">إجمالي المتوقع</div>
          <div className="stat-value blue">{formatNum(totalExpected)}</div>
          <div className="stat-sub">{sources.length} مصدر دخل</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">المحصّل فعلاً</div>
          <div className="stat-value green">{formatNum(totalPaid)}</div>
          <div className="stat-sub">من أصل {formatNum(totalExpected)}</div>
        </div>
        <div className={`stat-card ${totalExpected - totalPaid > 0 ? 'red' : 'green'}`}>
          <div className="stat-label">المتبقي لاستلامه</div>
          <div className={`stat-value ${totalExpected - totalPaid > 0 ? 'red' : 'green'}`}>
            {formatNum(totalExpected - totalPaid)}
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{
              width: totalExpected > 0 ? `${Math.min(100, Math.round(totalPaid / totalExpected * 100))}%` : '0%',
              background: 'var(--green)'
            }} />
          </div>
        </div>
      </div>

      {/* Sources list */}
      <div className="panel">
        <div className="panel-header">
          <h3>مصادر الدخل</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddSource(v => !v)}>
            {showAddSource ? '✕ إلغاء' : '+ إضافة مصدر'}
          </button>
        </div>

        {/* Add source form */}
        {showAddSource && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div className="form-row">
              <div className="form-group">
                <label>اسم المصدر *</label>
                <input className="form-control" value={srcName} onChange={e => setSrcName(e.target.value)} placeholder="مثل: شركة X، مشروع Y" autoFocus />
              </div>
              <div className="form-group">
                <label>النوع</label>
                <select className="form-control" value={srcType} onChange={e => setSrcType(e.target.value as IncomeType)}>
                  <option value="salary">💵 راتب</option>
                  <option value="freelance">💻 فريلانس</option>
                  <option value="side">⚡ دخل جانبي</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>المبلغ المتوقع *</label>
                <input type="number" className="form-control" value={srcExpected} onChange={e => setSrcExpected(e.target.value)} placeholder="مثل: 3000" />
              </div>
              <div className="form-group">
                <label>ملاحظات</label>
                <input className="form-control" value={srcNotes} onChange={e => setSrcNotes(e.target.value)} placeholder="اختياري" />
              </div>
            </div>
            <button className="btn btn-primary" onClick={addSource}>💾 حفظ المصدر</button>
          </div>
        )}

        <div className="panel-body">
          {sources.length === 0 ? (
            <div className="empty-state"><div className="icon">💰</div><p>لا توجد مصادر دخل — أضف واحداً!</p></div>
          ) : sources.map(src => {
            const paid = Number(src.paid_total ?? 0);
            const expected = Number(src.expected_amount);
            const remaining = expected - paid;
            const pct = expected > 0 ? Math.min(100, Math.round(paid / expected * 100)) : 0;

            return (
              <div key={src.id} style={{ marginBottom: 16, background: 'var(--surface2)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border)' }}>
                {/* Source header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: INCOME_TYPE_COLOR[src.type as IncomeType] }}>
                        {INCOME_TYPE_LABEL[src.type as IncomeType]}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{src.name}</span>
                    </div>
                    {src.notes && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{src.notes}</div>}
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSource(src.id)}>🗑️</button>
                </div>

                {/* Amounts row */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>المتوقع</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{formatNum(expected)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>المحصّل</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{formatNum(paid)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>المتبقي</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: remaining > 0 ? 'var(--orange)' : 'var(--green)' }}>{formatNum(remaining)}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'flex-end', marginBottom: 2 }}>{pct}%</div>
                </div>

                {/* Progress */}
                <div className="progress-wrap" style={{ marginBottom: 12 }}>
                  <div className="progress-bar" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} />
                </div>

                {/* Payments list */}
                {src.payments && src.payments.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>الدفعات المستلمة:</div>
                    {src.payments.map((p: IncomePayment) => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>+{formatNum(Number(p.amount))}</span>
                          {p.date && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.date}</span>}
                          {p.notes && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.notes}</span>}
                        </div>
                        <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => deletePayment(p.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add payment */}
                {showPaymentFor === src.id ? (
                  <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)' }}>
                    <div className="form-row" style={{ marginBottom: 10 }}>
                      <div className="form-group">
                        <label>المبلغ المستلم *</label>
                        <input type="number" className="form-control" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="مثل: 1500" autoFocus />
                      </div>
                      <div className="form-group">
                        <label>التاريخ</label>
                        <input type="date" className="form-control" value={payDate} onChange={e => setPayDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label>ملاحظات</label>
                      <input className="form-control" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="اختياري" />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => addPayment(src.id)}>✅ تسجيل</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowPaymentFor(null)}>إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }} onClick={() => { setShowPaymentFor(src.id); setPayAmount(''); setPayNotes(''); setPayDate(new Date().toISOString().slice(0,10)); }}>
                    + تسجيل دفعة مستلمة
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
