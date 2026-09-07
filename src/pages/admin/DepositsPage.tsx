import { useState, useEffect, useCallback } from 'react';
import { getDeposits, updateDepositStatus, resolveDeposit, type AdminDeposit } from '../../adminApi';
import { StatusBadge } from './DashboardPage';
import { useAdmin } from '../../AdminApp';

export function DepositsPage() {
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Status Change Modal States
  const [selectedDeposit, setSelectedDeposit] = useState<AdminDeposit | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [updateBalance, setUpdateBalance] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { showToast, navigate } = useAdmin();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeposits(page, search, statusFilter);
      setDeposits(data.deposits);
      setTotal(data.total);
    } catch (err: any) {
      showToast('error', 'Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Live Auto-Refresh effect
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      load();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const totalPages = Math.ceil(total / 20);
  const mostRecent = deposits.length > 0 ? deposits[0] : null;

  const openStatusModal = (d: AdminDeposit) => {
    setSelectedDeposit(d);
    setNewStatus(d.status);
    const isCurrentSuccess = d.status === 'completed' || d.status === 'success';
    setUpdateBalance(!isCurrentSuccess);
  };

  const handleQuickResolve = async (d: AdminDeposit, action: 'completed' | 'failed') => {
    setSavingStatus(true);
    try {
      const res = await resolveDeposit(d.id, action);
      showToast('success', res.message || `Deposit #${d.id} marked as ${action}`);
      if (selectedDeposit?.id === d.id) {
        setSelectedDeposit(null);
      }
      load();
    } catch (err: any) {
      showToast('error', err.message || `Failed to resolve deposit #${d.id}`);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedDeposit || !newStatus) return;
    setSavingStatus(true);
    try {
      const res = await updateDepositStatus(selectedDeposit.id, newStatus, updateBalance);
      showToast('success', res.message || `Deposit #${selectedDeposit.id} status updated to ${newStatus}`);
      setSelectedDeposit(null);
      load();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update deposit status');
    } finally {
      setSavingStatus(false);
    }
  };

  const isCurrentSuccess = selectedDeposit ? (selectedDeposit.status === 'completed' || selectedDeposit.status === 'success') : false;
  const isTargetSuccess = newStatus === 'completed' || newStatus === 'success';

  return (
    <>
      {/* ─── ⚡ Most Recent Deposit Hero Banner ─── */}
      {mostRecent && !loading && page === 1 && !search && !statusFilter && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(0, 122, 255, 0.25)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: 24,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(10px)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.5px'
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  animation: 'pulse 1.5s infinite'
                }}></span>
                ⚡ MOST RECENT DEPOSIT
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                ID #{mostRecent.id} • {new Date(mostRecent.created_at).toLocaleString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {mostRecent.status === 'pending' && (
                <>
                  <button
                    className="btn btn--primary btn--sm"
                    style={{ fontSize: 12, background: '#10b981', borderColor: '#10b981' }}
                    disabled={savingStatus}
                    onClick={() => handleQuickResolve(mostRecent, 'completed')}
                  >
                    ✓ Quick Approve (+{Number(mostRecent.amount).toFixed(2)} ETB)
                  </button>
                  <button
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: 12, color: '#ef4444' }}
                    disabled={savingStatus}
                    onClick={() => handleQuickResolve(mostRecent, 'failed')}
                  >
                    ✕ Quick Reject
                  </button>
                </>
              )}
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => navigate('users', { search: mostRecent.user_id, highlightUserId: mostRecent.user_id })}
                style={{ fontSize: 12 }}
              >
                👤 View User
              </button>
              <button
                className="btn btn--primary btn--sm"
                onClick={() => openStatusModal(mostRecent)}
                style={{ fontSize: 12 }}
              >
                ✏️ Edit Status
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #007aff 0%, #00c6ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 'bold',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0, 122, 255, 0.4)'
              }}>
                {(mostRecent.first_name || mostRecent.user_id)?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  {mostRecent.first_name || mostRecent.user_id}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {mostRecent.username ? `@${mostRecent.username}` : `User ID: ${mostRecent.user_id}`}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Amount Deposited
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                +{Number(mostRecent.amount).toFixed(2)} <span style={{ fontSize: 13, opacity: 0.8 }}>ETB</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                Transaction Ref
              </div>
              <code style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: 6, display: 'inline-block' }}>
                {mostRecent.tx_ref}
              </code>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                Current Status
              </div>
              <div>
                <StatusBadge status={mostRecent.status} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Controls Header ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{total} deposits</span>
          
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            className={`btn ${autoRefresh ? 'btn--primary' : 'btn--secondary'} btn--sm`}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Toggle automatic live polling every 10 seconds"
          >
            {autoRefresh ? '🔄 Live Sync (ON)' : '🔄 Live Sync (OFF)'}
          </button>
        </div>

        <div className="search-bar">
          <span className="search-bar__icon">🔍</span>
          <input className="search-bar__input" placeholder="Search deposits..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
              <th>Reference</th>
              <th>Created</th>
              <th>Completed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="loading-center"><div className="spinner" /></td></tr>
            ) : deposits.length === 0 ? (
              <tr><td colSpan={8} className="data-table-empty">No deposits found</td></tr>
            ) : deposits.map((d, index) => {
              const isLatest = index === 0 && page === 1 && !search && !statusFilter;
              return (
                <tr key={d.id} style={isLatest ? { background: 'rgba(16, 185, 129, 0.04)' } : undefined}>
                  <td>
                    #{d.id}
                    {isLatest && (
                      <span style={{
                        marginLeft: 6,
                        fontSize: 10,
                        fontWeight: 700,
                        background: '#10b981',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: 10
                      }}>
                        ⚡ LATEST
                      </span>
                    )}
                  </td>
                  <td>
                    <div
                      className="user-info user-info--clickable"
                      onClick={() => navigate('users', { search: d.user_id, highlightUserId: d.user_id })}
                      title="Click to view user in User Management"
                    >
                      <div className="user-avatar">{(d.first_name || d.user_id)?.[0]?.toUpperCase() || '?'}</div>
                      <div>
                        <div className="user-info__name">{d.first_name || d.user_id}</div>
                        {d.username && <div className="user-info__sub">@{d.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>{Number(d.amount).toFixed(2)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {d.status === 'pending' && (
                        <>
                          <button
                            className="btn btn--primary btn--sm"
                            style={{ fontSize: 11, padding: '4px 8px', background: '#10b981', borderColor: '#10b981' }}
                            disabled={savingStatus}
                            onClick={() => handleQuickResolve(d, 'completed')}
                            title="Approve & Credit Balance"
                          >
                            ✓ Approve
                          </button>
                          <button
                            className="btn btn--secondary btn--sm"
                            style={{ fontSize: 11, padding: '4px 8px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                            disabled={savingStatus}
                            onClick={() => handleQuickResolve(d, 'failed')}
                            title="Reject Deposit"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      <button
                        className="btn btn--secondary btn--sm"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => openStatusModal(d)}
                      >
                        ✏️ Status
                      </button>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.tx_ref}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(d.created_at).toLocaleString()}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.completed_at ? new Date(d.completed_at).toLocaleString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="pagination__btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
            const p = page <= 3 ? i + 1 : page + i - 2;
            if (p < 1 || p > totalPages) return null;
            return <button key={p} className={`pagination__btn ${page === p ? 'pagination__btn--active' : ''}`} onClick={() => setPage(p)}>{p}</button>;
          })}
          <button className="pagination__btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
        </div>
      )}

      {/* Deposit Status Modal */}
      {selectedDeposit && (
        <div className="modal-overlay" onClick={() => setSelectedDeposit(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal__header">
              <h2 className="modal__title">Update Deposit #{selectedDeposit.id} Status</h2>
              <button className="modal__close" onClick={() => setSelectedDeposit(null)}>✕</button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>User:</span>
                <strong>{selectedDeposit.first_name || selectedDeposit.user_id} {selectedDeposit.username ? `(@${selectedDeposit.username})` : ''}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount:</span>
                <strong style={{ color: 'var(--success)' }}>{Number(selectedDeposit.amount).toFixed(2)} ETB</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Reference:</span>
                <code style={{ fontSize: 11 }}>{selectedDeposit.tx_ref}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Current Status:</span>
                <StatusBadge status={selectedDeposit.status} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">New Status</label>
              <select
                className="form-input"
                value={newStatus}
                onChange={e => {
                  const target = e.target.value;
                  setNewStatus(target);
                  const isTargetSucc = target === 'completed' || target === 'success';
                  if (isTargetSucc && !isCurrentSuccess) {
                    setUpdateBalance(true);
                  } else if (!isTargetSucc && isCurrentSuccess) {
                    setUpdateBalance(true);
                  }
                }}
              >
                <option value="completed">Completed</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={updateBalance}
                  onChange={e => setUpdateBalance(e.target.checked)}
                />
                Sync user balance with this status update
              </label>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'block', paddingLeft: 24 }}>
                {updateBalance ? (
                  isTargetSuccess && !isCurrentSuccess ? (
                    <span style={{ color: '#10b981' }}>✓ Will credit +{Number(selectedDeposit.amount).toFixed(2)} ETB to user balance.</span>
                  ) : !isTargetSuccess && isCurrentSuccess ? (
                    <span style={{ color: '#ef4444' }}>⚠️ Will deduct -{Number(selectedDeposit.amount).toFixed(2)} ETB from user balance.</span>
                  ) : (
                    <span>ℹ️ No balance change (status transition between non-success or between success states).</span>
                  )
                ) : (
                  <span>ℹ️ Balance will NOT be changed when status updates.</span>
                )}
              </span>
            </div>

            <div className="modal__footer" style={{ marginTop: 20 }}>
              <button className="btn btn--secondary" disabled={savingStatus} onClick={() => setSelectedDeposit(null)}>Cancel</button>
              <button className="btn btn--primary" disabled={savingStatus} onClick={handleStatusChange}>
                {savingStatus ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
