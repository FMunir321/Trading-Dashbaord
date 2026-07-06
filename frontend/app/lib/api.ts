import type { Account } from '@/app/types';

const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function resolveApiUrl() {
  if (typeof window === 'undefined') {
    return RAW_API_URL;
  }

  try {
    const parsed = new URL(RAW_API_URL);
    const isLocalApiHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const currentHost = window.location.hostname;
    const isBrowserOnLan = currentHost !== 'localhost' && currentHost !== '127.0.0.1';

    if (isLocalApiHost && isBrowserOnLan) {
      parsed.hostname = currentHost;
      return parsed.toString().replace(/\/$/, '');
    }

    return RAW_API_URL;
  } catch {
    return RAW_API_URL;
  }
}

const API_URL = resolveApiUrl();

export interface Trade {
  id: number;
  ticket: number;
  symbol: string;
  type: number;
  volume: number;
  price: number;
  profit: number;
  time: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  userId: string;
  email: string;
}

export interface RegisterResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
}

export interface DashboardResponse {
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  accountCount: number;
  accounts: Account[];
}

// Helper function to get auth headers
export function getAuthHeaders(token?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const authToken = token || (typeof window !== 'undefined' ? localStorage.getItem('trading-token') : null);
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

// API error handler
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }
  return response.json();
}

export async function login(email: string, password: string) {
  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password }),
    });

    const data = await handleApiResponse<LoginResponse>(response);
    
    // Store token in localStorage for authenticated requests
    if (typeof window !== 'undefined') {
      localStorage.setItem('trading-token', data.token);
    }

    return {
      user: {
        id: data.userId,
        email: data.email,
        name: email.split('@')[0] || 'Trader',
      },
      token: data.token,
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Login failed');
  }
}

export async function register(name: string, email: string, password: string) {
  if (!name || !email || !password) {
    throw new Error('Name, email, and password are required.');
  }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, password, name }),
    });

    const data = await handleApiResponse<RegisterResponse>(response);
    
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name,
      },
    };
  } catch (error) {
    throw error instanceof Error ? error : new Error('Registration failed');
  }
}

export async function fetchDashboardData(token?: string | null) {
  try {
    const response = await fetch(`${API_URL}/dashboard/summary`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    const data = await handleApiResponse<DashboardResponse>(response);

    function parseNumericMap(map?: Record<string, number | string>) {
      if (!map) return {};
      return Object.entries(map).reduce((result, [key, value]) => {
        const numericValue = typeof value === 'number' ? value : Number(value);
        result[key] = Number.isFinite(numericValue) ? numericValue : 0;
        return result;
      }, {} as Record<string, number>);
    }

    // Transform the response to match the expected format
    const accounts: Account[] = data.accounts.map((account) => ({
      ...account,
      account_id: account.id || account.account_id,
      login: account.login,
      balance: account.current_balance || 0,
      status: 'Active',
      daily_pnl: parseNumericMap(account.daily_pnl),
      monthly_pnl: parseNumericMap(account.monthly_pnl),
    }));

    const trades: Trade[] = [];

    return { accounts, trades };
  } catch (error) {
    console.error('Dashboard fetch error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch dashboard data');
  }
}

export async function fetchAccountTrades(accountId: string, token?: string | null, limit = 50, offset = 0) {
  try {
    const response = await fetch(`${API_URL}/dashboard/trades/${accountId}?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    const data = await handleApiResponse<{
      trades: Trade[];
      total: number;
      limit: number;
      offset: number;
    }>(response);

    return data;
  } catch (error) {
    console.error('Trades fetch error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch trades');
  }
}

export async function fetchCalendarData(
  accountId: string,
  month: string,
  token?: string | null
) {
  try {
    const response = await fetch(`${API_URL}/dashboard/calendar/${accountId}?month=${encodeURIComponent(month)}`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    const data = await handleApiResponse<{ daily_pnl: Record<string, number>; month: string }>(response);
    return data;
  } catch (error) {
    console.error('Calendar fetch error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch calendar data');
  }
}

export async function fetchAccounts(token?: string | null) {
  try {
    const response = await fetch(`${API_URL}/accounts`, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    const data = await handleApiResponse<Account[]>(response);
    return data;
  } catch (error) {
    console.error('Accounts fetch error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch accounts');
  }
}

export async function addAccount(
  accountData: { login: number; password: string; server: string; broker_name?: string; investor_mode?: boolean; nickname?: string },
  token?: string | null
) {
  try {
    const response = await fetch(`${API_URL}/accounts`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(accountData),
    });

    const data = await handleApiResponse<Account>(response);
    return data;
  } catch (error) {
    console.error('Add account error:', error);
    throw error instanceof Error ? error : new Error('Failed to add account');
  }
}

export async function deleteAccount(accountId: string, token?: string | null) {
  try {
    const response = await fetch(`${API_URL}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });

    const data = await handleApiResponse<{ success: boolean; message: string }>(response);
    return data;
  } catch (error) {
    console.error('Delete account error:', error);
    throw error instanceof Error ? error : new Error('Failed to delete account');
  }
}
