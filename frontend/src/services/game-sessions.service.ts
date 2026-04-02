import api from "@/lib/api";

type ListSessionsResponse = {
  data?: Array<{
    id: string;
    startTime?: string | null;
    pausedAt?: string | null;
    room?: { defaultLevelDuration?: number };
    players?: Array<{ userId: string; user?: { id?: string; nickname?: string } }>;
  }>;
};

export const gameSessionsService = {
  async list(params: { roomId?: string; status?: string; limit?: number; page?: number }) {
    const { data } = await api.get<ListSessionsResponse>("/game-sessions", { params });
    return data;
  },

  async start(payload: { roomId: string; modeId: string; venueId: string; playerIds: string[] }) {
    const { data } = await api.post("/game-sessions/start", payload);
    return data;
  },

  async activateByToken(sessionToken: string) {
    const { data } = await api.post(`/game-sessions/${encodeURIComponent(sessionToken)}/activate`);
    return data;
  },

  async cancelPending(sessionId: string) {
    const { data } = await api.post(`/game-sessions/${encodeURIComponent(sessionId)}/cancel-pending`);
    return data;
  },

  async pauseActive(sessionId: string) {
    const { data } = await api.post(`/game-sessions/${encodeURIComponent(sessionId)}/pause`);
    return data;
  },

  async resumeActive(sessionId: string) {
    const { data } = await api.post(`/game-sessions/${encodeURIComponent(sessionId)}/resume`);
    return data;
  },

  async end(
    sessionId: string,
    body: { durationSeconds: number; results: { userId: string; score: number }[] },
  ) {
    const { data } = await api.post(`/game-sessions/${encodeURIComponent(sessionId)}/end`, body);
    return data;
  },
};
