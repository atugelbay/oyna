import api from '@/lib/api';

export const sessionsService = {
  getMySessions: (page = 1, limit = 20) =>
    api.get('/sessions', { params: { page, limit } }).then((r) => r.data),
};
