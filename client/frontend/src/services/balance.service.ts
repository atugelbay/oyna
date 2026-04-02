import api from '@/lib/api';

export const balanceService = {
  getBalance: () => api.get('/balance').then((r) => r.data),
  getTransactions: (page = 1, limit = 20) =>
    api.get('/balance/transactions', { params: { page, limit } }).then((r) => r.data),
};
