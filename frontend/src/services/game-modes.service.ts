import api from "@/lib/api";

export const gameModesService = {
  async listByRoom(roomId: string) {
    const { data } = await api.get(`/game-modes/room/${roomId}`);
    return data as {
      id: string;
      roomId: string;
      type: string;
      name: string;
      description?: string | null;
    }[];
  },

  async create(payload: {
    roomId: string;
    type: "COOP" | "FFA" | "COMPETITIVE";
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }) {
    const { data } = await api.post("/game-modes", payload);
    return data;
  },
};

