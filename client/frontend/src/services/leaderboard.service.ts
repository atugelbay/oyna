import api from '@/lib/api';

export const leaderboardService = {
  getLeaderboard: (limit = 50) =>
    api.get('/leaderboard', { params: { limit } }).then((r) => r.data),
  getMyRank: () => api.get('/leaderboard/my-rank').then((r) => r.data),
};
