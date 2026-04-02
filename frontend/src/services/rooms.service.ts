import api from "@/lib/api";

export const roomsService = {
  async listByVenue(venueId: string) {
    const { data } = await api.get(`/rooms/venue/${venueId}`);
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/rooms/${id}`);
    return data;
  },

  async create(payload: {
    venueId: string;
    name: string;
    type: string;
    maxPlayers?: number;
    defaultLevelDuration?: number;
  }) {
    const { data } = await api.post("/rooms", payload);
    return data;
  },

  async update(
    id: string,
    payload: {
      name?: string;
      type?: string;
      maxPlayers?: number;
      defaultLevelDuration?: number;
    },
  ) {
    const { data } = await api.patch(`/rooms/${id}`, payload);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/rooms/${id}`);
    return data;
  },
};
