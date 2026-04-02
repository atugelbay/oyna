export type Segment = "GOLD" | "SILVER" | "BRONZE";
export type VisitStatus = "Постоянный" | "Нечастый" | "Неактивный";

export interface Player {
  id: string;
  nickname: string;
  phone: string;
  birthDate: string;
  age?: string;
  status: VisitStatus;
  sessionsCount: number;
  balanceMinutes: number;
  segment: Segment;
}
