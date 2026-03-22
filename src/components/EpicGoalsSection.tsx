'use client';

import { useEffect, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { EpicGoal, EpicGoalAllocation, EpicGoalSurplusMonth, formatNum, getMonthName } from '@/lib/types';

interface Props {
  month: string;
  goals: EpicGoal[];
  monthAllocations: EpicGoalAllocation[];
  monthBalance: number;
  surplusMonths: EpicGoalSurplusMonth[];
  onRefresh: () => Promise<unknown> | void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function EpicGoalsSection({
  month,
  goals,
  monthAllocations,
  monthBalance,
  surplusMonths,
  onRefresh,
  showToast,
}: Props) {
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [selectedSourceMonth, setSelectedSourceMonth] = useState(month);
  const [allocationAmount, setAllocationAmount] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState(false);

  const currentMonthAvailable = Math.max(monthBalance, 0);
  const totalSaved = goals.reduce((sum, goal) => sum + Number(goal.saved_total ?? 0), 0);
  const totalSpent = goals.reduce((sum, goal) => sum + Number(goal.spent_total ?? 0), 0);
  const totalBalance = goals.reduce((sum, goal) => sum + Number(goal.current_balance ?? 0), 0);
  const totalTargets = goals.reduce((sum, goal) => sum + Number(goal.target_amount ?? 0), 0);
  const monthAllocatedTotal = monthAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);
  const availableSurplusMonths = surplusMonths.filter((item) => item.available > 0);
  const selectedSurplusMonth = availableSurplusMonths.find((item) => item.month === selectedSourceMonth)
    || availableSurplusMonths.find((item) => item.month === month)
    || availableSurplusMonths[0]
    || null;
  const availableToAllocate = Math.max(Number(selectedSurplusMonth?.available ?? 0), 0);
  const previousSurplusMonths = availableSurplusMonths.filter((item) => item.month !== (selectedSurplusMonth?.month || month));

  useEffect(() => {
    if (goals.length === 0) {
      setSelectedGoalId('');
      return;
    }

    setSelectedGoalId((current) => (
      current && goals.some((goal) => goal.id === current) ? current : goals[0].id
    ));
  }, [goals]);

  useEffect(() => {
    if (availableSurplusMonths.length === 0) {
      setSelectedSourceMonth(month);
      return;
    }

    setSelectedSourceMonth((current) => (
      availableSurplusMonths.some((item) => item.month === current)
        ? current
        : (availableSurplusMonths.find((item) => item.month === month)?.month || availableSurplusMonths[0].month)
    ));
  }, [availableSurplusMonths, month]);

  useEffect(() => {
    if (selectedSurplusMonth) {
      setAllocationAmount(String(selectedSurplusMonth.available));
      setAdjustmentAmount('');
    } else {
      setAllocationAmount('');
      setAdjustmentAmount('');
    }
  }, [selectedSurplusMonth?.available, selectedSurplusMonth?.month]);

  const createGoal = async () => {
    const trimmedName = goalName.trim();
    const targetAmount = goalTarget ? Number(goalTarget) : 0;

    if (!trimmedName) {
      showToast('اكتب اسم الهدف الملحمي', 'error');
      return;
    }

    if (Number.isNaN(targetAmount) || targetAmount < 0) {
      showToast('المبلغ المستهدف غير صالح', 'error');
      return;
    }

    setSavingGoal(true);
    try {
      const res = await fetch('/api/epic-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: makeId('epic_goal'),
          name: trimmedName,
          target_amount: targetAmount,
          notes: goalNotes.trim(),
        }),
      });

      const payload = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'تعذر حفظ الهدف');
      }

      setGoalName('');
      setGoalTarget('');
      setGoalNotes('');
      setShowAddGoal(false);
      showToast('تم إضافة الهدف الملحمي');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حفظ الهدف', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  const allocateToGoal = async () => {
    const amount = Number(allocationAmount);
    const errorMargin = Number(adjustmentAmount || 0);

    if (!selectedGoalId) {
      showToast('اختر هدفاً أولاً', 'error');
      return;
    }

    if (!amount || Number.isNaN(amount) || amount <= 0) {
      showToast('اكتب مبلغاً صالحاً للتحويل', 'error');
      return;
    }

    if (Number.isNaN(errorMargin) || errorMargin < 0) {
      showToast('هامش الخطأ غير صالح', 'error');
      return;
    }

    if (amount + errorMargin > availableToAllocate) {
      showToast('مبلغ التحويل مع هامش الخطأ أكبر من المتبقي المتاح لهذا الشهر', 'error');
      return;
    }

    setSavingAllocation(true);
    try {
      const res = await fetch('/api/epic-goals/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: makeId('goal_allocation'),
          epic_goal_id: selectedGoalId,
          month: selectedSurplusMonth?.month || month,
          amount,
          adjustment_amount: errorMargin,
          notes: allocationNotes.trim() || `تحويل من فائض ${getMonthName(selectedSurplusMonth?.month || month)}`,
          adjustment_note: adjustmentNotes.trim() || `هامش خطأ في فائض ${getMonthName(selectedSurplusMonth?.month || month)}`,
        }),
      });

      const payload = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'تعذر تحويل الفائض');
      }

      setAllocationAmount('');
      setAdjustmentAmount('');
      setAllocationNotes('');
      setAdjustmentNotes('');
      showToast('تم تحويل المبلغ للهدف الملحمي');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر تحويل الفائض', 'error');
    } finally {
      setSavingAllocation(false);
    }
  };

  const deleteGoal = async (goal: EpicGoal) => {
    if (!window.confirm(`هل تريد حذف الهدف "${goal.name}"؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/epic-goals?id=${goal.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'تعذر حذف الهدف');
      }

      showToast('تم حذف الهدف');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حذف الهدف', 'error');
    }
  };

  const deleteAllocation = async (allocation: EpicGoalAllocation) => {
    if (!window.confirm('هل تريد حذف هذا التحويل من الهدف؟')) {
      return;
    }

    try {
      const res = await fetch(`/api/epic-goals/allocate?id=${allocation.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'تعذر حذف التحويل');
      }

      showToast('تم حذف التحويل');
      await onRefresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'تعذر حذف التحويل', 'error');
    }
  };

  return (
    <div>
      <div className="cards-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card blue">
          <div className="stat-label">إجمالي الأهداف</div>
          <div className="stat-value blue">{goals.length}</div>
          <div className="stat-sub">أهداف ملحمية فعالة</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">الرصيد داخل الأهداف</div>
          <div className="stat-value green">{formatNum(totalBalance)}</div>
          <div className="stat-sub">مدخر {formatNum(totalSaved)} ومصروف {formatNum(totalSpent)}</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-label">المحوّل هذا الشهر</div>
          <div className="stat-value purple">{formatNum(monthAllocatedTotal)}</div>
          <div className="stat-sub">من شهر {getMonthName(month)}</div>
        </div>
        <div className={`stat-card ${currentMonthAvailable > 0 ? 'green' : 'red'}`}>
          <div className="stat-label">المتاح في الشهر الحالي</div>
          <div className={`stat-value ${currentMonthAvailable > 0 ? 'green' : 'red'}`}>{formatNum(currentMonthAvailable)}</div>
          <div className="stat-sub">إجمالي المستهدف {formatNum(totalTargets)}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="target" size={18} />
            <span>تحويل فائض شهر حالي أو سابق</span>
          </h3>
          {availableToAllocate > 0 && (
            <button
              className="btn btn-ghost btn-sm btn-with-icon"
              type="button"
              onClick={() => {
                setAllocationAmount(String(availableToAllocate));
                setAdjustmentAmount('');
              }}
            >
              <AppIcon name="copy" size={14} />
              <span>استخدم كامل المتبقي</span>
            </button>
          )}
        </div>

        <div className="panel-body">
          {goals.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="target" size={28} /></div>
              <p>أضف أول هدف ملحمي حتى تبدأ تحويل الفائض وربط المصاريف به.</p>
            </div>
          ) : availableSurplusMonths.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 20px' }}>
              <div className="icon"><AppIcon name="warning" size={28} /></div>
              <p>لا توجد فوائض غير محوّلة حالياً لا في هذا الشهر ولا في الأشهر السابقة.</p>
            </div>
          ) : (
            <>
              <div className="form-row triple">
                <div className="form-group">
                  <label>شهر الفائض</label>
                  <select
                    className="form-control"
                    value={selectedSurplusMonth?.month || ''}
                    onChange={(event) => setSelectedSourceMonth(event.target.value)}
                  >
                    {availableSurplusMonths.map((item) => (
                      <option key={item.month} value={item.month}>
                        {getMonthName(item.month)} — فائض {formatNum(item.available)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>الهدف الملحمي</label>
                  <select
                    className="form-control"
                    value={selectedGoalId}
                    onChange={(event) => setSelectedGoalId(event.target.value)}
                  >
                    {goals.map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.name} — الرصيد {formatNum(Number(goal.current_balance ?? 0))}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>مبلغ التحويل</label>
                  <input
                    type="number"
                    className="form-control"
                    value={allocationAmount}
                    onChange={(event) => setAllocationAmount(event.target.value)}
                    placeholder="مثل: 250"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>هامش الخطأ</label>
                  <input
                    type="number"
                    className="form-control"
                    value={adjustmentAmount}
                    onChange={(event) => setAdjustmentAmount(event.target.value)}
                    placeholder="مثال: 30000"
                  />
                </div>
                <div className="form-group">
                  <label>ملاحظة هامش الخطأ</label>
                  <input
                    className="form-control"
                    value={adjustmentNotes}
                    onChange={(event) => setAdjustmentNotes(event.target.value)}
                    placeholder="مثال: فرق حسابي أو مبلغ غير متوفر فعلياً"
                  />
                </div>
              </div>

              {selectedSurplusMonth && (
                <div className="summary-bar">
                  <div className="summary-item">
                    <div className="label">الشهر المختار</div>
                    <div className="val">{getMonthName(selectedSurplusMonth.month)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">الدخل</div>
                    <div className="val" style={{ color: 'var(--accent)' }}>{formatNum(selectedSurplusMonth.income_total)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">المصروف الفعلي</div>
                    <div className="val" style={{ color: 'var(--red)' }}>{formatNum(selectedSurplusMonth.actual_total)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">المحوّل سابقاً</div>
                    <div className="val" style={{ color: 'var(--accent)' }}>{formatNum(selectedSurplusMonth.allocated_total)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">هامش الخطأ المسجل</div>
                    <div className="val" style={{ color: 'var(--orange)' }}>{formatNum(selectedSurplusMonth.adjustment_total)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">المتبقي للتحويل</div>
                    <div className="val" style={{ color: 'var(--green)' }}>{formatNum(selectedSurplusMonth.available)}</div>
                  </div>
                </div>
              )}

              <div className="summary-bar">
                <div className="summary-item">
                  <div className="label">التحويل الحالي</div>
                  <div className="val" style={{ color: 'var(--accent)' }}>{formatNum(Number(allocationAmount || 0))}</div>
                </div>
                <div className="summary-divider" />
                <div className="summary-item">
                  <div className="label">هامش الخطأ الحالي</div>
                  <div className="val" style={{ color: 'var(--orange)' }}>{formatNum(Number(adjustmentAmount || 0))}</div>
                </div>
                <div className="summary-divider" />
                <div className="summary-item">
                  <div className="label">الإجمالي المحسوب</div>
                  <div className="val">{formatNum(Number(allocationAmount || 0) + Number(adjustmentAmount || 0))}</div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>ملاحظات</label>
                  <input
                    className="form-control"
                    value={allocationNotes}
                    onChange={(event) => setAllocationNotes(event.target.value)}
                    placeholder={`مثال: فائض ${getMonthName(selectedSurplusMonth?.month || month)}`}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                  <label>تنفيذ التحويل</label>
                  <button
                    className="btn btn-primary btn-with-icon"
                    type="button"
                    disabled={savingAllocation}
                    onClick={allocateToGoal}
                  >
                    <AppIcon name="save" size={16} />
                    <span>{savingAllocation ? 'جارٍ التحويل...' : 'تحويل للهدف'}</span>
                  </button>
                </div>
              </div>

              {previousSurplusMonths.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>
                    فوائض الأشهر السابقة غير المحوّلة
                  </div>
                  {previousSurplusMonths.map((item) => (
                    <div
                      key={item.month}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 12,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{getMonthName(item.month)}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          فائض متاح {formatNum(item.available)} · محوّل {formatNum(item.allocated_total)} · هامش خطأ {formatNum(item.adjustment_total)}
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm btn-with-icon"
                        type="button"
                        onClick={() => setSelectedSourceMonth(item.month)}
                      >
                        <AppIcon name="target" size={14} />
                        <span>اختيار الشهر</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3 className="title-with-icon">
            <AppIcon name="target" size={18} />
            <span>إدارة الأهداف الملحمية</span>
          </h3>
          <button className="btn btn-primary btn-sm btn-with-icon" type="button" onClick={() => setShowAddGoal((current) => !current)}>
            <AppIcon name={showAddGoal ? 'close' : 'plus'} size={14} />
            <span>{showAddGoal ? 'إلغاء' : 'إضافة هدف'}</span>
          </button>
        </div>

        {showAddGoal && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div className="form-row">
              <div className="form-group">
                <label>اسم الهدف *</label>
                <input
                  className="form-control"
                  value={goalName}
                  onChange={(event) => setGoalName(event.target.value)}
                  placeholder="مثل: لابتوب جديد، سفر، سيارة"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>المبلغ المستهدف</label>
                <input
                  type="number"
                  className="form-control"
                  value={goalTarget}
                  onChange={(event) => setGoalTarget(event.target.value)}
                  placeholder="اختياري"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>ملاحظات</label>
                <input
                  className="form-control"
                  value={goalNotes}
                  onChange={(event) => setGoalNotes(event.target.value)}
                  placeholder="مثال: أحتاجه قبل نهاية السنة"
                />
              </div>
              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <label>حفظ</label>
                <button
                  className="btn btn-primary btn-with-icon"
                  type="button"
                  disabled={savingGoal}
                  onClick={createGoal}
                >
                  <AppIcon name="save" size={16} />
                  <span>{savingGoal ? 'جارٍ الحفظ...' : 'حفظ الهدف'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="panel-body">
          {goals.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><AppIcon name="target" size={28} /></div>
              <p>لا توجد أهداف ملحمية بعد.</p>
            </div>
          ) : goals.map((goal) => {
            const currentBalance = Number(goal.current_balance ?? 0);
            const targetAmount = Number(goal.target_amount ?? 0);
            const spentTotal = Number(goal.spent_total ?? 0);
            const thisMonthAllocated = (goal.allocations || [])
              .filter((allocation) => allocation.month === month)
              .reduce((sum, allocation) => sum + Number(allocation.amount), 0);
            const remainingToTarget = Math.max(targetAmount - currentBalance, 0);
            const progress = targetAmount > 0 ? Math.min(100, Math.round((currentBalance / targetAmount) * 100)) : 0;

            return (
              <div
                key={goal.id}
                style={{
                  marginBottom: 16,
                  background: 'var(--surface2)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div className="inline-icon-value" style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
                      <AppIcon name="target" size={16} />
                      <span>{goal.name}</span>
                    </div>
                    {goal.notes && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{goal.notes}</div>}
                  </div>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteGoal(goal)}>
                    <AppIcon name="trash" size={14} />
                  </button>
                </div>

                <div className="summary-bar">
                  <div className="summary-item">
                    <div className="label">الرصيد الحالي</div>
                    <div className="val" style={{ color: 'var(--green)' }}>{formatNum(currentBalance)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">المستهدف</div>
                    <div className="val" style={{ color: 'var(--accent)' }}>{targetAmount > 0 ? formatNum(targetAmount) : 'غير محدد'}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">مصروف من الهدف</div>
                    <div className="val" style={{ color: 'var(--red)' }}>{formatNum(spentTotal)}</div>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-item">
                    <div className="label">تحويل هذا الشهر</div>
                    <div className="val" style={{ color: 'var(--accent)' }}>{formatNum(thisMonthAllocated)}</div>
                  </div>
                </div>

                {targetAmount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6, fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                      <span>التقدم نحو الهدف</span>
                      <span>{progress}% · المتبقي {formatNum(remainingToTarget)}</span>
                    </div>
                    <div className="progress-wrap" style={{ marginBottom: 12 }}>
                      <div className="progress-bar" style={{ width: `${progress}%`, background: progress >= 100 ? 'var(--green)' : 'var(--accent)' }} />
                    </div>
                  </>
                )}

                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, marginBottom: 8 }}>آخر التحويلات</div>
                {(goal.allocations || []).length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>لا توجد تحويلات لهذا الهدف بعد.</div>
                ) : (
                  (goal.allocations || []).slice(0, 4).map((allocation) => (
                    <div
                      key={allocation.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                          +{formatNum(Number(allocation.amount))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                          {getMonthName(allocation.month)}
                          {allocation.notes ? ` · ${allocation.notes}` : ''}
                        </div>
                      </div>
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteAllocation(allocation)}>
                        <AppIcon name="trash" size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
