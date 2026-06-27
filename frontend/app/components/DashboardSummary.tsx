'use client';

interface DashboardSummaryProps {
  metrics: {
    totalBalance: number;
    totalPnL: number;
    totalAccounts: number;
    openTrades: number;
  };
}

export default function DashboardSummary({ metrics }: DashboardSummaryProps) {
  const cards = [
    {
      label: 'Total Balance',
      value: `$${metrics.totalBalance.toLocaleString()}`,
      description: 'Sum of all account balances.',
    },
    {
      label: 'Total P&L',
      value: `${metrics.totalPnL >= 0 ? '+' : '-'}$${Math.abs(metrics.totalPnL).toLocaleString()}`,
      description: 'Net profit and loss across accounts.',
    },
    {
      label: 'Accounts',
      value: metrics.totalAccounts.toString(),
      description: 'Active trading accounts.',
    },
    {
      label: 'Trades',
      value: metrics.openTrades.toString(),
      description: 'Trades shown in the table below.',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
          <p className="mt-2 text-sm text-slate-500">{card.description}</p>
        </div>
      ))}
    </div>
  );
}
