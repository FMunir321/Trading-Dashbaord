'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchCalendarData } from '@/app/lib/api';

interface EquityChartProps {
  accountId: string;
  token: string | null;
}

function formatCurrency(value: number | string | undefined) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '$0.00';
  return `$${numeric.toFixed(2)}`;
}

function getMonthLabel(date: Date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function getInitialMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function EquityChart({ accountId, token }: EquityChartProps) {
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth);
  const [dailyPnl, setDailyPnl] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    const loadCalendar = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchCalendarData(accountId, monthKey, token);
        setDailyPnl(data.daily_pnl);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load calendar data');
        setDailyPnl({});
      } finally {
        setLoading(false);
      }
    };

    if (accountId) {
      loadCalendar();
    }
  }, [accountId, selectedMonth, token]);

  const monthStart = useMemo(
    () => new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1),
    [selectedMonth]
  );

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthLabel = getMonthLabel(monthStart);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = monthStart.getDay();

  const calendarCells = useMemo(() => {
    return Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
      const dayIndex = index - firstWeekday;
      if (dayIndex < 0) return null;

      const date = new Date(year, month, dayIndex + 1);
      const dateKey = date.toISOString().slice(0, 10);
      return {
        date,
        profit: dailyPnl[dateKey] ?? 0,
      };
    });
  }, [daysInMonth, firstWeekday, dailyPnl, month, year]);

  const weeklySummaries = useMemo(() => {
    return Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, weekIndex) => {
      const weekCells = calendarCells
        .slice(weekIndex * 7, weekIndex * 7 + 7)
        .filter(Boolean) as Array<{ date: Date; profit: number }>;
      const profit = weekCells.reduce((sum, cell) => sum + cell.profit, 0);
      const tradingDays = weekCells.filter((cell) => cell.profit !== 0).length;
      return { week: weekIndex + 1, profit, tradingDays };
    });
  }, [calendarCells]);

  const monthCells = useMemo(
    () => calendarCells.filter(Boolean) as Array<{ date: Date; profit: number }>,
    [calendarCells]
  );

  const totalProfit = useMemo(
    () => monthCells.reduce((sum, cell) => sum + cell.profit, 0),
    [monthCells]
  );

  const tradingDays = useMemo(
    () => monthCells.filter((cell) => cell.profit !== 0).length,
    [monthCells]
  );

  const averageProfit = tradingDays > 0 ? totalProfit / tradingDays : 0;

  const goToPreviousMonth = () => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Calendar View</h2>
          <p className="mt-2 text-sm text-slate-600">Monthly trading performance by day.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-2 shadow-sm">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-slate-900">{monthLabel}</span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ›
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Total P/L</p>
              <p className={`mt-2 text-lg font-semibold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totalProfit)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Trading days</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{tradingDays}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Avg profit/day</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(averageProfit)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.8fr_0.9fr]">
        <div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-slate-500">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {loading ? (
              <div className="col-span-7 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Loading calendar data...
              </div>
            ) : error ? (
              <div className="col-span-7 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
                {error}
              </div>
            ) : (
              calendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-28 rounded-3xl bg-slate-50" />;
                }

                const isPositive = cell.profit > 0;
                const isNegative = cell.profit < 0;

                return (
                  <div
                    key={cell.date.toISOString()}
                    className={`min-h-[112px] rounded-3xl border p-3 text-left text-xs shadow-sm ${
                      isPositive ? 'border-emerald-200 bg-emerald-50' : isNegative ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{cell.date.getDate()}</span>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{cell.date.toLocaleDateString(undefined, { month: 'short' })}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{formatCurrency(cell.profit)}</p>
                    {/* <p className="mt-1 text-[11px] text-slate-500">
                      {cell.profit > 0 ? 'Profit' : cell.profit < 0 ? 'Loss' : 'No trades'}
                    </p> */}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Weekly Summary</h3>
            <div className="mt-4 space-y-3">
              {weeklySummaries.map((week) => (
                <div key={week.week} className="rounded-3xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Week {week.week}</p>
                  <p className="mt-2 text-sm text-slate-600">{formatCurrency(week.profit)}</p>
                  <p className="text-xs text-slate-500">Trading days: {week.tradingDays}</p>
                </div>
              ))}
            </div>
          </div>
{/* 
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Month details</h3>
            <div className="mt-4 grid gap-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Average profit/day</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(averageProfit)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-3">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">This month profit</p>
                <p className={`mt-2 text-lg font-semibold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(totalProfit)}
                </p>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
