import api from "@/lib/api";

export const promosService = {
  async list(params?: { venueId?: string; status?: string }) {
    const { data } = await api.get("/promos", { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/promos/${id}`);
    return data;
  },

  async create(payload: {
    title: string;
    headline?: string;
    description?: string;
    type: string;
    reward?: string;
    quantity?: string;
    dateStart: string;
    dateEnd?: string;
    venueId?: string;
  }) {
    const { data } = await api.post("/promos", payload);
    return data;
  },

  async update(
    id: string,
    payload: {
      title?: string;
      headline?: string;
      description?: string;
      type?: string;
      reward?: string;
      quantity?: string;
      dateStart?: string;
      dateEnd?: string;
      status?: string;
    },
  ) {
    const { data } = await api.patch(`/promos/${id}`, payload);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/promos/${id}`);
    return data;
  },
};
