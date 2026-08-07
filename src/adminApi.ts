// ─── Admin API Client ──────────────────────────────────────────

const API_URL = import.meta.env.VITE_NODE_API_URL || '/api';

export async function loginAdmin(password: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text)?.error || text; } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  const data = await res.json();
  localStorage.setItem('admin_token', data.token);
  return data;
}

export function logoutAdmin() {
  localStorage.removeItem('admin_token');
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('admin_token');
}

async function adminFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('admin_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options?.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    logoutAdmin();
    window.location.reload();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function changeAdminPassword(newPassword: string): Promise<{ success: boolean }> {
  const result = await adminFetch<{ success: boolean }>('/admin/change-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  });
  // Update the stored token to the new password
  localStorage.setItem('admin_token', newPassword);
  return result;
}



// ─── Dashboard Stats ────────────────────────────────────────────

export interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalDeposits: number;
  totalRevenue: number;
  recentOrders: AdminOrder[];
  recentDeposits: AdminDeposit[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return adminFetch<DashboardStats>('/admin/dashboard');
}

// ─── Users ──────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  tg_id: string;
  username: string;
  first_name: string;
  last_name: string;
  photo_url: string;
  balance: number;
  role: string;
  last_login: string;
  created_at: string;
  last_deposit: string | null;
  last_order: string | null;
  total_spent: number | null;
  phone_number?: string | null;
  phone_verified?: number | boolean;
}

export type SortBy = 'recent_registration' | 'big_balance' | 'total_spent' | 'recent_active' | 'last_deposit' | 'last_order';
export type SortOrder = 'asc' | 'desc';

export async function getUsers(page = 1, search = '', username = '', sortBy: SortBy = 'recent_active', sortOrder: SortOrder = 'desc'): Promise<{ users: AdminUser[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.append('search', search);
  if (username) params.append('username', username);
  if (sortBy) params.append('sortBy', sortBy);
  if (sortOrder) params.append('sortOrder', sortOrder);
  return adminFetch(`/admin/users?${params}`);
}

export async function updateUserBalance(tgId: string, amount: number): Promise<{ success: boolean; newBalance: number }> {
  return adminFetch('/admin/users/balance', {
    method: 'POST',
    body: JSON.stringify({ tg_id: tgId, amount }),
  });
}

export async function updateUserRole(tgId: string, role: string): Promise<{ success: boolean }> {
  return adminFetch('/admin/users/role', {
    method: 'POST',
    body: JSON.stringify({ tg_id: tgId, role }),
  });
}

export async function sendAlert(target: string, title: string, message: string, type: string = 'info'): Promise<{ success: boolean }> {
  return adminFetch('/admin/alerts', {
    method: 'POST',
    body: JSON.stringify({ target, title, message, type }),
  });
}

// ─── Orders ─────────────────────────────────────────────────────

export interface AdminOrder {
  id: number;
  user_id: string;
  service_id: number;
  target_link: string;
  quantity: number;
  provider_order_id: string;
  cost?: number;
  charge?: number;
  status: string;
  start_count: number;
  remains: number;
  created_at: string;
  username?: string;
  first_name?: string;
}

export async function getOrders(page = 1, search = '', status = ''): Promise<{ orders: AdminOrder[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  return adminFetch(`/admin/orders?${params}`);
}

// ─── Deposits ───────────────────────────────────────────────────

export interface AdminDeposit {
  id: number;
  user_id: string;
  amount: number;
  tx_ref: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  username?: string;
  first_name?: string;
}

export async function getDeposits(page = 1, search = '', status = ''): Promise<{ deposits: AdminDeposit[]; total: number }> {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) params.append('search', search);
  if (status) params.append('status', status);
  return adminFetch(`/admin/deposits?${params}`);
}

// ─── Settings ───────────────────────────────────────────────────

export interface AdminSettings {
  rate_multiplier: string;
  min_rate_multiplier?: string;
  reseller_balance?: string;
  total_deposit?: string;
  discount_percent: string;
  holiday_name: string;
  maintenance_mode: string;
  user_can_order: string;
  marquee_text: string;
  top_services_ids: string;
}

export async function getSettings(): Promise<AdminSettings> {
  return adminFetch<AdminSettings>('/admin/settings');
}

export async function updateSetting(key: string, value: string): Promise<{ success: boolean }> {
  return adminFetch('/admin/settings', {
    method: 'POST',
    body: JSON.stringify({ key, value }),
  });
}

// ─── Reseller Operations ────────────────────────────────────────

export interface ResellerStatus {
  success: boolean;
  reseller_balance: number;
  total_deposit: number;
  min_rate_multiplier: number;
  rate_multiplier: number;
}

export async function getResellerStatus(): Promise<ResellerStatus> {
  return adminFetch<ResellerStatus>('/admin/reseller/status');
}

export async function addResellerBalance(amount: number): Promise<{ success: boolean; new_balance: number }> {
  return adminFetch('/admin/reseller/add-balance', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function withdrawTotalDeposit(
  amount: number,
  bank_name: string,
  account_number: string,
  account_name?: string
): Promise<{ success: boolean; new_total_deposit: number }> {
  return adminFetch('/admin/reseller/withdraw-deposit', {
    method: 'POST',
    body: JSON.stringify({ amount, bank_name, account_number, account_name }),
  });
}

// ─── Services ───────────────────────────────────────────────────

export interface AdminService {
  service: number;
  name: string;
  category: string;
  type: string;
  rate: string;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  is_enabled?: boolean;
  profit_margin?: number;
  has_custom?: boolean;
  custom_description?: string | null;
}

export async function getAdminServices(): Promise<AdminService[]> {
  return adminFetch<AdminService[]>('/services?include_disabled=1');
}

export interface ServiceCustomPricing {
  service_id: number;
  custom_rate: number | null;
  profit_margin: number;
  is_enabled: boolean;
  custom_description: string | null;
}

export async function getCustomPricing(): Promise<ServiceCustomPricing[]> {
  return adminFetch<ServiceCustomPricing[]>('/admin/services/custom');
}

export async function setCustomPricing(
  serviceId: number,
  customRate: number | null,
  profitMargin: number | null,
  isEnabled: boolean | null,
  customDescription: string | null
): Promise<{ success: boolean }> {
  return adminFetch('/admin/services/custom', {
    method: 'POST',
    body: JSON.stringify({
      service_id: serviceId,
      custom_rate: customRate,
      profit_margin: profitMargin,
      is_enabled: isEnabled,
      custom_description: customDescription
    }),
  });
}

export async function deleteCustomPricing(serviceId: number): Promise<{ success: boolean }> {
  return adminFetch(`/admin/services/custom/${serviceId}`, {
    method: 'DELETE',
  });
}

export interface ServiceActivity {
  service_id: number;
  custom_rate: number | null;
  profit_margin: number;
  is_enabled: boolean;
  custom_description: string | null;
  updated_at: string;
}

export async function getServiceActivity(): Promise<ServiceActivity[]> {
  return adminFetch<ServiceActivity[]>('/admin/services/activity');
}

export async function getDisabledServices(): Promise<ServiceActivity[]> {
  return adminFetch<ServiceActivity[]>('/admin/services/disabled');
}


// ─── Withdrawals ──────────────────────────────────────────────────

export interface AdminWithdrawal {
  id: number;
  user_id: string;
  amount: number;
  full_name: string;
  bank_name: string;
  account_number: string;
  status: 'pending' | 'done';
  created_at: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function getWithdrawals(): Promise<{ success: boolean; withdrawals: AdminWithdrawal[] }> {
  return adminFetch<{ success: boolean; withdrawals: AdminWithdrawal[] }>('/admin/withdrawals');
}

export async function approveWithdrawal(id: number): Promise<{ success: boolean }> {
  return adminFetch<{ success: boolean }>('/admin/withdrawals/approve', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

// ─── Finance Stats ──────────────────────────────────────────────

export interface FinanceStats {
  success: boolean;
  totalRevenue: number;
  todayRevenue: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalWithdrawn: number;
  todayWithdrawals: number;
  weeklyWithdrawals: number;
  monthlyWithdrawals: number;
  withdrawableBalance: number;
  pendingWithdrawals: number;
  totalWithdrawals: number;
  totalWithdrawalsCount: number;
  totalPayingUsers: number;
  providerCosts: number;
  revenueGrowth: number;
}

export async function getFinanceStats(): Promise<FinanceStats> {
  return adminFetch<FinanceStats>('/admin/finance-stats');
}

export async function sendTelegramMessage(target: string, message: string, imageUrl?: string): Promise<{ success: boolean; message?: string; results?: Array<{ tg_id: string; name: string; status: string; error?: string }> }> {
  return adminFetch('/admin/send-telegram', {
    method: 'POST',
    body: JSON.stringify({ target, message, imageUrl }),
  });
}

// ─── Broadcasts ─────────────────────────────────────────────────

export interface AdminBroadcast {
  id: number;
  message: string;
  image_url: string | null;
  btn_text: string;
  btn_url: string;
  created_at: string;
  sent_count: number;
  failed_count: number;
}

export interface BroadcastMessageDetail {
  id: number;
  broadcast_id: number;
  tg_id: string;
  telegram_message_id: number;
  status: 'sent' | 'failed';
  error_message: string | null;
  custom_message: string | null;
  created_at: string;
  first_name?: string | null;
  username?: string | null;
}

export async function getBroadcasts(): Promise<AdminBroadcast[]> {
  return adminFetch<AdminBroadcast[]>('/admin/broadcasts');
}

export async function createBroadcast(message: string, imageUrl?: string, btnText?: string, btnUrl?: string): Promise<{ success: boolean; broadcast_id: number; sent_count: number; failed_count: number }> {
  return adminFetch('/admin/broadcasts', {
    method: 'POST',
    body: JSON.stringify({ message, imageUrl, btnText, btnUrl }),
  });
}

export async function updateBroadcast(id: number, message: string, imageUrl?: string, btnText?: string, btnUrl?: string): Promise<{ success: boolean; updated_count: number; failed_count: number }> {
  return adminFetch(`/admin/broadcasts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ message, imageUrl, btnText, btnUrl }),
  });
}

export async function deleteBroadcast(id: number): Promise<{ success: boolean; deleted_count: number; failed_count: number }> {
  return adminFetch(`/admin/broadcasts/${id}`, {
    method: 'DELETE',
  });
}

export async function getBroadcastMessages(broadcastId: number): Promise<BroadcastMessageDetail[]> {
  return adminFetch<BroadcastMessageDetail[]>(`/admin/broadcasts/${broadcastId}/messages`);
}

export async function updateSingleBroadcastMessage(msgId: number, message: string, imageUrl?: string): Promise<{ success: boolean }> {
  return adminFetch(`/admin/broadcasts/messages/${msgId}`, {
    method: 'PUT',
    body: JSON.stringify({ message, imageUrl }),
  });
}

export async function deleteSingleBroadcastMessage(msgId: number): Promise<{ success: boolean }> {
  return adminFetch(`/admin/broadcasts/messages/${msgId}`, {
    method: 'DELETE',
  });
}



