import api from "@/lib/api";

export const venuesService = {
  async list() {
    const { data } = await api.get("/venues");
    return data;
  },

  async getById(id: string) {
    const { data } = await api.get(`/venues/${id}`);
    return data;
  },
};
