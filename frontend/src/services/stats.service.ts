import api from "@/lib/api";

export const statsService = {
  async getDashboard(venueId?: string) {
    const { data } = await api.get("/stats/dashboard", {
      params: { venueId },
    });
    return data;
  },

  async getRevenue(params?: { venueId?: string; period?: string; from?: string; to?: string }) {
    const { data } = await api.get("/stats/revenue", { params });
    return data;
  },

  async getOverview(params?: { venueId?: string; period?: string; from?: string; to?: string }) {
    const { data } = await api.get("/stats/overview", { params });
    return data;
  },
};
