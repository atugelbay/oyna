export type SessionStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ERROR' | 'CANCELLED';

export interface GameSessionSummary {
  id: string;
  status: SessionStatus;
  startTime: string | null;
  endTime: string | null;
  deductedSeconds: number;
  venue: { id: string; name: string; city: string } | null;
  room: { id: string; name: string; type: string } | null;
  mode: { id: string; name: string; type: string } | null;
  myScore: number | null;
  createdAt: string;
}

export interface PaginatedSessions {
  data: GameSessionSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
