import api from "@/lib/api";

export const resultsService = {
  async getLeaderboard(params?: {
    venueId?: string;
    roomId?: string;
    period?: string;
    page?: number;
    limit?: number;
  }) {
    const { data } = await api.get("/scores/leaderboard", { params });
    return data;
  },

  async getTopByRoom(roomId: string, limit?: number) {
    const { data } = await api.get(`/scores/top/${roomId}`, {
      params: { limit },
    });
    return data;
  },
};
