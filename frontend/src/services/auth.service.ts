import api from "@/lib/api";

export const authService = {
  async crmLogin(phone: string, password: string) {
    const { data } = await api.post("/auth/crm-login", { phone, password });
    return data;
  },

  async crmEmployeeLogin(phone: string, code: string) {
    const { data } = await api.post("/auth/crm-login", {
      phone,
      code,
      isEmployee: true,
    });
    return data;
  },

  async requestOtp(phone: string) {
    const { data } = await api.post("/auth/request-otp", { phone });
    return data;
  },

  async verifyOtp(phone: string, code: string) {
    const { data } = await api.post("/auth/login", { phone, code });
    return data;
  },

  async register(payload: {
    phone: string;
    nickname: string;
    name: string;
    birthDate?: string;
  }) {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },

  async refresh(refreshToken: string) {
    const { data } = await api.post("/auth/refresh", { refreshToken });
    return data;
  },
};
