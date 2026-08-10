import { useState, useCallback, createContext, useContext, useRef } from 'react';
import { DashboardPage } from './pages/admin/DashboardPage';
import { UsersPage } from './pages/admin/UsersPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { DepositsPage } from './pages/admin/DepositsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { ServicesPage } from './pages/admin/ServicesPage';
import { WithdrawalsPage } from './pages/admin/WithdrawalsPage';
import { FinancePage } from './pages/admin/FinancePage';
import { BroadcastPage } from './pages/admin/BroadcastPage';
import { AccountPage } from './pages/admin/AccountPage';
import { loginAdmin, logoutAdmin, isLoggedIn } from './adminApi';

function LoginScreen({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return;
    setLoading(true);
    try {
      await loginAdmin(password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'radial-gradient(circle at top right, #1e1b4b, #09090b)',
      color: '#fff',
      fontFamily: 'system-ui, sans-serif',
      padding: 20
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        padding: '44px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 120px rgba(99,102,241,0.12)',
        textAlign: 'center'
      }}>
        <div style={{
          width: 72,
          height: 72,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          borderRadius: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
          margin: '0 auto 28px',
          boxShadow: '0 0 40px rgba(99,102,241,0.45)'
        }}>🔑</div>

        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.03em' }}>
          Admin Access
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 32 }}>
          Enter your password to continue
        </p>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 20,
            textAlign: 'left'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  padding: '14px 48px 14px 16px',
                  borderRadius: 10,
                  color: '#fff',
                  fontSize: 15,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  letterSpacing: showPassword ? 'normal' : '0.1em',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 17, color: 'rgba(255,255,255,0.4)', padding: 0,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={loading || !password}
            style={{
              padding: '14px 20px',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              width: '100%',
              display: 'block',
              opacity: (loading || !password) ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? '⏳ Signing in...' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}


// ─── Toast System ──────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; message: string; }

interface AdminContextType {
  showToast: (type: ToastType, message: string) => void;
  navigate: (page: string, state?: any) => void;
  navState?: any;
  clearNavState: () => void;
}

export const AdminContext = createContext<AdminContextType>({
  showToast: () => {},
  navigate: () => {},
  navState: null,
  clearNavState: () => {},
});

export const useAdmin = () => useContext(AdminContext);

// ─── Page Type ─────────────────────────────────────────────────
type Page = 'dashboard' | 'finance' | 'users' | 'orders' | 'deposits' | 'settings' | 'services' | 'withdrawals' | 'broadcast' | 'account';

const NAV_ITEMS: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'finance', label: 'Finance', icon: '💵' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'orders', label: 'Orders', icon: '📦' },
  { id: 'deposits', label: 'Deposits', icon: '💰' },
  { id: 'withdrawals', label: 'Withdrawals', icon: '💸' },
  { id: 'broadcast', label: 'Broadcasting', icon: '📢' },
  { id: 'services', label: 'Services', icon: '⚡' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Dashboard',
  finance: 'Financial Overview',
  users: 'User Management',
  orders: 'Order History',
  deposits: 'Deposit History',
  withdrawals: 'Withdrawals',
  broadcast: 'Real-time Telegram Broadcasting',
  services: 'Service Rates',
  settings: 'App Settings',
  account: 'My Account',
};

// ─── Main Admin App ────────────────────────────────────────────
export function AdminApp() {
  const [authenticated, setAuthenticated] = useState(isLoggedIn());
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [navState, setNavState] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const navigate = useCallback((page: string, state?: any) => {
    setCurrentPage(page as Page);
    setNavState(state || null);
    setSidebarOpen(false);
  }, []);

  const clearNavState = useCallback(() => {
    setNavState(null);
  }, []);


  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <DashboardPage />;
      case 'finance': return <FinancePage />;
      case 'users': return <UsersPage />;
      case 'orders': return <OrdersPage />;
      case 'deposits': return <DepositsPage />;
      case 'withdrawals': return <WithdrawalsPage />;
      case 'broadcast': return <BroadcastPage />;
      case 'services': return <ServicesPage />;
      case 'settings': return <SettingsPage />;
      case 'account': return <AccountPage />;
      default: return <DashboardPage />;
    }
  };

  if (!authenticated) {
    return <LoginScreen onLoginSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <AdminContext.Provider value={{ showToast, navigate, navState, clearNavState }}>
      <div className="admin-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
          <div className="sidebar__brand">
            <div className="sidebar__logo">P</div>
            <div>
              <div className="sidebar__title">primora444</div>
              <div className="sidebar__subtitle">Admin Panel</div>
            </div>
          </div>

          <nav className="sidebar__nav" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 70px)' }}>
            <div className="sidebar__section-label">Main</div>
            {NAV_ITEMS.slice(0, 4).map(item => (
              <div
                key={item.id}
                className={`sidebar__link ${currentPage === item.id ? 'sidebar__link--active' : ''}`}
                onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}
              >
                <span className="sidebar__link-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}
            <div className="sidebar__section-label">Configuration</div>
            {NAV_ITEMS.slice(4).map(item => (
              <div
                key={item.id}
                className={`sidebar__link ${currentPage === item.id ? 'sidebar__link--active' : ''}`}
                onClick={() => { setCurrentPage(item.id); setSidebarOpen(false); }}
              >
                <span className="sidebar__link-icon">{item.icon}</span>
                {item.label}
              </div>
            ))}

            <div
              className={`sidebar__link ${currentPage === 'account' ? 'sidebar__link--active' : ''}`}
              style={{ marginTop: 'auto' }}
              onClick={() => { setCurrentPage('account'); setSidebarOpen(false); }}
            >
              <span className="sidebar__link-icon">👤</span>
              Account
            </div>

            <div
              className="sidebar__link"
              style={{ color: '#ef4444' }}
              onClick={() => { logoutAdmin(); setAuthenticated(false); }}
            >
              <span className="sidebar__link-icon">🚪</span>
              Sign Out
            </div>
          </nav>


        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="main-content">
          <header className="header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
              <h1 className="header__title">{PAGE_TITLES[currentPage]}</h1>
            </div>
            <div className="header__actions">
              <div className="user-info">
                <div>
                  <div className="user-info__name">Admin</div>
                  <div className="user-info__sub">primora444 Panel</div>
                </div>
                <div className="user-avatar">A</div>
              </div>
            </div>
          </header>

          <div className="page-content">
            {renderPage()}
          </div>
        </main>

        {/* Toasts */}
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast--${t.type}`}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.message}
            </div>
          ))}
        </div>
      </div>
    </AdminContext.Provider>
  );
}
