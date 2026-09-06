import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { formatETB } from '../../constants';
import { hapticImpact, hapticSelection } from '../../helpers/telegram';
import type { OrderStatus } from '../../types';

const STATUS_FILTERS: { id: OrderStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'processing', label: 'Processing' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
];

function normalizeStatus(status: string): OrderStatus {
    const s = status.toLowerCase();
    if (s === 'in_progress') return 'processing';
    if (s === 'canceled') return 'cancelled';
    return s as OrderStatus;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function TruncatedLink({ link }: { link: string }) {
    const [expanded, setExpanded] = useState(false);

    if (!link) return null;

    const href = link.startsWith('http') || link.startsWith('t.me') || link.startsWith('@')
        ? (link.startsWith('@') ? `https://t.me/${link.slice(1)}` : link)
        : `https://${link}`;

    const MAX_LEN = 25;
    const isLong = link.length > MAX_LEN;

    return (
        <div className="order-card__link" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', maxWidth: '100%', wordBreak: 'break-all' }}>
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    color: 'var(--tg-theme-link-color, #6ab3f3)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    wordBreak: 'break-all',
                    fontSize: '12px'
                }}
            >
                {expanded || !isLong ? link : `${link.slice(0, MAX_LEN)}...`}
            </a>
            {isLong && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--tg-theme-link-color, #6ab3f3)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '0 2px',
                        textDecoration: 'none',
                        lineHeight: 1
                    }}
                >
                    {expanded ? 'See Less' : 'See More'}
                </button>
            )}
        </div>
    );
}

export function HistoryPage() {
    const { orders, showToast } = useApp();
    const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let result = orders;

        if (filter !== 'all') {
            result = result.filter(o => normalizeStatus(o.status) === filter);
        }

        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(o =>
                o.service_name.toLowerCase().includes(q) ||
                o.api_order_id.toString().includes(q) ||
                o.link.toLowerCase().includes(q)
            );
        }

        return result;
    }, [orders, filter, search]);

    const handleRefill = (orderId: number) => {
        hapticImpact('medium');
        showToast('info', `Refill request sent for order #${orderId}`);
    };

    return (
        <div>
            {/* ─── Search ─── */}
            <input
                className="history-search"
                placeholder="🔍  Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />

            {/* ─── Filter Pills ─── */}
            <div className="filter-row">
                {STATUS_FILTERS.map(f => (
                    <button
                        key={f.id}
                        className={`filter-pill${filter === f.id ? ' filter-pill--active' : ''}`}
                        onClick={() => {
                            hapticSelection();
                            setFilter(f.id);
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* ─── Orders ─── */}
            {filtered.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">📦</div>
                    <div className="empty-state__title">No Orders Found</div>
                    <div className="empty-state__text">
                        {search.trim() || filter !== 'all'
                            ? 'Try adjusting your filters'
                            : "You haven't placed any orders yet"}
                    </div>
                </div>
            ) : (
                <>
                    <div className="paxyo-section-header">
                        Orders ({filtered.length})
                    </div>
                    {filtered.map((order) => {
                        const status = normalizeStatus(order.status);
                        const canRefill = status === 'completed';

                        return (
                        <div className="order-card" key={order.id}>
                                <div className="order-card__header">
                                    <div className="order-card__title">
                                        <span className="order-card__id">#{order.api_order_id}</span>
                                        {order.service_name}
                                    </div>
                                    <span className="order-card__charge">{formatETB(order.charge ?? (order as any).cost ?? 0)}</span>
                                </div>

                                <TruncatedLink link={order.link} />

                                <div className="order-card__meta">
                                    <div className="order-card__stats">
                                        <span>Qty: {order.quantity}</span>
                                        <span>Start: {order.start_count}</span>
                                        <span>Left: {order.remains}</span>
                                    </div>
                                    <span className={`order-card__status order-card__status--${status}`}>
                                        {status}
                                    </span>
                                </div>

                                {(canRefill || true) && (
                                    <div className="order-card__footer">
                                        <span className="order-card__date">{formatDate(order.created_at)}</span>
                                        {canRefill && (
                                            <button
                                                className="order-card__refill"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRefill(order.api_order_id);
                                                }}
                                            >
                                                ♻ Refill
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
