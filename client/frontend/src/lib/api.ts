import axios from "axios";
import { rememberLobby } from "./pending-lobby";

const BASE_URL = process.env.NEXT_PUBLIC_CLIENT_API_URL ?? "/client-api";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
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

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (v: string) => void;
  reject: (e: any) => void;
}> = [];

function processQueue(error: any, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      !original ||
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.startsWith("/auth/")
    ) {
      return Promise.reject(error);
    }

    original._retry = true;
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(
        `${BASE_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 15000 },
      );
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (err) {
      processQueue(err, null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      if (window.location.pathname.startsWith("/j/")) {
        try {
          rememberLobby(decodeURIComponent(window.location.pathname.slice(3)));
        } catch {
          /* Invalid QR URL. */
        }
      }
      window.dispatchEvent(new Event("oyna:session-expired"));
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;
