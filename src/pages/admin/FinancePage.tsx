import { useState, useEffect } from 'react';
import {
  getFinanceStats,
  getResellerStatus,
  addResellerBalance,
  withdrawTotalDeposit,
  type FinanceStats,
  type ResellerStatus
} from '../../adminApi';
import { useAdmin } from '../../AdminApp';

export function FinancePage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [reseller, setReseller] = useState<ResellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useAdmin();

  // Modals state
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('CBE (Commercial Bank of Ethiopia)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [financeData, resellerData] = await Promise.all([
        getFinanceStats(),
        getResellerStatus().catch(() => null)
      ]);

      if (financeData.success) {
        setStats(financeData);
      } else {
        setError('Failed to load finance stats');
        showToast('error', 'Failed to load finance stats');
      }

      if (resellerData) {
        setReseller(resellerData);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to load finance stats';
      setError(msg);
      showToast('error', msg);
    } finally {
      setLoading(false);
    }
  }

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(addAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Please enter a valid deposit amount');
      return;
    }
    setSubmittingAdd(true);
    try {
      const res = await addResellerBalance(amt);
      if (res.success) {
        showToast('success', `Successfully deposited ${amt.toFixed(2)} ETB to Reseller Balance!`);
        setShowAddBalanceModal(false);
        setAddAmount('');
        if (reseller) {
          setReseller({ ...reseller, reseller_balance: res.new_balance });
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to add balance');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Please enter a valid withdrawal amount');
      return;
    }
    if (!bankName.trim() || !accountNumber.trim()) {
      showToast('error', 'Please fill in bank name and account number');
      return;
    }
    if (reseller && amt > reseller.total_deposit) {
      showToast('error', `Amount exceeds total deposit (${reseller.total_deposit.toFixed(2)} ETB)`);
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const res = await withdrawTotalDeposit(amt, bankName, accountNumber, accountName);
      if (res.success) {
        showToast('success', `Successfully withdrew ${amt.toFixed(2)} ETB from Total Deposit!`);
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setAccountNumber('');
        setAccountName('');
        if (reseller) {
          setReseller({ ...reseller, total_deposit: res.new_total_deposit });
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to process withdrawal');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  if (error) {
    return (
      <div className="loading-center" style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--error)' }}>
          {error}
        </div>
        <button className="btn btn--secondary btn--sm" onClick={loadData} style={{ marginTop: 8 }}>
          🔄 Retry Load
        </button>
      </div>
    );
  }

  if (!stats) return <div className="loading-center">No finance data available</div>;

  const formatETB = (val: number) => {
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ETB';
  };

  const isGrowthPositive = stats.revenueGrowth >= 0;

  return (
    <div className="finance-page" style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* ─── Reseller & Deposit Operations Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>

        {/* Reseller Wallet Balance Card */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
          <div className="stat-card__header">
            <span className="stat-card__label" style={{ color: '#818cf8', fontWeight: 700 }}>Reseller Balance (with primora444)</span>
            <div className="stat-card__icon stat-card__icon--blue">💳</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 28, color: '#a5b4fc', margin: '8px 0' }}>
            {formatETB(reseller?.reseller_balance ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Wholesale balance used when users place orders
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setShowAddBalanceModal(true)}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 700, borderRadius: 8 }}
          >
            ➕ Add Balance
          </button>
        </div>

        {/* Total Deposit Metric & Withdrawal Card */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08))', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
          <div className="stat-card__header">
            <span className="stat-card__label" style={{ color: '#4ade80', fontWeight: 700 }}>Total Deposit (User Deposits)</span>
            <div className="stat-card__icon stat-card__icon--green">💰</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 28, color: '#86efac', margin: '8px 0' }}>
            {formatETB(reseller?.total_deposit ?? stats.totalRevenue)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Cumulative deposits collected from end-users
          </div>
          <button
            className="btn btn--success btn--sm"
            onClick={() => setShowWithdrawModal(true)}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 700, borderRadius: 8, background: '#10b981', border: 'none', color: '#fff' }}
          >
            💸 Withdraw from Total Deposit
          </button>
        </div>

      </div>

      {/* ─── Top Stats Row ─── */}
      <div className="stats-grid" style={{ marginBottom: 28 }}>

        {/* Withdrawable Balance */}
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Withdrawable Balance</span>
            <div className="stat-card__icon stat-card__icon--purple">🏦</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 24 }}>{formatETB(stats.withdrawableBalance)}</div>
          <div className="stat-card__change">Sum of all users' wallets</div>
        </div>

        {/* Pending Withdrawals */}
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Pending Withdrawals</span>
            <div className="stat-card__icon stat-card__icon--orange">⏳</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 24, color: 'var(--warning)' }}>{formatETB(stats.pendingWithdrawals)}</div>
          <div className="stat-card__change">Awaiting administrator approval</div>
        </div>

        {/* Revenue Growth */}
        <div className="stat-card">
          <div className="stat-card__header">
            <span className="stat-card__label">Revenue Growth (Weekly)</span>
            <div className="stat-card__icon stat-card__icon--blue">📈</div>
          </div>
          <div className="stat-card__value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: isGrowthPositive ? 'var(--success)' : 'var(--error)' }}>
              {isGrowthPositive ? '▲' : '▼'} {Math.abs(stats.revenueGrowth)}%
            </span>
          </div>
          <div className="stat-card__change">Vs. previous week's performance</div>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 28 }}>

        {/* ─── REVENUE BLOCK ─── */}
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="settings-card__title" style={{ color: 'var(--success)', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
            💰 Revenue Analytics
          </h3>

          <div style={{ padding: '8px 0' }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Revenue
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {formatETB(stats.totalRevenue)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Today's Revenue</span>
              <span className="settings-card__row-value" style={{ color: 'var(--success)' }}>{formatETB(stats.todayRevenue)}</span>
            </div>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Weekly Revenue</span>
              <span className="settings-card__row-value">{formatETB(stats.weeklyRevenue)}</span>
            </div>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Monthly Revenue</span>
              <span className="settings-card__row-value">{formatETB(stats.monthlyRevenue)}</span>
            </div>
          </div>
        </div>

        {/* ─── WITHDRAWALS BLOCK ─── */}
        <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 className="settings-card__title" style={{ color: 'var(--accent)', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
            💸 Withdrawal Analytics
          </h3>

          <div style={{ padding: '8px 0' }}>
            <span style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
              Total Approved Withdrawn
            </span>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
              {formatETB(stats.totalWithdrawn)}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Today's Withdrawals</span>
              <span className="settings-card__row-value" style={{ color: 'var(--accent)' }}>{formatETB(stats.todayWithdrawals)}</span>
            </div>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Weekly Withdrawals</span>
              <span className="settings-card__row-value">{formatETB(stats.weeklyWithdrawals)}</span>
            </div>
            <div className="settings-card__row">
              <span className="settings-card__row-label">Monthly Withdrawals</span>
              <span className="settings-card__row-value">{formatETB(stats.monthlyWithdrawals)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── Add Balance Modal ─── */}
      {showAddBalanceModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card, #18181b)', border: '1px solid var(--border-color, #27272a)',
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>➕ Add Reseller Balance</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Deposit funds to your reseller wallet with primora444.
            </p>
            <form onSubmit={handleAddBalanceSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Deposit Amount (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  className="form-input"
                  placeholder="e.g. 5000"
                  value={addAmount}
                  onChange={e => setAddAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: 8 }}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowAddBalanceModal(false)}
                  disabled={submittingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={submittingAdd || !addAmount}
                >
                  {submittingAdd ? 'Processing...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Withdraw from Total Deposit Modal ─── */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }}>
          <div style={{
            background: 'var(--bg-card, #18181b)', border: '1px solid var(--border-color, #27272a)',
            borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>💸 Withdraw from Total Deposit</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Available Total Deposit: <strong style={{ color: 'var(--success)' }}>{formatETB(reseller?.total_deposit ?? 0)}</strong>
            </p>
            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Withdrawal Amount (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={reseller?.total_deposit ?? undefined}
                  className="form-input"
                  placeholder="e.g. 2000"
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 8 }}
                  autoFocus
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Bank Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Commercial Bank of Ethiopia (CBE), Telebirr, Abyssinia"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 8 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Account Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="1000XXXXXXXX"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 8 }}
                  required
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                  Account Holder Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Full Name on Bank Account"
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={submittingWithdraw}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--success"
                  disabled={submittingWithdraw || !withdrawAmount || !accountNumber}
                  style={{ background: '#10b981', border: 'none', color: '#fff' }}
                >
                  {submittingWithdraw ? 'Processing...' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
