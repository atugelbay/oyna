import api from "@/lib/api";

export const playersService = {
  async list(params?: {
    q?: string;
    page?: number;
    limit?: number;
    filter?: "newToday" | "birthdayToday";
  }) {
    const { data } = await api.get("/users/search", { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  async getStats(venueId?: string) {
    const { data } = await api.get("/users/stats", {
      params: { venueId },
    });
    return data;
  },

  async update(
    id: string,
    payload: {
      nickname?: string;
      name?: string;
      birthDate?: string;
      role?: string;
      isActive?: boolean;
    },
  ) {
    const { data } = await api.patch(`/users/${id}`, payload);
    return data;
  },
};
