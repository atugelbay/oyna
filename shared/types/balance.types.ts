export type TransactionType = 'PURCHASE' | 'BONUS' | 'PROMO' | 'GAME_DEBIT' | 'CORRECTION';
export type TransactionSource = 'CASHIER' | 'ONLINE' | 'ADMIN';

export interface Balance {
  availableSeconds: number;
  displayMinutes: number;
  displaySeconds: number;
  display: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  source: TransactionSource;
  amountTenge: number;
  equivalentSeconds: number;
  description: string | null;
  venue: { id: string; name: string; city: string } | null;
  createdAt: string;
}

export interface PaginatedTransactions {
  data: Transaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
