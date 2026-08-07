import { useState, useEffect } from 'react';
import {
  getSettings,
  updateSetting,
  getResellerStatus,
  addResellerBalance,
  withdrawTotalDeposit,
  type AdminSettings,
  type ResellerStatus
} from '../../adminApi';
import { useAdmin } from '../../AdminApp';

export function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [reseller, setReseller] = useState<ResellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { showToast } = useAdmin();

  // Modals state for Add Balance & Withdraw
  const [showAddBalanceModal, setShowAddBalanceModal] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('CBE (Commercial Bank of Ethiopia)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const [settingsData, resellerData] = await Promise.all([
        getSettings(),
        getResellerStatus().catch(() => null)
      ]);
      setSettings(settingsData);
      if (resellerData) setReseller(resellerData);
    } catch (err: any) {
      showToast('error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function save(key: string, value: string) {
    setSaving(key);
    try {
      await updateSetting(key, value);
      showToast('success', `Setting "${key}" updated`);
      // Update local state
      setSettings(prev => prev ? { ...prev, [key]: value } : prev);
      if (key === 'admin_password') {
        const oldToken = localStorage.getItem('admin_token') || '';
        const parts = oldToken.split(':');
        const username = parts[0] || 'admin';
        localStorage.setItem('admin_token', `${username}:${value}`);
      }
    } catch (err: any) {
      showToast('error', err.message);
    } finally {
      setSaving(null);
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
        if (reseller) setReseller({ ...reseller, reseller_balance: res.new_balance });
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
        if (reseller) setReseller({ ...reseller, total_deposit: res.new_total_deposit });
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to process withdrawal');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;
  if (!settings) return <div className="loading-center">Failed to load settings</div>;

  const formatETB = (val: number) => {
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ETB';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.3s ease' }}>
      
      {/* ─── Reseller Balance & Total Deposit Cards ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        
        {/* Reseller Wallet Balance Card */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '20px' }}>
          <div className="stat-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card__label" style={{ color: '#818cf8', fontWeight: 700 }}>Reseller Balance (with joadmin)</span>
            <div className="stat-card__icon stat-card__icon--blue" style={{ fontSize: 20 }}>💳</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 28, color: '#a5b4fc', margin: '12px 0', fontWeight: 700 }}>
            {formatETB(reseller?.reseller_balance ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Wholesale balance used when users place orders on your panel
          </div>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setShowAddBalanceModal(true)}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 700, borderRadius: 8, cursor: 'pointer' }}
          >
            ➕ Add Balance
          </button>
        </div>

        {/* Total Deposit Metric & Withdrawal Card */}
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.08))', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '20px' }}>
          <div className="stat-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-card__label" style={{ color: '#4ade80', fontWeight: 700 }}>Total Deposit (User Deposits)</span>
            <div className="stat-card__icon stat-card__icon--green" style={{ fontSize: 20 }}>💰</div>
          </div>
          <div className="stat-card__value" style={{ fontSize: 28, color: '#86efac', margin: '12px 0', fontWeight: 700 }}>
            {formatETB(reseller?.total_deposit ?? 0)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Cumulative deposits collected from end-users on your panel
          </div>
          <button
            className="btn btn--success btn--sm"
            onClick={() => setShowWithdrawModal(true)}
            style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 700, borderRadius: 8, background: '#10b981', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            💸 Withdraw from Total Deposit
          </button>
        </div>

      </div>

      <div className="settings-grid">
      {/* Pricing Settings */}
      <div className="settings-card">
        <h3 className="settings-card__title">💱 Pricing Configuration</h3>

        <SettingRow
          label="Rate Multiplier (USD → ETB)"
          description={`Service prices from GodOfPanel are in USD. Converted to ETB by this multiplier. (Minimum allowed by Main Admin: ${settings.min_rate_multiplier || '55'})`}
          type="number"
          value={settings.rate_multiplier}
          min={settings.min_rate_multiplier ? parseFloat(settings.min_rate_multiplier) : undefined}
          saving={saving === 'rate_multiplier'}
          onSave={(val) => {
            const minAllowed = settings.min_rate_multiplier ? parseFloat(settings.min_rate_multiplier) : 0;
            if (parseFloat(val) < minAllowed) {
              showToast('error', `Multiplier cannot be set lower than the minimum multiplicity baseline (${minAllowed}) set by main admin (joadmin).`);
              return;
            }
            save('rate_multiplier', val);
          }}
        />

        <SettingRow
          label="Discount Percent"
          description="Global discount percentage applied to all orders. Set to 0 to disable."
          type="number"
          value={settings.discount_percent}
          saving={saving === 'discount_percent'}
          onSave={(val) => save('discount_percent', val)}
        />

        <SettingRow
          label="Holiday / Promo Name"
          description="Display name for the current discount event. Shown in the app marquee."
          type="text"
          value={settings.holiday_name}
          saving={saving === 'holiday_name'}
          onSave={(val) => save('holiday_name', val)}
        />
      </div>

      {/* App Control */}
      <div className="settings-card">
        <h3 className="settings-card__title">🎛️ App Control</h3>

        <SettingToggle
          label="Maintenance Mode"
          description="When enabled, users will see a maintenance message and cannot access the app."
          checked={settings.maintenance_mode === '1' || settings.maintenance_mode === 'true'}
          saving={saving === 'maintenance_mode'}
          onToggle={(val) => save('maintenance_mode', val ? '1' : '0')}
        />

        <SettingToggle
          label="Users Can Order"
          description="When disabled, all order placement is blocked."
          checked={settings.user_can_order === '1' || settings.user_can_order === 'true'}
          saving={saving === 'user_can_order'}
          onToggle={(val) => save('user_can_order', val ? '1' : '0')}
        />

        <SettingRow
          label="Marquee Text"
          description="Scrolling text shown at the top of the app. Use this for announcements."
          type="text"
          value={settings.marquee_text}
          saving={saving === 'marquee_text'}
          onSave={(val) => save('marquee_text', val)}
        />

        <SettingRow
          label="Top Services IDs"
          description="Comma-separated service IDs for the 'Top Services' section (e.g., 102, 10, 50, 45). These will be shown in the exact order specified."
          type="text"
          value={settings.top_services_ids}
          saving={saving === 'top_services_ids'}
          onSave={(val) => save('top_services_ids', val)}
        />
      </div>

      {/* Security Settings */}
      <div className="settings-card">
        <h3 className="settings-card__title">🔒 Security Configuration</h3>

        <SettingRow
          label="Change Admin Password"
          description="Change the password used to log in for this Bot Token. Ensure you remember the new password."
          type="text"
          value="••••••••"
          saving={saving === 'admin_password'}
          onSave={(val) => {
            if (val.trim() && val !== '••••••••') {
              save('admin_password', val.trim());
            }
          }}
        />
      </div>

      {/* ─── Add Balance Modal ─── */}
      {showAddBalanceModal && (
        <div className="modal-backdrop" onClick={() => setShowAddBalanceModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>💳 Deposit Funds to Reseller Balance</h3>
              <button className="modal-close" onClick={() => setShowAddBalanceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddBalanceSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Deposit Amount (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="form-input"
                    placeholder="Enter amount to add..."
                    value={addAmount}
                    onChange={e => setAddAmount(e.target.value)}
                    required
                    autoFocus
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Current Balance: {formatETB(reseller?.reseller_balance ?? 0)}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowAddBalanceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={submittingAdd}>
                  {submittingAdd ? 'Processing...' : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Withdraw Total Deposit Modal ─── */}
      {showWithdrawModal && (
        <div className="modal-backdrop" onClick={() => setShowWithdrawModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>💸 Withdraw from Total Deposit</h3>
              <button className="modal-close" onClick={() => setShowWithdrawModal(false)}>✕</button>
            </div>
            <form onSubmit={handleWithdrawSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Withdrawal Amount (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={reseller?.total_deposit ?? 0}
                    className="form-input"
                    placeholder="Enter amount to withdraw..."
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    required
                    autoFocus
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Max available: {formatETB(reseller?.total_deposit ?? 0)}
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="1000..."
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Account Holder Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Full Name"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn--secondary" onClick={() => setShowWithdrawModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn--success" disabled={submittingWithdraw}>
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

// ─── Setting Row with inline edit ───────────────────────────────
function SettingRow({ label, description, type, value, saving, onSave }: {
  label: string;
  description: string;
  type: 'text' | 'number';
  value: string;
  saving: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300 }}>{description}</div>
        </div>
        {!editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)' }}>{value || '—'}</span>
            <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>Edit</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              className="form-input"
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{ width: 150, padding: '6px 10px', fontSize: 13 }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { onSave(draft); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
            />
            <button className="btn btn--primary btn--sm" disabled={saving} onClick={() => { onSave(draft); setEditing(false); }}>
              {saving ? '...' : 'Save'}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => { setEditing(false); setDraft(value); }}>✕</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Toggle Setting ─────────────────────────────────────────────
function SettingToggle({ label, description, checked, saving, onToggle }: {
  label: string;
  description: string;
  checked: boolean;
  saving: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 300 }}>{description}</div>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={e => onToggle(e.target.checked)} disabled={saving} />
        <span className="toggle__slider" />
      </label>
    </div>
  );
}
