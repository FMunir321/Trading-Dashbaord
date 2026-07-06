'use client';

import type { Account } from '@/app/types';

interface AccountListProps {
  accounts: Account[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string) => void;
  onDeleteAccount?: (accountId: string) => Promise<boolean>;
}

export default function AccountList({ accounts, selectedAccountId, onSelectAccount, onDeleteAccount }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Accounts</h2>
        <p className="mt-3 text-sm text-slate-600">No accounts linked yet. Add one to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Linked Accounts</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{accounts.length}</span>
      </div>
      <div className="mt-6 space-y-4">
        {accounts.map(account => {
          const accountId = account.id || account.account_id;
          const isSelected = accountId === selectedAccountId;
          const balance = Number(account.balance ?? account.current_balance ?? 0);
          const dailyValues = account.daily_pnl ? Object.values(account.daily_pnl) : [];
          const latestPnl = dailyValues.length ? Number(dailyValues[dailyValues.length - 1]) : 0;

          return (
            <div
              key={accountId}
              className={`w-full rounded-3xl border-2 p-4 transition ${
                isSelected
                  ? 'border-slate-950 bg-slate-50'
                  : 'border-slate-100 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Account Login</p>
                  <p className="text-base font-semibold text-slate-900">{account.login}</p>
                  {account.broker_name && (
                    <p className="text-xs text-slate-600">{account.broker_name}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Account Nickname</p>
                  <p className="text-base font-semibold text-slate-900">{account.nickname?.trim() || 'No Nickname'}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Balance</p>
                  <p className="text-base font-semibold text-slate-900">${balance.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Latest daily P&L</p>
                  <p className={`text-base font-semibold ${latestPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {latestPnl >= 0 ? '+' : ''}${latestPnl.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAccount && onSelectAccount(accountId || '')}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Select
                </button>
                {onDeleteAccount && (
                  <button
                    type="button"
                    onClick={async () => {
                      const confirmed = window.confirm('Delete this account? This cannot be undone.');
                      if (!confirmed || !accountId) return;
                      await onDeleteAccount(accountId);
                    }}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                )}
              </div>
              {isSelected && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-slate-950" />
                  <span className="text-xs font-semibold text-slate-950">Currently Selected</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
