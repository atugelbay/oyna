import api from "@/lib/api";

export type VenuePayload = {
  name: string;
  city: string;
  address: string;
  timezone?: string;
  status?: "OPEN" | "CLOSED" | "MAINTENANCE";
};

export const venuesService = {
  async list() {
    const { data } = await api.get("/venues");
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/venues/${id}`);
    return data;
  },

  async create(payload: VenuePayload) {
    const { data } = await api.post("/venues", payload);
    return data;
  },

  async update(id: string, payload: Partial<VenuePayload>) {
    const { data } = await api.patch(`/venues/${id}`, payload);
    return data;
  },

  async remove(id: string) {
    const { data } = await api.delete(`/venues/${id}`);
    return data;
  },
};
