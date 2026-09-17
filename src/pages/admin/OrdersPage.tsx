import { useState, useEffect, useCallback } from 'react';
import { getOrders, type AdminOrder } from '../../adminApi';
import { StatusBadge } from './DashboardPage';
import { useAdmin } from '../../AdminApp';

export function ExpandableLink({ url }: { url: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!url) return <span>—</span>;

  const isLong = url.length > 25;
  const displayUrl = isLong && !expanded ? url.substring(0, 22) + '...' : url;

  return (
    <div style={{ wordBreak: 'break-all', maxWidth: 220 }}>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
        {displayUrl}
      </a>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--accent)',
            fontSize: 11,
            cursor: 'pointer',
            marginLeft: 6,
            textDecoration: 'underline',
            padding: 0,
            lineHeight: 1
          }}
        >
          {expanded ? 'Less' : 'See More'}
        </button>
      )}
    </div>
  );
}

export function OrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast, navigate } = useAdmin();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders(page, search, statusFilter);
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err: any) {
      showToast('error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{total} orders</span>
          <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="partial">Partial</option>
          </select>
        </div>
        <div className="search-bar">
          <span className="search-bar__icon">🔍</span>
          <input className="search-bar__input" placeholder="Search orders..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Service ID</th>
              <th>Starting From</th>
              <th>Link</th>
              <th>Qty</th>
              <th>Cost (ETB)</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="loading-center"><div className="spinner" /></td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="data-table-empty">No orders found</td></tr>
            ) : orders.map(o => {
              const displayId = o.provider_order_id || (o as any).api_order_id || o.id;
              const linkUrl = o.target_link || (o as any).link || '';
              return (
                <tr key={o.id}>
                  <td title={`Local DB ID: #${o.id}`} style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    #{displayId}
                  </td>
                  <td>
                    <div
                      className="user-info user-info--clickable"
                      onClick={() => navigate('users', { search: o.user_id, highlightUserId: o.user_id })}
                      title="Click to view user in User Management"
                    >
                      <div className="user-avatar">{(o.first_name || o.user_id)?.[0]?.toUpperCase() || '?'}</div>
                      <div>
                        <div className="user-info__name">{o.first_name || o.user_id}</div>
                        {o.username && <div className="user-info__sub">@{o.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{o.service_id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                    {o.start_count !== undefined && o.start_count !== null ? o.start_count.toLocaleString() : '—'}
                  </td>
                  <td>
                    <ExpandableLink url={linkUrl} />
                  </td>
                  <td>{o.quantity.toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{Number(o.cost ?? (o as any).charge ?? 0).toFixed(2)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(o.created_at).toLocaleString()}</td>
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
    </>
  );
}
