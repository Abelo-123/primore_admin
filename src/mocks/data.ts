import type { Service, Order, Deposit, Alert, ChatMessage, UserProfile } from '../types';

// ─── Mock User ────────────────────────────────────────────────
export const MOCK_USER: UserProfile = {
    id: 123456789,
    first_name: 'John',
    display_name: 'John',
    photo_url: '',
    balance: 500.00,
    username: 'john_doe',
};

// ─── Mock Services ────────────────────────────────────────────
export const MOCK_SERVICES: Service[] = [
    { id: 1001, category: 'Instagram Followers', name: 'Instagram Followers [Real] [Max: 100K]', type: 'Default', rate: 2.50, min: 100, max: 100000, averageTime: '0-2 Hours', refill: true, cancel: false },
    { id: 1002, category: 'Instagram Followers', name: 'Instagram Followers [Premium] [Max: 50K]', type: 'Default', rate: 5.00, min: 50, max: 50000, averageTime: '0-4 Hours', refill: true, cancel: true },
    { id: 1003, category: 'Instagram Likes', name: 'Instagram Likes [Instant] [Max: 20K]', type: 'Default', rate: 1.50, min: 10, max: 20000, averageTime: '0-1 Hours', refill: false, cancel: false },
    { id: 1004, category: 'Instagram Views', name: 'Instagram Reel Views [Max: 1M]', type: 'Default', rate: 0.30, min: 100, max: 1000000, averageTime: '0-30 Min', refill: false, cancel: false },
    { id: 1005, category: 'Instagram Comments', name: 'Instagram Custom Comments', type: 'Custom Comments', rate: 8.00, min: 5, max: 500, averageTime: '1-6 Hours', refill: false, cancel: false },
    { id: 2001, category: 'TikTok Followers', name: 'TikTok Followers [Real] [Max: 50K]', type: 'Default', rate: 3.00, min: 100, max: 50000, averageTime: '0-6 Hours', refill: true, cancel: false },
    { id: 2002, category: 'TikTok Views', name: 'TikTok Video Views [Max: 10M]', type: 'Default', rate: 0.10, min: 500, max: 10000000, averageTime: '0-1 Hours', refill: false, cancel: false },
    { id: 2003, category: 'TikTok Likes', name: 'TikTok Likes [Max: 100K]', type: 'Default', rate: 1.20, min: 50, max: 100000, averageTime: '0-2 Hours', refill: false, cancel: false },
    { id: 3001, category: 'YouTube Subscribers', name: 'YouTube Subscribers [Real] [Max: 10K]', type: 'Default', rate: 15.00, min: 50, max: 10000, averageTime: '2-12 Hours', refill: true, cancel: false },
    { id: 3002, category: 'YouTube Views', name: 'YouTube Views [Max: 1M]', type: 'Default', rate: 1.00, min: 500, max: 1000000, averageTime: '0-4 Hours', refill: false, cancel: false },
    { id: 3003, category: 'YouTube Likes', name: 'YouTube Likes [Max: 50K]', type: 'Default', rate: 3.50, min: 50, max: 50000, averageTime: '0-6 Hours', refill: false, cancel: false },
    { id: 4001, category: 'Facebook Page Likes', name: 'Facebook Page Likes [Max: 50K]', type: 'Default', rate: 4.00, min: 100, max: 50000, averageTime: '0-12 Hours', refill: true, cancel: false },
    { id: 4002, category: 'Facebook Post Likes', name: 'Facebook Post Likes [Max: 10K]', type: 'Default', rate: 2.00, min: 50, max: 10000, averageTime: '0-4 Hours', refill: false, cancel: false },
    { id: 5001, category: 'Twitter / X Followers', name: 'Twitter Followers [Real] [Max: 50K]', type: 'Default', rate: 6.00, min: 100, max: 50000, averageTime: '0-12 Hours', refill: true, cancel: false },
    { id: 5002, category: 'Twitter / X Likes', name: 'Twitter Likes [Max: 10K]', type: 'Default', rate: 2.50, min: 50, max: 10000, averageTime: '0-4 Hours', refill: false, cancel: false },
    { id: 6001, category: 'Telegram Members', name: 'Telegram Channel Members [Max: 50K]', type: 'Default', rate: 5.50, min: 100, max: 50000, averageTime: '0-24 Hours', refill: true, cancel: false },
    { id: 6002, category: 'Telegram Post Views', name: 'Telegram Post Views [Max: 100K]', type: 'Default', rate: 0.50, min: 100, max: 100000, averageTime: '0-1 Hours', refill: false, cancel: false },
    { id: 7001, category: 'Spotify Plays', name: 'Spotify Plays [Max: 1M]', type: 'Default', rate: 1.00, min: 1000, max: 1000000, averageTime: '0-24 Hours', refill: false, cancel: false },
    { id: 7002, category: 'SoundCloud Plays', name: 'SoundCloud Plays [Max: 100K]', type: 'Default', rate: 0.80, min: 100, max: 100000, averageTime: '0-12 Hours', refill: false, cancel: false },
    { id: 8001, category: 'Instagram Poll Votes', name: 'Instagram Poll Votes [Max: 5K]', type: 'Poll', rate: 10.00, min: 100, max: 5000, averageTime: '0-6 Hours', refill: false, cancel: false },
];

