import { useState, useEffect } from 'react';
import { getHolidays, saveHoliday, deleteHoliday, toggleHolidayStatus, seedHolidayPresets, type Holiday } from '../../adminApi';
import { useAdmin } from '../../AdminApp';

function formatDate(val: any): string {
  if (!val) return 'Anytime';
  if (typeof val === 'object' && val instanceof Date) {
    return val.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const str = String(val).split('T')[0];
  if (str === 'null' || str === 'undefined' || !str) return 'Anytime';
  try {
    const d = new Date(str + 'T00:00:00');
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return str;
  }
}

export function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<'all' | 'ethiopian' | 'international' | 'active'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Partial<Holiday> | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const { showToast } = useAdmin();

  useEffect(() => {
    fetchHolidays();
  }, []);

  async function fetchHolidays() {
    try {
      setLoading(true);
      const data = await getHolidays();
      if (data && (data.success || Array.isArray((data as any).holidays))) {
        setHolidays((data as any).holidays || []);
      } else {
        setHolidays([]);
      }
    } catch (err: any) {
      console.error('[fetchHolidays error]', err);
      showToast('error', err.message || 'Failed to load holiday calendar');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(h: Holiday) {
    try {
      const res = await toggleHolidayStatus(h.id);
      if (res.success) {
        showToast('success', `${h.name} status updated to ${res.status.toUpperCase()}`);
        setHolidays(prev =>
          prev.map(item =>
            item.id === h.id ? { ...item, status: res.status } : (res.status === 'active' ? { ...item, status: 'inactive' } : item)
          )
        );
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to toggle status');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      await deleteHoliday(id);
      showToast('success', `Deleted "${name}"`);
      setHolidays(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete');
    }
  }

  async function handleSeedPresets() {
    try {
      setSeeding(true);
      const res = await seedHolidayPresets();
      if (res.success) {
        showToast('success', res.message || 'Holiday presets added!');
        await fetchHolidays();
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to seed presets');
    } finally {
      setSeeding(false);
    }
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHoliday?.name || editingHoliday.discount_percent === undefined) {
      showToast('error', 'Event Name and Discount Percentage are required');
      return;
    }

    const cleanStart = editingHoliday.start_date ? String(editingHoliday.start_date).split('T')[0] : null;
    const cleanEnd = editingHoliday.end_date ? String(editingHoliday.end_date).split('T')[0] : null;

    try {
      setSaving(true);
      await saveHoliday({
        ...editingHoliday,
        start_date: cleanStart || undefined,
        end_date: cleanEnd || undefined,
      });
      showToast('success', editingHoliday.id ? 'Holiday updated successfully!' : 'New holiday created!');
      setShowModal(false);
      setEditingHoliday(null);
      await fetchHolidays();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save holiday');
    } finally {
      setSaving(false);
    }
  }

  const activeHoliday = holidays.find(h => h.status === 'active');

  const filteredHolidays = holidays.filter(h => {
    if (filterCategory === 'ethiopian') return h.category === 'ethiopian';
    if (filterCategory === 'international') return h.category === 'international';
    if (filterCategory === 'active') return h.status === 'active';
    return true;
  });

  if (loading) {
    return <div className="loading-center"><div className="spinner" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      
      {/* ─── Active Promotion Banner ─────────────────────────────── */}
      {activeHoliday ? (
        <div style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: 16,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
            }}>🎉</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a855f7' }}>
                CURRENTLY ACTIVE PROMOTION
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: '2px 0 4px 0', color: '#fff' }}>
                {activeHoliday.name}
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                {activeHoliday.start_date && activeHoliday.end_date ? `Valid from ${formatDate(activeHoliday.start_date)} to ${formatDate(activeHoliday.end_date)}` : 'Ongoing Special Discount'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80',
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: 18,
              fontWeight: 800
            }}>
              {activeHoliday.discount_percent}% OFF
            </div>
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => handleToggleStatus(activeHoliday)}
              style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}
            >
              Deactivate Promo
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: 16,
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14
        }}>
          <span>💡 No active holiday discount running right now. Turn on a holiday switch below to activate promotional rates for users!</span>
        </div>
      )}

      {/* ─── Actions & Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        {/* Category Filters */}
        <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <button
            className={`btn btn--sm ${filterCategory === 'all' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilterCategory('all')}
            style={{ border: 'none' }}
          >
            All Holidays ({holidays.length})
          </button>
          <button
            className={`btn btn--sm ${filterCategory === 'ethiopian' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilterCategory('ethiopian')}
            style={{ border: 'none' }}
          >
            🇪🇹 Ethiopian ({holidays.filter(h => h.category === 'ethiopian').length})
          </button>
          <button
            className={`btn btn--sm ${filterCategory === 'international' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilterCategory('international')}
            style={{ border: 'none' }}
          >
            🌐 International ({holidays.filter(h => h.category === 'international').length})
          </button>
          <button
            className={`btn btn--sm ${filterCategory === 'active' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setFilterCategory('active')}
            style={{ border: 'none' }}
          >
            ⭐ Active ({holidays.filter(h => h.status === 'active').length})
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => setViewMode(viewMode === 'cards' ? 'calendar' : 'cards')}
          >
            {viewMode === 'cards' ? '📅 Calendar View' : '📇 Card View'}
          </button>
          <button
            className="btn btn--secondary btn--sm"
            disabled={seeding}
            onClick={handleSeedPresets}
            title="Load standard Ethiopian & International Holiday Presets into database"
          >
            {seeding ? '⏳ Loading Presets...' : '✨ Load Holiday Presets'}
          </button>
          <button
            className="btn btn--primary btn--sm"
            onClick={() => {
              setEditingHoliday({
                name: '',
                discount_percent: 15,
                status: 'inactive',
                category: 'ethiopian',
                is_recurring: 1,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
                description: '',
              });
              setShowModal(true);
            }}
          >
            + Add Holiday
          </button>
        </div>
      </div>

      {/* ─── Content View ────────────────────────────────────────────── */}
      {viewMode === 'cards' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filteredHolidays.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
              No holiday promos found in this view. Click <strong>"✨ Load Holiday Presets"</strong> to automatically import Ethiopian and International holidays!
            </div>
          ) : (
            filteredHolidays.map(h => (
              <div
                key={h.id}
                style={{
                  background: h.status === 'active'
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: h.status === 'active'
                    ? '1px solid rgba(168, 85, 247, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'all 0.2s ease',
                  boxShadow: h.status === 'active' ? '0 4px 20px rgba(99, 102, 241, 0.2)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: h.category === 'ethiopian' ? 'rgba(99, 102, 241, 0.2)' : h.category === 'international' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      color: h.category === 'ethiopian' ? '#818cf8' : h.category === 'international' ? '#c084fc' : '#e2e8f0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {h.category === 'ethiopian' ? '🇪🇹 Ethiopian' : h.category === 'international' ? '🌐 International' : '✏️ Custom'}
                    </span>

                    <span style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#4ade80',
                      background: 'rgba(34, 197, 94, 0.12)',
                      padding: '2px 8px',
                      borderRadius: 6
                    }}>
                      {h.discount_percent}% OFF
                    </span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px 0', color: '#fff' }}>
                    {h.name}
                  </h3>

                  {h.description && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                      {h.description}
                    </p>
                  )}

                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🗓️</span>
                    <span>
                      {formatDate(h.start_date)}
                      {' — '}
                      {formatDate(h.end_date)}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={h.status === 'active'}
                        onChange={() => handleToggleStatus(h)}
                      />
                      <span className="toggle__slider" />
                    </label>
                    <span style={{ fontSize: 12, fontWeight: 600, color: h.status === 'active' ? '#4ade80' : 'rgba(255,255,255,0.4)' }}>
                      {h.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => {
                        const cleanStart = h.start_date ? String(h.start_date).split('T')[0] : '';
                        const cleanEnd = h.end_date ? String(h.end_date).split('T')[0] : '';
                        setEditingHoliday({ ...h, start_date: cleanStart, end_date: cleanEnd });
                        setShowModal(true);
                      }}
                      style={{ padding: '4px 8px', fontSize: 12 }}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={() => handleDelete(h.id, h.name)}
                      style={{ padding: '4px 8px', fontSize: 12, color: '#ef4444' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ─── Calendar Timeline / Month View ──────────────────────────── */
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          padding: 24
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>🗓️ Scheduled Holidays Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredHolidays.map(h => (
              <div key={h.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: h.status === 'active' ? 'rgba(99,102,241,0.15)' : 'rgba(0,0,0,0.2)',
                borderLeft: `4px solid ${h.category === 'ethiopian' ? '#6366f1' : h.category === 'international' ? '#a855f7' : '#ec4899'}`,
                borderRadius: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 20 }}>
                    {h.category === 'ethiopian' ? '🇪🇹' : h.category === 'international' ? '🌐' : '⭐'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                      {formatDate(h.start_date)} to {formatDate(h.end_date)}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontWeight: 800, color: '#4ade80', fontSize: 14 }}>{h.discount_percent}% OFF</span>
                  <button
                    className={`btn btn--sm ${h.status === 'active' ? 'btn--primary' : 'btn--secondary'}`}
                    onClick={() => handleToggleStatus(h)}
                  >
                    {h.status === 'active' ? 'Active' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Modal Form ──────────────────────────────────────────────── */}
      {showModal && editingHoliday && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: '#121218',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 18,
            width: '100%',
            maxWidth: 500,
            padding: 28,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {editingHoliday.id ? '✏️ Edit Holiday Promo' : '✨ Add New Holiday Promo'}
              </h3>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => { setShowModal(false); setEditingHoliday(null); }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                  Event / Holiday Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Enkutatash Sale 🌼"
                  value={editingHoliday.name || ''}
                  onChange={e => setEditingHoliday({ ...editingHoliday, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                    Discount Rate (%)
                  </label>
                  <input
                    type="number"
                    className="form-input"
                    min="0"
                    max="100"
                    value={editingHoliday.discount_percent ?? 15}
                    onChange={e => setEditingHoliday({ ...editingHoliday, discount_percent: parseInt(e.target.value, 10) })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                    Category
                  </label>
                  <select
                    className="form-input"
                    value={editingHoliday.category || 'ethiopian'}
                    onChange={e => setEditingHoliday({ ...editingHoliday, category: e.target.value as any })}
                  >
                    <option value="ethiopian">🇪🇹 Ethiopian Holiday</option>
                    <option value="international">🌐 International Holiday</option>
                    <option value="custom">⭐ Custom Event</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={editingHoliday.start_date || ''}
                    onChange={e => setEditingHoliday({ ...editingHoliday, start_date: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                    End Date
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={editingHoliday.end_date || ''}
                    onChange={e => setEditingHoliday({ ...editingHoliday, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(255,255,255,0.7)' }}>
                  Description / Announcement Note
                </label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Optional notes or promo banner message..."
                  value={editingHoliday.description || ''}
                  onChange={e => setEditingHoliday({ ...editingHoliday, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={editingHoliday.status === 'active'}
                    onChange={e => setEditingHoliday({ ...editingHoliday, status: e.target.checked ? 'active' : 'inactive' })}
                  />
                  <span className="toggle__slider" />
                </label>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Activate immediately upon saving</span>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => { setShowModal(false); setEditingHoliday(null); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : editingHoliday.id ? 'Save Changes' : 'Create Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
