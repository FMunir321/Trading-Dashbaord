export interface Account {
  id?: string;
  account_id?: string;
  login: number;
  nickname?: string | null;
  balance?: number;
  current_balance?: number;
  status?: string;
  daily_pnl?: Record<string, number>;
  monthly_pnl?: Record<string, number>;
  server?: string;
  broker_name?: string;
  total_profit?: number;
  total_trades?: number;
  winning_trades?: number;
  losing_trades?: number;
  win_rate?: number;
}