export const MOCK_RECOMMENDED: number[] = [1001, 2001, 3001, 1003];

// ─── Mock Orders ──────────────────────────────────────────────
export const MOCK_ORDERS: Order[] = [
    { id: 1, api_order_id: 88001, service_id: 1001, service_name: 'Instagram Followers [Real]', link: 'https://instagram.com/example', quantity: 1000, charge: 2.50, status: 'completed', remains: 0, start_count: 500, created_at: '2026-02-10T10:00:00Z' },
    { id: 2, api_order_id: 88002, service_id: 2002, service_name: 'TikTok Video Views', link: 'https://tiktok.com/@example/video/123', quantity: 5000, charge: 0.50, status: 'processing', remains: 3000, start_count: 200, created_at: '2026-02-11T08:00:00Z' },
    { id: 3, api_order_id: 88003, service_id: 3002, service_name: 'YouTube Views', link: 'https://youtube.com/watch?v=abc', quantity: 2000, charge: 2.00, status: 'pending', remains: 2000, start_count: 0, created_at: '2026-02-11T12:00:00Z' },
];

// ─── Mock Deposits ────────────────────────────────────────────
export const MOCK_DEPOSITS: Deposit[] = [
    { id: 1, amount: 200.00, reference_id: 'chapa-ref-001', status: 'completed', created_at: '2026-02-09T14:00:00Z' },
    { id: 2, amount: 300.00, reference_id: 'chapa-ref-002', status: 'completed', created_at: '2026-02-10T09:00:00Z' },
];

// ─── Mock Alerts ──────────────────────────────────────────────
export const MOCK_ALERTS: Alert[] = [
    { id: 1, message: '🎉 Welcome to primora444 SMM! Explore our services and get started.', is_read: false, created_at: '2026-02-11T08:00:00Z' },
    { id: 2, message: '✅ Your order #88001 has been completed!', is_read: true, created_at: '2026-02-10T14:00:00Z' },
];

// ─── Mock Chat ────────────────────────────────────────────────
export const MOCK_CHAT: ChatMessage[] = [
    { id: 1, sender: 'admin', message: 'Hello! Welcome to primora444 support. How can I help you?', created_at: '2026-02-11T08:00:00Z' },
];

// ─── Mock Settings ────────────────────────────────────────────
export const MOCK_SETTINGS = {
    rateMultiplier: 1,    // already applied in mock services
    discountPercent: 10,
    holidayName: 'Launch Sale 🚀',
    maintenanceMode: false,
    marqueeText: '🔥 Get 10% off all services during our Launch Sale! 🔥',
};
