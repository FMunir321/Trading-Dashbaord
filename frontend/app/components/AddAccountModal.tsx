'use client';

import { useState } from 'react';

interface AddAccountModalProps {
  onAdd: (accountData: {
    login: number;
    password: string;
    server: string;
    broker_name?: string;
    investor_mode?: boolean;
  }) => Promise<boolean>;
  isLoading?: boolean;
}

export default function AddAccountModal({ onAdd, isLoading = false }: AddAccountModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [brokerName, setBrokerName] = useState('');
  const [investorMode, setInvestorMode] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!login.trim() || !password.trim() || !server.trim()) {
      setError('Login, password, and server are required');
      return;
    }

    const loginNum = parseInt(login);
    if (isNaN(loginNum)) {
      setError('Login must be a valid number');
      return;
    }

    try {
      setSubmitting(true);
      const success = await onAdd({
        login: loginNum,
        password: password.trim(),
        server: server.trim(),
        broker_name: brokerName.trim() || undefined,
        investor_mode: investorMode,
      });

      if (success) {
        // Reset form
        setLogin('');
        setPassword('');
        setServer('');
        setBrokerName('');
        setInvestorMode(false);
        setError('');
        setIsOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Add MT4/MT5 Account</h2>
          <p className="mt-2 text-sm text-slate-600">Link your trading account to track performance.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isLoading}
          className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add Account
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Account Login *</label>
              <input
                type="number"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="e.g., 123456789"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Account password"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-slate-500">Password will be encrypted and stored securely</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Server *</label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g., ICMarketsSC-MT5"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
                disabled={submitting}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Broker Name (Optional)</label>
              <input
                type="text"
                value={brokerName}
                onChange={(e) => setBrokerName(e.target.value)}
                placeholder="e.g., IC Markets"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                disabled={submitting}
              />
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={investorMode}
                onChange={(e) => setInvestorMode(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
                disabled={submitting}
              />
              <span className="text-sm font-medium text-slate-700">Read-only account (investor password)</span>
            </label>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              <button
                type="submit"
                disabled={submitting || isLoading}
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Adding...' : 'Add Account'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError('');
                  setLogin('');
                  setPassword('');
                  setServer('');
                  setBrokerName('');
                }}
                disabled={submitting}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
