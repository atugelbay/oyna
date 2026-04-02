import axios from "axios";
import { getApiErrorMessage } from "./api-error-message";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const attachFriendly = () => {
      if (axios.isAxiosError(error)) {
        Object.defineProperty(error, "friendlyMessage", {
          value: getApiErrorMessage(error),
          enumerable: false,
          configurable: true,
        });
      }
    };

    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      const isLoginRequest =
        typeof original.url === "string" &&
        (original.url.includes("/auth/crm-login") ||
          original.url.includes("/auth/login"));
      if (isLoginRequest) {
        attachFriendly();
        return Promise.reject(error);
      }

      original._retry = true;

      const refreshToken =
        typeof window !== "undefined"
          ? localStorage.getItem("refreshToken")
          : null;

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          window.location.href = "/login";
        }
      } else {
        window.location.href = "/login";
      }
    }

    attachFriendly();
    return Promise.reject(error);
  },
);

export default api;
