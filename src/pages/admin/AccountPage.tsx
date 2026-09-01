import { useState, useEffect, useRef } from 'react';
import { sendSmsEthiopia } from '../../utils/sms';
import {
  changeAdminPassword, getResellerStatus, initResellerDeposit, verifyResellerDeposit,
  getResellerDepositHistory, requestResellerWithdrawal, getResellerWithdrawalHistory,
  sendResellerWithdrawalSms, testResellerRoute, type ResellerStatus, type ResellerDeposit, type AdminWithdrawalRequest
} from '../../adminApi';
import { useAdmin } from '../../AdminApp';

// ─── Format helpers ────────────────────────────────────────────────
function fmtETB(n: number) {
  return n.toLocaleString('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ETB';
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Status badge ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    pending: { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: '⏳ Pending' },
    sent: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: '✅ Sent' },
    success: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: '✅ Success' },
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: '✅ Completed' },
    failed: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: '❌ Failed' },
    initiated: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1', label: '🔗 Initiated' },
  };
  const s = map[status?.toLowerCase()] || { bg: 'rgba(255,255,255,0.07)', color: '#aaa', label: status };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#13131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: 32, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
  padding: '12px 16px', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 6, fontWeight: 500
};

// ─── Add Balance Modal ─────────────────────────────────────────────
function AddBalanceModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const { showToast } = useAdmin();
  const [step, setStep] = useState<'form' | 'verifying' | 'done' | 'error'>('form');
  const [amount, setAmount] = useState('');
  const [txRef, setTxRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [timeLeft, setTimeLeft] = useState(45);
  const [pollError, setPollError] = useState('');

  const timerRef = useRef<any>(null);
  const pollAbortRef = useRef(false);
  const activeTxRefRef = useRef<string | null>(null);

  const reset = () => {
    setStep('form');
    setAmount('');
    setTxRef('');
    setCheckoutUrl('');
    setLoading(false);
    setTimeLeft(45);
    setPollError('');
    pollAbortRef.current = false;
    activeTxRefRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (open) {
      // Check if user returned from Chapa after paying
      const pendingTxRef = sessionStorage.getItem('pending_deposit_tx_ref');
      const pendingAmount = sessionStorage.getItem('pending_deposit_amount');
      if (pendingTxRef) {
        sessionStorage.removeItem('pending_deposit_tx_ref');
        sessionStorage.removeItem('pending_deposit_amount');
        if (pendingAmount) setAmount(pendingAmount);
        setTxRef(pendingTxRef);
        startPollingVerification(pendingTxRef);
        return;
      }
      // Diagnostic test route check
      testResellerRoute()
        .then(res => console.log('Diagnostic [test-init] success:', res))
        .catch((err: any) => console.error('Diagnostic [test-init] failed:', err));
    } else {
      reset();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  const triggerDepositSuccess = (newBalance: number) => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.HapticFeedback) {
      try {
        tg.HapticFeedback.notificationOccurred('success');
      } catch (e) { }
    }
    showToast('success', `Deposit confirmed! Balance: ${fmtETB(newBalance)}`);
    setStep('done');
    onSuccess();

    // Auto-scroll to Recent Deposits list
    setTimeout(() => {
      const el = document.getElementById('reseller-deposit-history');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 300);
  };

  // Polling logic inspired by aiby_client/src/pages/DepositPage/DepositPage.tsx
  const startPollingVerification = async (ref: string) => {
    activeTxRefRef.current = ref;
    pollAbortRef.current = false;
    setStep('verifying');
    setTimeLeft(45);
    setPollError('');

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const delays = [
      2000, 2000, 2000, 3000, 3000, // First 12s
      4000, 4000, 5000, 5000, 5000, // Next 23s
      8000, 8000, 10000, 10000,     // Slower polling
    ];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (pollAbortRef.current || activeTxRefRef.current !== ref) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, delays[attempt]));

      if (pollAbortRef.current || activeTxRefRef.current !== ref) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      try {
        const res = await verifyResellerDeposit(ref);

        // Match aiby_client logic: verify response
        if (res.success && !res.message?.toLowerCase().includes('pending') && !res.message?.toLowerCase().includes('failed')) {
          if (timerRef.current) clearInterval(timerRef.current);
          triggerDepositSuccess(res.reseller_balance || 0);
          return;
        }

        const msgLower = String(res.message || '').toLowerCase();
        const isFailed = msgLower.includes('failed') || msgLower.includes('reject') || msgLower.includes('cancel');
        if (isFailed) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('error');
          setPollError(res.message || 'Transaction was failed/cancelled by the user.');
          return;
        }
      } catch (err: any) {
        console.error('[verify-poll-error]', err);
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    // Timeout
    setStep('error');
    setPollError('Verification timed out. If payment was made, balance will update in background.');
  };

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const tg = (window as any).Telegram?.WebApp;

      // Build return URL dynamically: close-popup.html for Telegram native close, query param for standard browser fallback
      let returnUrl = window.location.origin + '/close-popup.html?bot=adminprimora444';
      if (!tg) {
        returnUrl = window.location.origin + window.location.pathname + '?deposit=reseller';
      }

      const res = await initResellerDeposit(parseFloat(amount), returnUrl);

      if (res.success && res.checkout_url && res.tx_ref) {
        setCheckoutUrl(res.checkout_url);
        setTxRef(res.tx_ref);

        if (tg && typeof tg.openLink === 'function') {
          // Slide up native Telegram overlay browser sheet (p2.jpg)
          tg.openLink(res.checkout_url);
          // Start polling directly on the verifying screen
          startPollingVerification(res.tx_ref);
        } else {
          // Standard browser fallback: save state and redirect current tab (never blocked)
          sessionStorage.setItem('pending_deposit_tx_ref', res.tx_ref);
          sessionStorage.setItem('pending_deposit_amount', amount);
          window.location.href = res.checkout_url;
        }
      } else {
        showToast('error', res.error || (res ? `Response: ${JSON.stringify(res)}` : 'Failed to initialize payment'));
      }
    } catch (err: any) {
      console.error('[AddBalance] Init error:', err);
      const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
      showToast('error', `Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (!txRef) return;
    setLoading(true);
    try {
      const res = await verifyResellerDeposit(txRef);
      if (res.success && !res.message?.toLowerCase().includes('pending') && !res.message?.toLowerCase().includes('failed')) {
        triggerDepositSuccess(res.reseller_balance || 0);
      } else {
        showToast('info', res.message || 'Payment is still processing.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={handleClose} title="💳 Add Balance via Chapa">
      {step === 'form' && (
        <form onSubmit={handleInit}>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Amount (ETB) *</label>
            <input type="number" min="10" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" required autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
            {[100, 500, 1000, 5000].map(amt => (
              <button
                key={amt}
                type="button"
                className="btn btn--secondary"
                style={{ padding: '8px 0', fontSize: 13 }}
                onClick={() => {
                  const currentVal = parseInt(amount || '0', 10);
                  setAmount(String(currentVal + amt));
                }}
              >
                +{amt}
              </button>
            ))}
          </div>

          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            ℹ️ After clicking Pay, a Chapa payment page will open in a new tab. Complete the payment, and we will verify it automatically.
          </div>

          <button type="submit" disabled={loading || !amount || parseFloat(amount) < 10} className="btn btn--primary btn--full" style={{ padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600, width: '100%', opacity: (loading || !amount || parseFloat(amount) < 10) ? 0.6 : 1 }}>
            {loading ? '⏳ Initializing...' : '💳 Pay with Chapa'}
          </button>
        </form>
      )}

      {step === 'verifying' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ position: 'relative', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" style={{ width: 48, height: 48 }} />
              <span style={{ fontSize: 24, position: 'absolute' }}>💳</span>
            </div>
          </div>

          <h4 style={{ color: '#fff', marginBottom: 8, fontSize: 18, fontWeight: 700 }}>Verifying Payment</h4>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
            Checking your payment of <strong style={{ color: '#6366f1' }}>{fmtETB(parseFloat(amount || '0'))}</strong>.<br />
            This will update automatically once Chapa confirms.
          </p>

          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: `${(timeLeft / 45) * 100}%`,
              background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 100%)',
              transition: 'width 1s linear',
              borderRadius: 4
            }}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>
            <span>{timeLeft > 0 ? `Auto-checking in ${timeLeft}s...` : 'Checking final confirmation...'}</span>
            <span style={{ color: '#6366f1', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }}></span>
              Live
            </span>
          </div>

          <button
            onClick={handleManualCheck}
            disabled={loading}
            className="btn btn--primary btn--full"
            style={{ width: '100%', padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 600, marginBottom: 10, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '⏳ Checking...' : '🔄 Check Now'}
          </button>

          <button
            onClick={handleClose}
            className="btn"
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13 }}
          >
            Cancel / Close window
          </button>
        </div>
      )}

      {step === 'error' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h4 style={{ color: '#ef4444', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment Verification Unconfirmed</h4>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.5, marginBottom: 24 }}>
            {pollError || 'The transaction could not be verified yet. If you paid, it will credit in the background.'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleManualCheck} disabled={loading} className="btn btn--primary" style={{ padding: '12px', borderRadius: 10, fontWeight: 600 }}>
              {loading ? 'Checking...' : '🔄 Try Checking Again'}
            </button>
            <button onClick={() => setStep('form')} className="btn btn--secondary" style={{ padding: '12px', borderRadius: 10 }}>
              Try a Different Deposit
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h4 style={{ color: '#22c55e', fontSize: 20, marginBottom: 8, fontWeight: 700 }}>Balance Added!</h4>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 24 }}>Your reseller balance has been successfully topped up.</p>
          <button onClick={handleClose} className="btn btn--primary" style={{ padding: '12px 32px', borderRadius: 10 }}>Done</button>
        </div>
      )}
    </Modal>
  );
}

// ─── Withdraw Modal ────────────────────────────────────────────────
function WithdrawModal({ open, onClose, maxAmount, onSuccess }: { open: boolean; onClose: () => void; maxAmount: number; onSuccess: () => void }) {
  const { showToast } = useAdmin();
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return showToast('error', 'Invalid amount');
    if (amt > maxAmount) return showToast('error', `Cannot exceed Total Deposit: ${fmtETB(maxAmount)}`);
    if (!bankName || !accountNumber) return showToast('error', 'Bank name and account number are required');

    setLoading(true);
    try {
      const res = await requestResellerWithdrawal(amt, bankName, accountNumber, accountName);
      if (res.success) {
        showToast('success', 'Withdrawal request submitted & SMS alert dispatched to 251993960702!');
        onSuccess();
        onClose();
      } else {
        showToast('error', res.error || 'Failed to submit withdrawal request');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to submit withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="💸 Request Withdrawal">
      <div style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
        Available from Total Deposit: <strong style={{ color: '#eab308' }}>{fmtETB(maxAmount)}</strong>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Amount to Withdraw (ETB) *</label>
          <input type="number" min="1" max={maxAmount} style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 1000" required autoFocus />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Bank Name *</label>
          <input type="text" style={inputStyle} value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. Commercial Bank of Ethiopia" required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Account Number *</label>
          <input type="text" style={inputStyle} value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="1000123456789" required />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Account Holder Name</label>
          <input type="text" style={inputStyle} value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Full name on account" />
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          ℹ️ Your request will be sent to primora444. Once they manually transfer the money, you'll see the status update to "Sent".
        </div>
        <button type="submit" disabled={loading || !amount || !bankName || !accountNumber} className="btn btn--primary btn--full" style={{ padding: '14px', borderRadius: 10, fontSize: 15, fontWeight: 600, width: '100%', opacity: (loading || !amount || !bankName || !accountNumber) ? 0.6 : 1 }}>
          {loading ? '⏳ Submitting...' : '📤 Submit Withdrawal Request'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Main AccountPage ──────────────────────────────────────────────
export function AccountPage() {
  const { showToast } = useAdmin();
  const [status, setStatus] = useState<ResellerStatus | null>(null);
  const [deposits, setDeposits] = useState<ResellerDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalRequest[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [addBalanceOpen, setAddBalanceOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposits' | 'withdrawals' | 'password'>('deposits');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    loadAll();

    // Auto-open modal if user returned from Chapa redirect
    const pendingTxRef = sessionStorage.getItem('pending_deposit_tx_ref');
    const urlParams = new URLSearchParams(window.location.search);
    if (pendingTxRef || urlParams.get('deposit') === 'reseller') {
      setAddBalanceOpen(true);
      // Clean query parameter from address bar
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function loadAll() {
    setLoadingStatus(true);
    try {
      const [s, d, w] = await Promise.all([
        getResellerStatus(),
        getResellerDepositHistory(),
        getResellerWithdrawalHistory(),
      ]);
      setStatus(s);
      setDeposits(d.deposits || []);
      setWithdrawals(w.withdrawals || []);
    } catch (err: any) {
      showToast('error', 'Failed to load account data');
    } finally {
      setLoadingStatus(false);
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) return showToast('error', 'Passwords do not match');
    if (newPassword.length < 6) return showToast('error', 'Password must be at least 6 characters');
    const stored = localStorage.getItem('admin_token') || '';
    if (currentPassword !== stored) return showToast('error', 'Current password is incorrect');
    setPwLoading(true);
    try {
      await changeAdminPassword(newPassword);
      showToast('success', 'Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
    color: active ? '#818cf8' : 'rgba(255,255,255,0.45)',
    transition: 'all 0.2s',
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>

      {/* ── Balance Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Reseller Balance */}
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.15))', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>💼 Reseller Balance</div>
          {loadingStatus ? (
            <div style={{ height: 32, background: 'rgba(255,255,255,0.07)', borderRadius: 6, marginBottom: 16 }} />
          ) : (
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{fmtETB(status?.reseller_balance || 0)}</div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Min multiplier: {status?.min_rate_multiplier || '—'}</div>
          <button
            onClick={() => setAddBalanceOpen(true)}
            className="btn btn--primary"
            style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}
          >
            ➕ Add Balance
          </button>
        </div>

        {/* Total Deposit */}
        <div style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(16,185,129,0.1))', border: '1px solid rgba(34,197,94,0.35)', borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>📥 Total Deposit</div>
          {loadingStatus ? (
            <div style={{ height: 32, background: 'rgba(255,255,255,0.07)', borderRadius: 6, marginBottom: 16 }} />
          ) : (
            <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 16 }}>{fmtETB(status?.total_deposit || 0)}</div>
          )}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>From your users' deposits</div>
          <button
            onClick={() => setWithdrawOpen(true)}
            disabled={!status?.total_deposit || status.total_deposit <= 0}
            className="btn btn--secondary"
            style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, opacity: (!status?.total_deposit || status.total_deposit <= 0) ? 0.5 : 1 }}
          >
            💸 Request Withdrawal
          </button>
        </div>
      </div>

      {/* ── Rate Multiplier Info ── */}
      {status && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Your Rate Multiplier</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{status.rate_multiplier}x</div>
          </div>
          <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Min Allowed (by joadmin)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7' }}>{status.min_rate_multiplier}x</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={loadAll} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
              🔄 Refresh
            </button>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 4 }}>
        <button style={tabStyle(activeTab === 'deposits')} onClick={() => setActiveTab('deposits')}>📥 Deposit History</button>
        <button style={tabStyle(activeTab === 'withdrawals')} onClick={() => setActiveTab('withdrawals')}>💸 Withdrawal Requests</button>
        <button style={tabStyle(activeTab === 'password')} onClick={() => setActiveTab('password')}>🔐 Password</button>
      </div>

      {/* ── Deposit History ── */}
      {activeTab === 'deposits' && (
        <div id="reseller-deposit-history" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            📥 Reseller Deposit History ({deposits.length})
          </div>
          {deposits.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No deposits yet. Click "Add Balance" to top up!
            </div>
          ) : (
            deposits.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#fff', marginBottom: 2 }}>{fmtETB(d.amount)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmtDate(d.created_at)}</div>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Withdrawal Requests ── */}
      {activeTab === 'withdrawals' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            💸 Withdrawal Requests ({withdrawals.length})
          </div>
          {withdrawals.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              No withdrawal requests yet.
            </div>
          ) : (
            withdrawals.map(w => (
              <div key={w.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>{fmtETB(w.amount)}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{fmtDate(w.created_at)}</div>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <span>🏦 {w.bank_name}</span>
                  <span>💳 {w.account_number}</span>
                  {w.account_name && <span>👤 {w.account_name}</span>}
                  {w.joadmin_request_id && <span style={{ color: 'rgba(99,102,241,0.7)' }}>JO-REQ #{w.joadmin_request_id}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Password Change ── */}
      {activeTab === 'password' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '24px 28px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>🔐 Change Admin Password</h3>
          <form onSubmit={handleChangePassword}>
            {/* Current Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showCurrent ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" style={{ ...inputStyle, paddingRight: 44 }} autoComplete="current-password" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                  {showCurrent ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" style={{ ...inputStyle, paddingRight: 44 }} autoComplete="new-password" />
                <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                  {showNew ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" style={{ ...inputStyle, borderColor: confirmPassword && newPassword && confirmPassword !== newPassword ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)' }} autoComplete="new-password" />
              {confirmPassword && newPassword && confirmPassword !== newPassword && (
                <p style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>Passwords do not match</p>
              )}
            </div>
            <button type="submit" disabled={pwLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword} className="btn btn--primary btn--full" style={{ padding: '13px', borderRadius: 10, fontSize: 14, fontWeight: 600, width: '100%', opacity: (pwLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword) ? 0.5 : 1 }}>
              {pwLoading ? '⏳ Saving...' : '🔒 Update Password'}
            </button>
          </form>
        </div>
      )}

      {/* Modals */}
      <AddBalanceModal open={addBalanceOpen} onClose={() => setAddBalanceOpen(false)} onSuccess={loadAll} />
      <WithdrawModal open={withdrawOpen} onClose={() => setWithdrawOpen(false)} maxAmount={status?.total_deposit || 0} onSuccess={loadAll} />
    </div>
  );
}
