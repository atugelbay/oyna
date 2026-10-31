import api from '@/lib/api';

export const leaderboardService = {
  getLeaderboard: (params?: {
    limit?: number;
    period?: string;
    room?: string;
    date?: string;
    month?: string;
    year?: string;
  }) => api.get('/leaderboard', { params }).then((r) => r.data),
};
