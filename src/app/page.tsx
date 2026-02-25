'use client';

import { useCallback, useEffect, useState } from 'react';
import { CAT_ICONS, CAT_NAMES, Expense, ExpenseType, IncomeSource, Salary, formatNum, getMonthName } from '@/lib/types';
import ExpenseModal from '@/components/ExpenseModal';
import Toast from '@/components/Toast';
import PinLock from '@/components/PinLock';
import IncomePage from '@/components/IncomePage';

type Page = 'dashboard' | 'income' | 'planned' | 'actual' | 'history' | 'telegram';

interface MonthData {
  salary: Salary | null;
  planned: Expense[];
  actual: Expense[];
  income_sources: IncomeSource[];
}

export default function Home() {
  const [page, setPage] = useState<Page>('dashboard');
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [months, setMonths] = useState<Record<string, MonthData>>({});
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // Salary form
  const [base, setBase] = useState('');
  const [allowances, setAllowances] = useState('');
  const [deductions, setDeductions] = useState('');
  const [salaryNotes, setSalaryNotes] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ExpenseType>('planned');

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

  // ── HELPERS ────────────────────────────────────────────────
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const getMonthData = useCallback((): MonthData => {
    return months[currentMonth] || { salary: null, planned: [], actual: [] };
  }, [months, currentMonth]);

  // ── LOAD ALL DATA ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/months');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMonths(data);
    } catch {
      showToast('خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── THEME ──────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ── SALARY: populate form ──────────────────────────────────
  useEffect(() => {
    const d = getMonthData();
    if (d.salary) {
      setBase(String(d.salary.base || ''));
      setAllowances(String(d.salary.allowances || ''));
      setDeductions(String(d.salary.deductions || ''));
      setSalaryNotes(d.salary.notes || '');
    } else {
      setBase(''); setAllowances(''); setDeductions(''); setSalaryNotes('');
    }
  }, [currentMonth, months, getMonthData]);

  const totalSalary = (parseFloat(base) || 0) + (parseFloat(allowances) || 0) - (parseFloat(deductions) || 0);

  const saveSalary = async () => {
    if (!base) { showToast('أدخل الراتب الأساسي', 'error'); return; }
    try {
      const res = await fetch('/api/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: currentMonth,
          base: parseFloat(base) || 0,
          allowances: parseFloat(allowances) || 0,
          deductions: parseFloat(deductions) || 0,
          total: totalSalary,
          notes: salaryNotes,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('✅ تم حفظ الراتب');
      await loadAll();
    } catch {
      showToast('خطأ في الحفظ', 'error');
    }
  };

  // ── EXPENSES ───────────────────────────────────────────────
  const handleAddExpense = async (data: {
    id: string; name: string; amount: number; category: string; notes: string; date?: string; type: ExpenseType;
  }) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, month: currentMonth }),
      });
      if (!res.ok) throw new Error();
      setModalOpen(false);
      showToast('✅ تم الحفظ');
      await loadAll();
    } catch {
      showToast('خطأ في الحفظ', 'error');
    }
  };

  const deleteExpense = async (id: string, type: ExpenseType) => {
    try {
      const res = await fetch(`/api/expenses?id=${id}&type=${type}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast('🗑️ تم الحذف');
      await loadAll();
    } catch {
      showToast('خطأ في الحذف', 'error');
    }
  };

  // ── DERIVED DATA ───────────────────────────────────────────
  const d = getMonthData();
  const incomeSources: IncomeSource[] = d.income_sources || [];
  const totalIncome = incomeSources.reduce((s, src) => s + Number(src.paid_total ?? 0), 0);
  const totalExpectedIncome = incomeSources.reduce((s, src) => s + Number(src.expected_amount), 0);
  const sal = totalIncome || (d.salary ? Number(d.salary.total) : 0);
  const plannedTotal = d.planned.reduce((s, e) => s + Number(e.amount), 0);
  const actualTotal = d.actual.reduce((s, e) => s + Number(e.amount), 0);
  const balance = sal - actualTotal;
  const pct = sal > 0 ? Math.min(100, Math.round(actualTotal / sal * 100)) : 0;

  // ── RENDER ─────────────────────────────────────────────────
  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '📊', label: 'لوحة التحكم' },
    { id: 'income',    icon: '�', label: 'الدخل' },
    { id: 'planned',   icon: '📋', label: 'المصاريف المتوقعة' },
    { id: 'actual',    icon: '🧾', label: 'المصاريف الفعلية' },
    { id: 'history',   icon: '📅', label: 'السجل الشهري' },
    { id: 'telegram',  icon: '✈️', label: 'بوت تليغرام' },
  ];

  return (
    <>
      {!unlocked && <PinLock onUnlocked={() => setUnlocked(true)} />}

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button className="hamburger" onClick={() => setSidebarOpen(true)}>☰</button>
        <span className="mobile-title">💰 مدير الراتب</span>
        <button className="theme-toggle-mini" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="logo">
          <h1>💰 مدير الراتب</h1>
          <p>تتبع دخلك ومصاريفك</p>
        </div>

        <nav className="nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => { setPage(item.id); setSidebarOpen(false); }}
            >
              <span className="icon">{item.icon}</span> {item.label}
            </div>
          ))}
        </nav>

        <div className="month-selector">
          <label>الشهر الحالي</label>
          <input
            type="month"
            className="form-control"
            value={currentMonth}
            onChange={e => setCurrentMonth(e.target.value)}
          />
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? '☀️' : '🌙'}
            <span>{theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        {loading && (
          <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 300 }}>
            <span className="spinner" />
          </div>
        )}

        {/* Dashboard */}
        <div className={`page${page === 'dashboard' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>لوحة التحكم 📊</h2>
            <p>{getMonthName(currentMonth)} — نظرة عامة</p>
          </div>

          <div className="cards-grid">
            <div className="stat-card blue">
              <div className="stat-label">الدخل المحصّل</div>
              <div className="stat-value blue">{formatNum(sal)}</div>
              <div className="stat-sub">من أصل {formatNum(totalExpectedIncome)}</div>
            </div>
            <div className="stat-card purple">
              <div className="stat-label">المصاريف المتوقعة</div>
              <div className="stat-value purple">{formatNum(plannedTotal)}</div>
              <div className="stat-sub">{d.planned.length} مصروف مخطط</div>
            </div>
            <div className="stat-card red">
              <div className="stat-label">المصاريف الفعلية</div>
              <div className="stat-value red">{formatNum(actualTotal)}</div>
              <div className="stat-sub">{d.actual.length} معاملة</div>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${pct}%`, background: pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--orange)' : 'var(--accent)' }} />
              </div>
            </div>
            <div className={`stat-card ${balance >= 0 ? 'green' : 'red'}`}>
              <div className="stat-label">الرصيد المتبقي</div>
              <div className={`stat-value ${balance >= 0 ? 'green' : 'red'}`}>{formatNum(balance)}</div>
              <div className="stat-sub">{pct}% من الدخل صُرف</div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="panel">
            <div className="panel-header"><h3>توزيع المصاريف الفعلية</h3></div>
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">📊</div><p>لا توجد مصاريف مسجلة هذا الشهر</p></div>
              ) : (() => {
                const cats: Record<string, number> = {};
                d.actual.forEach(e => { cats[e.category] = (cats[e.category] || 0) + Number(e.amount); });
                const maxVal = Math.max(...Object.values(cats));
                return Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>{CAT_ICONS[cat] || '📦'} {CAT_NAMES[cat] || cat}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{formatNum(amt)}</span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${Math.round(amt / maxVal * 100)}%`, background: 'var(--accent)' }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Recent */}
          <div className="panel">
            <div className="panel-header"><h3>آخر المصاريف</h3></div>
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">🧾</div><p>لا توجد مصاريف بعد</p></div>
              ) : [...d.actual].slice(0, 5).map(e => (
                <div key={e.id} className="expense-item">
                  <div className="expense-left">
                    <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                    <div>
                      <div className="expense-name">{e.name}</div>
                      <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.date ? ` · ${e.date}` : ''}</div>
                    </div>
                  </div>
                  <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Income */}
        <div className={`page${page === 'income' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>الدخل �</h2>
            <p>راتب · فريلانس · دخل جانبي</p>
          </div>
          <IncomePage
            month={currentMonth}
            sources={incomeSources}
            onRefresh={loadAll}
            showToast={showToast}
          />
        </div>

        {/* Planned */}
        <div className={`page${page === 'planned' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>المصاريف المتوقعة 📋</h2>
            <p>خطط مصاريفك قبل الشهر</p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>المصاريف المتوقعة</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setModalType('planned'); setModalOpen(true); }}>+ إضافة</button>
            </div>
            <div className="panel-body">
              {d.planned.length === 0 ? (
                <div className="empty-state"><div className="icon">📋</div><p>لا توجد مصاريف متوقعة — أضف واحدة!</p></div>
              ) : (
                <>
                  <div className="summary-bar">
                    <div className="summary-item"><div className="label">إجمالي المتوقع</div><div className="val" style={{ color: 'var(--accent)' }}>{formatNum(plannedTotal)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">عدد المصاريف</div><div className="val">{d.planned.length}</div></div>
                  </div>
                  {d.planned.map(e => (
                    <div key={e.id} className="expense-item">
                      <div className="expense-left">
                        <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                        <div>
                          <div className="expense-name">{e.name}</div>
                          <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.notes ? ` · ${e.notes}` : ''}</div>
                        </div>
                      </div>
                      <div className="expense-right">
                        <span className="expense-amount" style={{ color: 'var(--accent)' }}>{formatNum(Number(e.amount))}</span>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(e.id, 'planned')}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actual */}
        <div className={`page${page === 'actual' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>المصاريف الفعلية 🧾</h2>
            <p>سجل مصاريفك اليومية</p>
          </div>
          <div className="panel">
            <div className="panel-header">
              <h3>المصاريف الفعلية</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setModalType('actual'); setModalOpen(true); }}>+ إضافة مصروف</button>
            </div>
            <div className="panel-body">
              {d.actual.length === 0 ? (
                <div className="empty-state"><div className="icon">🧾</div><p>لا توجد مصاريف — سجل أول مصروف!</p></div>
              ) : (
                <>
                  <div className="summary-bar">
                    <div className="summary-item"><div className="label">إجمالي الفعلي</div><div className="val" style={{ color: 'var(--red)' }}>{formatNum(actualTotal)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">الباقي</div><div className="val" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatNum(balance)}</div></div>
                    <div className="summary-divider" />
                    <div className="summary-item"><div className="label">عدد المصاريف</div><div className="val">{d.actual.length}</div></div>
                  </div>
                  {(() => {
                    const byDate: Record<string, Expense[]> = {};
                    [...d.actual].forEach(e => {
                      const dt = e.date || 'غير محدد';
                      if (!byDate[dt]) byDate[dt] = [];
                      byDate[dt].push(e);
                    });
                    return Object.entries(byDate).map(([date, expenses]) => {
                      const dayTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
                      return (
                        <div key={date} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
                            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{date}</span>
                            <span style={{ fontSize: 12, color: 'var(--red)' }}>{formatNum(dayTotal)}</span>
                          </div>
                          {expenses.map(e => (
                            <div key={e.id} className="expense-item">
                              <div className="expense-left">
                                <div className={`expense-icon cat-${e.category}`}>{CAT_ICONS[e.category] || '📦'}</div>
                                <div>
                                  <div className="expense-name">{e.name}</div>
                                  <div className="expense-cat">{CAT_NAMES[e.category] || 'أخرى'}{e.notes ? ` · ${e.notes}` : ''}</div>
                                </div>
                              </div>
                              <div className="expense-right">
                                <span className="expense-amount" style={{ color: 'var(--red)' }}>{formatNum(Number(e.amount))}</span>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteExpense(e.id, 'actual')}>🗑️</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className={`page${page === 'history' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>السجل الشهري 📅</h2>
            <p>مراجعة كل شهر سابق</p>
          </div>
          <div className="panel">
            <div className="panel-header"><h3>الأشهر السابقة</h3></div>
            <div className="panel-body">
              {Object.keys(months).length === 0 ? (
                <div className="empty-state"><div className="icon">📅</div><p>لا يوجد سجل بعد</p></div>
              ) : Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).map(([m, md]) => {
                const mIncome = (md.income_sources || []).reduce((s: number, src: IncomeSource) => s + Number(src.paid_total ?? 0), 0);
                const mSal = mIncome || (md.salary ? Number(md.salary.total) : 0);
                const mActual = md.actual.reduce((s, e) => s + Number(e.amount), 0);
                const mBal = mSal - mActual;
                return (
                  <div key={m} className="history-month" onClick={() => { setCurrentMonth(m); setPage('dashboard'); }}>
                    <div>
                      <div className="name">{getMonthName(m)}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>� {formatNum(mSal)} دخل · {md.actual.length} مصروف</div>
                    </div>
                    <div className="stats">
                      <span style={{ color: 'var(--red)' }}>صُرف {formatNum(mActual)}</span>
                      <span style={{ color: mBal >= 0 ? 'var(--green)' : 'var(--red)' }}>متبقي {formatNum(mBal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div className={`page${page === 'telegram' ? ' active fade-in' : ''}`}>
          <div className="page-header">
            <h2>بوت تليغرام ✈️</h2>
            <p>تحكم في مصاريفك من تليغرام</p>
          </div>

          <div className="telegram-card">
            <h3>🤖 كيف تربط البوت؟</h3>
            <p>اتبع الخطوات التالية لإعداد بوت تليغرام يتصل بنظام إدارة راتبك:</p>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>الخطوة 1: إنشاء البوت</h3></div>
            <div className="panel-body">
              <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.8 }}>
                1. افتح تليغرام وابحث عن <strong style={{ color: 'var(--accent)' }}>@BotFather</strong><br />
                2. اكتب <code style={{ background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>/newbot</code><br />
                3. أعطه اسم للبوت مثل &quot;Salary Manager Bot&quot;<br />
                4. احفظ الـ <strong style={{ color: 'var(--accent)' }}>API Token</strong> الذي سيعطيك إياه
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><h3>أوامر البوت</h3></div>
            <div className="panel-body">
              {[
                { icon: '📝', cmd: '/salary 5000', desc: 'تسجيل راتب الشهر', cat: 'cat-food' },
                { icon: '💸', cmd: '/spend 50 غداء', desc: 'تسجيل مصروف فعلي', cat: 'cat-transport' },
                { icon: '📋', cmd: '/plan 300 ايجار', desc: 'إضافة مصروف متوقع', cat: 'cat-bills' },
                { icon: '📊', cmd: '/summary', desc: 'ملخص الشهر كاملاً', cat: 'cat-health' },
                { icon: '💰', cmd: '/balance', desc: 'الرصيد المتبقي', cat: 'cat-entertainment' },
                { icon: '🗓️', cmd: '/today', desc: 'مصاريف اليوم فقط', cat: 'cat-other' },
              ].map(item => (
                <div key={item.cmd} className="expense-item">
                  <div className="expense-left">
                    <div className={`expense-icon ${item.cat}`}>{item.icon}</div>
                    <div>
                      <div className="expense-name">{item.cmd}</div>
                      <div className="expense-cat">{item.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      <ExpenseModal
        isOpen={modalOpen}
        type={modalType}
        onClose={() => setModalOpen(false)}
        onSave={handleAddExpense}
      />

      {/* Toast */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </>
  );
}
