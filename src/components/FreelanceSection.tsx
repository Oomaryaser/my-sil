'use client';

import { useState, useCallback, useEffect } from 'react';
import AppIcon from '@/components/AppIcon';
import { FreelanceClient, FreelanceJob, formatNum, formatDate, getDayName } from '@/lib/types';

interface Props {
  currentMonth: string;
  refreshKey?: number;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const CLIENT_COLORS = [
  '#a78bfa', '#60a5fa', '#34d399', '#f59e0b',
  '#f87171', '#fb923c', '#c084fc', '#22d3ee',
];

export default function FreelanceSection({ currentMonth, refreshKey, showToast }: Props) {
  const [clients, setClients] = useState<FreelanceClient[]>([]);
  const [jobs, setJobs] = useState<FreelanceJob[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());


  // Add client form
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientParentId, setNewClientParentId] = useState<string>('');
  const [newClientColor, setNewClientColor] = useState(CLIENT_COLORS[0]);
  const [savingClient, setSavingClient] = useState(false);

  // Add job form
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobAmount, setNewJobAmount] = useState('');
  const [newJobClientId, setNewJobClientId] = useState('');
  const [newJobDate, setNewJobDate] = useState(new Date().toISOString().slice(0, 10));
  const [newJobStatus, setNewJobStatus] = useState<'pending_payment' | 'paid'>('pending_payment');
  const [newJobNotes, setNewJobNotes] = useState('');
  const [savingJob, setSavingJob] = useState(false);

  // Flatten clients for selects
  const flatClients = useCallback((list: FreelanceClient[], depth = 0): Array<FreelanceClient & { depth: number }> => {
    const result: Array<FreelanceClient & { depth: number }> = [];
    for (const c of list) {
      result.push({ ...c, depth });
      if (c.children?.length) result.push(...flatClients(c.children, depth + 1));
    }
    return result;
  }, []);

  const allClients = flatClients(clients);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch('/api/freelance/clients');
      if (!res.ok) throw new Error('تعذر تحميل العملاء');
      const data = await res.json() as FreelanceClient[];
      setClients(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    } finally {
      setLoadingClients(false);
    }
  }, [showToast]);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const params = new URLSearchParams({ month: currentMonth });
      if (selectedClientId) params.set('client_id', selectedClientId);
      const res = await fetch(`/api/freelance/jobs?${params}`);
      if (!res.ok) throw new Error('تعذر تحميل الأعمال');
      const data = await res.json() as FreelanceJob[];
      setJobs(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    } finally {
      setLoadingJobs(false);
    }
  }, [currentMonth, selectedClientId, showToast]);

  useEffect(() => { loadClients(); }, [loadClients, refreshKey]);
  useEffect(() => { loadJobs(); }, [loadJobs, refreshKey]);

  // Totals for current view
  const pendingTotal = jobs.filter(j => j.status === 'pending_payment').reduce((s, j) => s + Number(j.amount), 0);
  const paidTotal = jobs.filter(j => j.status === 'paid').reduce((s, j) => s + Number(j.amount), 0);

  // Full month totals (all clients)
  const allMonthJobs = selectedClientId ? [] : jobs;
  const monthPending = selectedClientId
    ? allClients.reduce((s, c) => s + Number(c.pending_total ?? 0), 0)
    : pendingTotal;
  const monthPaid = selectedClientId
    ? allClients.reduce((s, c) => s + Number(c.paid_total ?? 0), 0)
    : paidTotal;

  // Add client
  const handleAddClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    setSavingClient(true);
    try {
      const res = await fetch('/api/freelance/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: newClientParentId || null, color: newClientColor }),
      });
      const data = await res.json() as FreelanceClient & { error?: string };
      if (!res.ok) throw new Error(data.error || 'خطأ');
      await loadClients();
      setNewClientName('');
      setNewClientParentId('');
      setNewClientColor(CLIENT_COLORS[0]);
      setShowAddClient(false);
      showToast('تمت إضافة العميل');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    } finally {
      setSavingClient(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`حذف "${name}" وكل أعماله؟`)) return;
    try {
      const res = await fetch(`/api/freelance/clients?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('تعذر الحذف');
      await Promise.all([loadClients(), loadJobs()]);
      if (selectedClientId === id) setSelectedClientId(null);
      showToast('تم الحذف');

    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    }
  };

  // Add job
  const handleAddJob = async () => {
    const title = newJobTitle.trim();
    const clientId = newJobClientId || selectedClientId || '';
    if (!title) { showToast('أضف عنوان العمل', 'error'); return; }
    if (!clientId) { showToast('اختر العميل', 'error'); return; }
    const amount = parseFloat(newJobAmount) || 0;
    setSavingJob(true);
    try {
      const res = await fetch('/api/freelance/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          title,
          amount,
          month: currentMonth,
          work_date: newJobDate,
          status: newJobStatus,
          notes: newJobNotes.trim() || null,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error || 'خطأ');
      await Promise.all([loadJobs(), loadClients()]);
      setNewJobTitle('');
      setNewJobAmount('');
      setNewJobNotes('');
      setNewJobStatus('pending_payment');
      setShowAddJob(false);
      showToast('تمت إضافة العمل');

    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    } finally {
      setSavingJob(false);
    }
  };

  // Mark job as paid
  const handleMarkPaid = async (job: FreelanceJob) => {
    try {
      const res = await fetch(`/api/freelance/jobs?id=${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', payment_date: new Date().toISOString().slice(0, 10) }),
      });
      if (!res.ok) throw new Error('تعذر التحديث');
      await Promise.all([loadJobs(), loadClients()]);
      showToast('تم تسجيل الاستلام ✓');

    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      const res = await fetch(`/api/freelance/jobs?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('تعذر الحذف');
      await Promise.all([loadJobs(), loadClients()]);
      showToast('تم الحذف');

    } catch (e) {
      showToast(e instanceof Error ? e.message : 'خطأ', 'error');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Group jobs by date
  const jobsByDate: Record<string, FreelanceJob[]> = {};
  for (const job of jobs) {
    const d = job.work_date || 'غير محدد';
    if (!jobsByDate[d]) jobsByDate[d] = [];
    jobsByDate[d].push(job);
  }

  const renderClientTree = (list: FreelanceClient[], depth = 0): React.ReactNode => list.map(client => {
    const hasChildren = (client.children?.length ?? 0) > 0;
    const isExpanded = expandedClients.has(client.id);
    const isSelected = selectedClientId === client.id;
    const total = Number(client.pending_total ?? 0) + Number(client.paid_total ?? 0);

    return (
      <div key={client.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 10px',
            marginRight: depth * 14,
            marginBottom: 2,
            borderRadius: 8,
            cursor: 'pointer',
            background: isSelected ? 'var(--surface2)' : 'transparent',
            border: isSelected ? `1px solid ${client.color || '#a78bfa'}40` : '1px solid transparent',
            transition: 'background 0.15s',
          }}
          onClick={() => setSelectedClientId(isSelected ? null : client.id)}
        >
          {hasChildren && (
            <button
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--muted)', display: 'flex', flexShrink: 0 }}
              onClick={e => { e.stopPropagation(); toggleExpand(client.id); }}
            >
              <AppIcon name={isExpanded ? 'chevron-down' : 'chevron-left'} size={14} />
            </button>
          )}
          {!hasChildren && <div style={{ width: 14 }} />}

          <div style={{ width: 8, height: 8, borderRadius: '50%', background: client.color || '#a78bfa', flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
            {total > 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
                {Number(client.pending_total) > 0 && <span style={{ color: 'var(--orange)' }}>{formatNum(Number(client.pending_total))} متوقع</span>}
                {Number(client.pending_total) > 0 && Number(client.paid_total) > 0 && <span style={{ color: 'var(--muted)' }}> · </span>}
                {Number(client.paid_total) > 0 && <span style={{ color: 'var(--green)' }}>{formatNum(Number(client.paid_total))} مستلم</span>}
              </div>
            )}
          </div>

          <button
            style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: 'var(--muted)', opacity: 0.5, display: 'flex', flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); handleDeleteClient(client.id, client.name); }}
            title="حذف"
          >
            <AppIcon name="trash" size={13} />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div>{renderClientTree(client.children!, depth + 1)}</div>
        )}
      </div>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* SUMMARY BAR */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="panel" style={{ flex: 1, minWidth: 140, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>إيراد متوقع</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--orange)' }}>{formatNum(pendingTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>لم يُستلم بعد</div>
        </div>
        <div className="panel" style={{ flex: 1, minWidth: 140, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>إيراد فعلي</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{formatNum(paidTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>تم الاستلام</div>
        </div>
        <div className="panel" style={{ flex: 1, minWidth: 140, padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>إجمالي الأعمال</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{formatNum(pendingTotal + paidTotal)}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{jobs.length} عمل</div>
        </div>
      </div>

      {/* MAIN LAYOUT: clients tree + jobs */}
      <div className="freelance-layout">

        {/* CLIENTS TREE */}
        <div className="panel freelance-sidebar" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="title-with-icon" style={{ margin: 0 }}>
              <AppIcon name="users" size={16} /><span>العملاء</span>
            </h3>
            <button
              className="btn btn-ghost btn-sm btn-with-icon"
              onClick={() => { setShowAddClient(true); setNewClientParentId(''); }}
            >
              <AppIcon name="plus" size={14} /><span>جديد</span>
            </button>
          </div>
          <div style={{ padding: '8px 6px' }}>
            {/* All clients option */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                background: !selectedClientId ? 'var(--surface2)' : 'transparent',
                border: !selectedClientId ? '1px solid var(--accent)40' : '1px solid transparent',
              }}
              onClick={() => setSelectedClientId(null)}
            >
              <AppIcon name="briefcase" size={14} />
              <span style={{ fontSize: 13 }}>كل الأعمال</span>
            </div>

            {loadingClients ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>يحمّل...</div>
            ) : clients.length === 0 ? (
              <div style={{ padding: '12px 10px', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>لا يوجد عملاء بعد</div>
            ) : (
              renderClientTree(clients)
            )}
          </div>
        </div>

        {/* JOBS LIST */}
        <div className="freelance-jobs" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Jobs header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {selectedClientId
                ? `أعمال ${allClients.find(c => c.id === selectedClientId)?.name || ''}`
                : 'كل أعمال الشهر'}
            </div>
            <button
              className="btn btn-primary btn-sm btn-with-icon"
              onClick={() => {
                setNewJobClientId(selectedClientId || '');
                setShowAddJob(true);
              }}
            >
              <AppIcon name="plus" size={14} /><span>أضف عمل</span>
            </button>
          </div>

          {/* Add Job Form */}
          {showAddJob && (
            <div className="panel" style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>عمل جديد</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 2, minWidth: 160 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>عنوان العمل *</label>
                    <input
                      className="input"
                      value={newJobTitle}
                      onChange={e => setNewJobTitle(e.target.value)}
                      placeholder="مثال: تصميم شعار"
                      autoFocus
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>المبلغ</label>
                    <input
                      className="input"
                      type="number"
                      value={newJobAmount}
                      onChange={e => setNewJobAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>العميل *</label>
                    <select
                      className="input"
                      value={newJobClientId}
                      onChange={e => setNewJobClientId(e.target.value)}
                    >
                      <option value="">اختر عميل</option>
                      {allClients.map(c => (
                        <option key={c.id} value={c.id}>
                          {'  '.repeat(c.depth)}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>تاريخ العمل</label>
                    <input
                      className="input"
                      type="date"
                      value={newJobDate}
                      onChange={e => setNewJobDate(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>حالة الدفع</label>
                    <select
                      className="input"
                      value={newJobStatus}
                      onChange={e => setNewJobStatus(e.target.value as 'pending_payment' | 'paid')}
                    >
                      <option value="pending_payment">⏳ لم يُستلم بعد</option>
                      <option value="paid">✓ تم الاستلام</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>ملاحظات (اختياري)</label>
                  <input
                    className="input"
                    value={newJobNotes}
                    onChange={e => setNewJobNotes(e.target.value)}
                    placeholder="أي تفاصيل إضافية..."
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddJob(false); setNewJobTitle(''); setNewJobAmount(''); setNewJobNotes(''); }}>إلغاء</button>
                  <button className="btn btn-primary btn-sm btn-with-icon" onClick={handleAddJob} disabled={savingJob}>
                    <AppIcon name="save" size={14} /><span>{savingJob ? 'يحفظ...' : 'حفظ'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Jobs list */}
          {loadingJobs ? (
            <div className="panel" style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>يحمّل الأعمال...</div>
          ) : jobs.length === 0 ? (
            <div className="panel">
              <div className="empty-state">
                <div className="icon"><AppIcon name="briefcase" size={28} /></div>
                <p>لا توجد أعمال للشهر — سجل أول عمل!</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(jobsByDate)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dateJobs]) => {
                  const dayPaid = dateJobs.filter(j => j.status === 'paid').reduce((s, j) => s + Number(j.amount), 0);
                  const dayPending = dateJobs.filter(j => j.status === 'pending_payment').reduce((s, j) => s + Number(j.amount), 0);
                  const dayLabel = date !== 'غير محدد' ? `${getDayName(date)} · ${formatDate(date)}` : 'غير محدد';
                  return (
                    <div key={date}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '0 4px' }}>
                        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{dayLabel}</span>
                        <span style={{ fontSize: 12 }}>
                          {dayPending > 0 && <span style={{ color: 'var(--orange)' }}>{formatNum(dayPending)} متوقع </span>}
                          {dayPaid > 0 && <span style={{ color: 'var(--green)' }}>{formatNum(dayPaid)} مستلم</span>}
                        </span>
                      </div>
                      {dateJobs.map(job => (
                        <div key={job.id} className="expense-item" style={{ marginBottom: 6 }}>
                          <div className="expense-left" style={{ gap: 10 }}>
                            <div
                              style={{
                                width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                background: `${job.client_color || '#a78bfa'}20`,
                                border: `1px solid ${job.client_color || '#a78bfa'}40`,
                              }}
                            >
                              <AppIcon name="briefcase" size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 500 }}>{job.title}</div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: job.client_color || '#a78bfa' }} />
                                  {job.client_name}
                                </span>
                                <span
                                  style={{
                                    fontSize: 11, borderRadius: 4, padding: '1px 6px', fontWeight: 600,
                                    background: job.status === 'paid' ? '#16a34a20' : '#f59e0b20',
                                    color: job.status === 'paid' ? 'var(--green)' : 'var(--orange)',
                                  }}
                                >
                                  {job.status === 'paid' ? '✓ تم الاستلام' : '⏳ متوقع'}
                                </span>
                                {job.payment_date && job.status === 'paid' && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>استُلم {formatDate(job.payment_date)}</span>
                                )}
                                {job.notes && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{job.notes}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="expense-right" style={{ gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: job.status === 'paid' ? 'var(--green)' : 'var(--orange)' }}>
                              {formatNum(Number(job.amount))}
                            </span>
                            {job.status === 'pending_payment' && (
                              <button
                                className="btn btn-sm btn-with-icon"
                                style={{ background: '#16a34a20', color: 'var(--green)', border: '1px solid #16a34a40', fontSize: 11, padding: '3px 8px' }}
                                onClick={() => handleMarkPaid(job)}
                                title="استلمت الفلوس"
                              >
                                <AppIcon name="check" size={12} /><span>استلمت</span>
                              </button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteJob(job.id)}>
                              <AppIcon name="trash" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ADD CLIENT MODAL */}
      {showAddClient && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="panel" style={{ width: '100%', maxWidth: 420, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>عميل جديد</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddClient(false)}><AppIcon name="close" size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>اسم العميل *</label>
                <input
                  className="input"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="مثال: شركة الأمل للتسويق"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleAddClient()}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>تابع لـ (اختياري)</label>
                <select className="input" value={newClientParentId} onChange={e => setNewClientParentId(e.target.value)}>
                  <option value="">— بدون أب —</option>
                  {allClients.map(c => (
                    <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>لون</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CLIENT_COLORS.map(color => (
                    <div
                      key={color}
                      onClick={() => setNewClientColor(color)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', background: color, cursor: 'pointer',
                        border: newClientColor === color ? '3px solid var(--text, #fff)' : '2px solid transparent',
                        boxSizing: 'border-box',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAddClient(false)}>إلغاء</button>
                <button className="btn btn-primary btn-sm btn-with-icon" onClick={handleAddClient} disabled={savingClient || !newClientName.trim()}>
                  <AppIcon name="save" size={14} /><span>{savingClient ? 'يحفظ...' : 'حفظ'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
