'use client';

import { useState } from 'react';

export interface Account {
  id?: string;
  account_id?: string;
  login: number;
  broker_name?: string;
  server?: string;
  total_profit?: number;
  total_trades?: number;
}

interface AccountSelectorProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  isLoading?: boolean;
}

export default function AccountSelector({
  accounts,
  selectedAccountId,
  onSelectAccount,
  isLoading = false,
}: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (accounts.length === 0) {
    return null;
  }

  const selectedAccount = accounts.find(
    a => a.id === selectedAccountId || a.account_id === selectedAccountId
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading || accounts.length === 0}
        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected Account</p>
            <p className="mt-1 font-semibold">
              {selectedAccount ? `MT5 - ${selectedAccount.login}` : 'Select an account'}
            </p>
            {selectedAccount && selectedAccount.broker_name && (
              <p className="text-xs text-slate-500">{selectedAccount.broker_name}</p>
            )}
          </div>
          <svg
            className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute top-full left-0 right-0 z-50 mt-2 rounded-3xl border border-slate-200 bg-white shadow-lg">
            <div className="max-h-80 overflow-y-auto">
              {accounts.map((account) => {
                const accountId = account.id || account.account_id;
                const isSelected = accountId === selectedAccountId;

                return (
                  <button
                    key={accountId}
                    onClick={() => {
                      onSelectAccount(accountId || '');
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left transition ${
                      isSelected
                        ? 'bg-slate-100 border-l-4 border-slate-950'
                        : 'border-l-4 border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <p className="font-medium text-slate-900">MT5 - {account.login}</p>
                    {account.broker_name && (
                      <p className="text-sm text-slate-600">{account.broker_name}</p>
                    )}
                    {account.server && (
                      <p className="text-xs text-slate-500">{account.server}</p>
                    )}
                    <div className="mt-2 flex gap-4 text-sm">
                      {account.total_profit !== undefined && (
                        <span className={account.total_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          P&L: ${account.total_profit?.toFixed(2) || '0.00'}
                        </span>
                      )}
                      {account.total_trades !== undefined && (
                        <span className="text-slate-600">Trades: {account.total_trades}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
