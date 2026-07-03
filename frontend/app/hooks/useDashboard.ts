'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchDashboardData, fetchAccountTrades, fetchAccounts, addAccount as addAccountApi, deleteAccount as deleteAccountApi, type Account as ApiAccount, type Trade } from '@/app/lib/api';
import { useUser } from '@/app/context/UserContext';

export interface Account extends ApiAccount {}

export interface DashboardSummaryMetrics {
  totalBalance: number;
  totalPnL: number;
  totalAccounts: number;
  openTrades: number;
}

const LAST_ACCOUNT_KEY = 'trading-last-account';

export function useDashboard() {
  const { token, user, logout } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const isAuthError = (value: unknown) => {
    const message = value instanceof Error ? value.message.toLowerCase() : '';
    return (
      message.includes('token expired') ||
      message.includes('invalid token') ||
      message.includes('authorization token required')
    );
  };

  // Load accounts from backend
  const loadAccounts = async () => {
    if (!token || !user) return;

    try {
      setAccountsLoading(true);
      const dashboardData = await fetchDashboardData(token);
      setAccounts(dashboardData.accounts);

      if (typeof window !== 'undefined') {
        const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY);

        if (lastAccountId && dashboardData.accounts.some(a => a.id === lastAccountId || a.account_id === lastAccountId)) {
          setSelectedAccountId(lastAccountId);
        } else if (dashboardData.accounts.length > 0) {
          const firstAccountId = dashboardData.accounts[0].id || dashboardData.accounts[0].account_id;
          setSelectedAccountId(firstAccountId || null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      if (isAuthError(err)) {
        logout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setAccountsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    let active = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load dashboard summary
        const dashboardData = await fetchDashboardData(token);
        
        if (!active) return;
        
        setAccounts(dashboardData.accounts);
        
        // Restore or select first account
        if (typeof window !== 'undefined') {
          const lastAccountId = localStorage.getItem(LAST_ACCOUNT_KEY);
          
          if (lastAccountId && dashboardData.accounts.some(a => a.id === lastAccountId || a.account_id === lastAccountId)) {
            setSelectedAccountId(lastAccountId);
          } else if (dashboardData.accounts.length > 0) {
            const firstAccountId = dashboardData.accounts[0].id || dashboardData.accounts[0].account_id;
            setSelectedAccountId(firstAccountId || null);
          }
        }
      } catch (err) {
        if (!active) return;
        if (isAuthError(err)) {
          logout();
          return;
        }
        const errorMessage = err instanceof Error ? err.message : 'Unable to load dashboard data.';
        setError(errorMessage);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      active = false;
    };
  }, [token, user]);

  // Load trades when selected account changes
  useEffect(() => {
    if (!token || !selectedAccountId) {
      setTrades([]);
      return;
    }

    let active = true;

    const loadTrades = async () => {
      try {
        setCurrentPage(1);
        const tradesData = await fetchAccountTrades(selectedAccountId, token, 50, 0);
        
        if (active) {
          setTrades(tradesData.trades);
          
          // Persist selected account
          if (typeof window !== 'undefined') {
            localStorage.setItem(LAST_ACCOUNT_KEY, selectedAccountId);
          }
        }
      } catch (tradeErr) {
        console.warn('Could not fetch trades:', tradeErr);
        if (isAuthError(tradeErr)) {
          logout();
          return;
        }
        if (active) {
          setTrades([]);
        }
      }
    };

    loadTrades();

    return () => {
      active = false;
    };
  }, [token, selectedAccountId]);

  const summary = useMemo<DashboardSummaryMetrics>(() => {
    if (selectedAccountId && accounts.length > 0) {
      const selectedAccount = accounts.find(
        a => a.id === selectedAccountId || a.account_id === selectedAccountId
      );

      if (selectedAccount) {
        const balance = selectedAccount.balance || selectedAccount.total_profit || 0;
        const pnl = selectedAccount.total_profit || 0;

        return {
          totalBalance: balance,
          totalPnL: pnl,
          totalAccounts: accounts.length,
          openTrades: trades.length,
        };
      }
    }

    // Fallback: aggregate all accounts
    const totalBalance = accounts.reduce((sum, account) => {
      const balance = account.balance || account.total_profit || 0;
      return sum + balance;
    }, 0);
    
    const totalPnL = accounts.reduce((sum, account) => {
      if (account.total_profit) {
        return sum + account.total_profit;
      }
      if (account.daily_pnl) {
        return sum + Object.values(account.daily_pnl).reduce((acc, value) => acc + value, 0);
      }
      return sum;
    }, 0);

    return {
      totalBalance,
      totalPnL,
      totalAccounts: accounts.length,
      openTrades: trades.length,
    };
  }, [accounts, selectedAccountId, trades]);

  const pagedTrades = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return trades.slice(start, start + limit);
  }, [trades, currentPage]);

  const addAccount = async (accountData: {
    login: number;
    password: string;
    server: string;
    broker_name?: string;
    investor_mode?: boolean;
  }) => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await addAccountApi(accountData, token);
      await loadAccounts();
      return true;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
        return false;
      }
      const errorMsg = err instanceof Error ? err.message : 'Failed to add account';
      setError(errorMsg);
      return false;
    }
  };

  const removeAccount = async (accountId: string) => {
    if (!token) {
      setError('Not authenticated');
      return false;
    }

    try {
      await deleteAccountApi(accountId, token);

      setAccounts((prevAccounts) => {
        const updatedAccounts = prevAccounts.filter(
          (account) => (account.id || account.account_id) !== accountId
        );

        if (selectedAccountId === accountId) {
          const nextAccount = updatedAccounts[0];
          const nextAccountId = nextAccount ? nextAccount.id || nextAccount.account_id || null : null;
          setSelectedAccountId(nextAccountId);

          if (typeof window !== 'undefined') {
            if (nextAccountId) {
              localStorage.setItem(LAST_ACCOUNT_KEY, nextAccountId);
            } else {
              localStorage.removeItem(LAST_ACCOUNT_KEY);
            }
          }

          if (!nextAccountId) {
            setTrades([]);
          }
        }

        return updatedAccounts;
      });

      return true;
    } catch (err) {
      if (isAuthError(err)) {
        logout();
        return false;
      }
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete account';
      setError(errorMsg);
      return false;
    }
  };

  return {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    trades: pagedTrades,
    totalTrades: trades.length,
    currentPage,
    setCurrentPage,
    summary,
    addAccount,
    removeAccount,
    isLoading: loading,
    accountsLoading,
    error,
    refetchAccounts: loadAccounts,
  };
}

export function useAccounts(accounts: Account[]) {
  return useMemo(() => {
    return accounts.slice().sort((a, b) => {
      const balanceA = a.balance || a.total_profit || 0;
      const balanceB = b.balance || b.total_profit || 0;
      return balanceB - balanceA;
    });
  }, [accounts]);
}
