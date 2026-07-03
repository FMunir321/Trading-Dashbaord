'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardSummaryComponent from '@/app/components/DashboardSummary';
import AccountList from '@/app/components/AccountList';
import AccountSelector from '@/app/components/AccountSelector';
import AddAccountModal from '@/app/components/AddAccountModal';
import EquityChart from '@/app/components/EquityChart';
import TradesTable from '@/app/components/TradesTable';
import { useUser } from '@/app/context/UserContext';
import { useDashboard, useAccounts } from '@/app/hooks/useDashboard';
import { useWebSocket } from '@/app/hooks/useWebSocket';

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, logout } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const {
    accounts,
    selectedAccountId,
    setSelectedAccountId,
    trades,
    totalTrades,
    currentPage,
    setCurrentPage,
    summary,
    addAccount,
    removeAccount,
    isLoading,
    accountsLoading,
    error,
  } = useDashboard();
  const orderedAccounts = useAccounts(accounts);
  const { status, message } = useWebSocket();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && !user) {
      router.replace('/login');
    }
  }, [isMounted, user, router]);

  // During hydration, show loading state
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Sign in required</h1>
          <p className="mt-3 text-slate-600">You must sign in before viewing your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Trading dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Welcome back, {user.name}</h1>
              <p className="mt-2 text-sm text-slate-600">Live account performance and trade history in one place.</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-3xl bg-slate-50 px-4 py-3 text-slate-700">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Live feed</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{status}</p>
                <p className="text-sm text-slate-500">{message}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Account Selection Section */}
        {accounts.length > 0 && (
          <section className="space-y-4">
            {accounts.length > 1 && (
              <AccountSelector
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={setSelectedAccountId}
                isLoading={accountsLoading}
              />
            )}
            {accounts.length === 1 && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium">Account: {accounts[0].login}</p>
              </div>
            )}
          </section>
        )}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <DashboardSummaryComponent metrics={summary} />
            <EquityChart accountId={selectedAccountId ?? ''} token={token} />
          </div>
          <div className="space-y-4">
            {/* Always show Add Account button */}
            <AddAccountModal onAdd={addAccount} isLoading={accountsLoading} />
            
            {/* Show account list for selection if there are accounts */}
            {accounts.length > 0 && (
              <AccountList 
                accounts={orderedAccounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={setSelectedAccountId}
                onDeleteAccount={removeAccount}
              />
            )}

            {/* Show message if no accounts */}
            {accounts.length === 0 && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">No Accounts</h2>
                <p className="mt-3 text-sm text-slate-600">Add your first MT4/MT5 account to get started tracking your trading performance.</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <TradesTable
            trades={trades}
            total={totalTrades}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
          {error && (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          )}
          {isLoading && !selectedAccountId && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              Loading dashboard data...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

