'use client';

import { useState } from 'react';

interface Trade {
  id: number;
  ticket: number;
  symbol: string;
  profit: number;
  volume: number;
  price: number;
  time: string;
  type: number;
}

interface TradesTableProps {
  trades: Trade[];
  total: number;
  onPageChange?: (page: number) => void;
  currentPage?: number;
  limit?: number;
}

export default function TradesTable({ 
  trades, 
  total, 
  onPageChange, 
  currentPage = 1,
  limit = 50 
}: TradesTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const totalPages = Math.ceil(total / limit);

  const formatTime = (time: string) => {
    return new Date(time).toLocaleString();
  };

  const getTradeType = (type: number) => {
    const types: Record<number, string> = {
      0: 'Buy',
      1: 'Sell',
      2: 'Buy Limit',
      3: 'Sell Limit',
      4: 'Buy Stop',
      5: 'Sell Stop',
    };
    return types[type] || 'Unknown';
  };

  const formatCurrency = (value: number | string) => {
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : '0.00';
  };

  if (trades.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow text-center text-gray-500">
        No trades found
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h2 className="text-xl font-semibold">Trade History</h2>
        <p className="text-sm text-gray-500 mt-1">Total: {total} trades</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Symbol</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Volume</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trades.map((trade) => (
              <tr 
                key={trade.id}
                className={`hover:bg-gray-50 cursor-pointer ${trade.profit > 0 ? 'bg-green-50' : trade.profit < 0 ? 'bg-red-50' : ''}`}
                onClick={() => setExpandedRow(expandedRow === trade.id ? null : trade.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm">{trade.ticket}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{trade.symbol}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <span className={`px-2 py-1 rounded text-xs ${
                    trade.type === 0 ? 'bg-green-100 text-green-800' :
                    trade.type === 1 ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getTradeType(trade.type)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">{trade.volume}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">${formatCurrency(trade.price)}</td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  Number(trade.profit) > 0 ? 'text-green-600' : Number(trade.profit) < 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  ${formatCurrency(trade.profit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTime(trade.time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="px-6 py-4 border-t flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}