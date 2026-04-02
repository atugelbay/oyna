import api from "@/lib/api";

export const tournamentsService = {
  async list(params?: { venueId?: string; status?: string }) {
    const { data } = await api.get("/tournaments", { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/tournaments/${id}`);
    return data;
  },

  async create(payload: {
    name: string;
    description?: string;
    venueId: string;
    dateStart: string;
    dateEnd: string;
    maxTeams?: number;
  }) {
    const { data } = await api.post("/tournaments", payload);
    return data;
  },

  async update(
    id: string,
    payload: {
      name?: string;
      description?: string;
      dateStart?: string;
      dateEnd?: string;
      maxTeams?: number;
      status?: string;
    },
  ) {
    const { data } = await api.patch(`/tournaments/${id}`, payload);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/tournaments/${id}`);
    return data;
  },
};
