import api from "@/lib/api";

export const balanceService = {
  async getMyBalance() {
    const { data } = await api.get("/balance/me");
    return data;
  },

  async topup(payload: {
    userId: string;
    seconds: number;
    amountTenge: number;
    /** Секунды акций и уровня — для статистики и транзакции BONUS */
    bonusSeconds?: number;
    venueId?: string;
    description?: string;
  }) {
    const { data } = await api.post("/balance/topup", payload);
    return data;
  },

  /** Гостевая оплата без аккаунта — только выручка в статистике */
  async guestSale(payload: {
    amountTenge: number;
    paymentMethod: "cash" | "card" | "kaspi_qr";
    minutes: number;
    venueId: string;
    packageName?: string;
    roomId?: string;
    comment?: string;
  }) {
    const { data } = await api.post("/balance/guest-sale", payload);
    return data;
  },
};
