import axios from "axios";

const MSG_403 =
  "Недостаточно прав для этого действия. Обратитесь к администратору.";
const MSG_404 = "Данные не найдены.";
const MSG_401 = "Сессия истекла. Войдите снова.";
const MSG_NETWORK = "Не удалось связаться с сервером. Проверьте подключение.";

function isGenericForbiddenText(msg: string): boolean {
  const m = msg.trim().toLowerCase();
  return (
    m === "forbidden resource" ||
    m === "forbidden" ||
    m.startsWith("forbidden ") ||
    m === "access denied" ||
    m.includes("status code 403")
  );
}

function extractServerMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const msg = (data as { message?: unknown }).message;
  if (typeof msg === "string") return msg.trim();
  if (Array.isArray(msg)) {
    return msg.filter((x): x is string => typeof x === "string").join(" ");
  }
  return "";
}

/**
 * Текст для показа пользователю вместо «Request failed with status code 403» и сырых сообщений из консоли.
 */
export function getApiErrorMessage(error: unknown, fallback = "Произошла ошибка. Попробуйте ещё раз."): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const serverMsg = extractServerMessage(error.response?.data);

    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      return MSG_NETWORK;
    }

    if (status === 403) {
      if (serverMsg && !isGenericForbiddenText(serverMsg)) return serverMsg;
      return MSG_403;
    }

    if (status === 404) {
      return serverMsg || MSG_404;
    }

    if (status === 401) {
      return serverMsg || MSG_401;
    }

    if (serverMsg) return serverMsg;

    if (status && error.message?.includes("status code")) {
      return fallback;
    }

    return error.message && !error.message.includes("status code") ? error.message : fallback;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** После ответа axios на ошибке обычно уже есть `friendlyMessage` из перехватчика. */
export function readApiUserError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "friendlyMessage" in error) {
    const f = (error as { friendlyMessage?: unknown }).friendlyMessage;
    if (typeof f === "string" && f.trim()) return f;
  }
  return getApiErrorMessage(error, fallback);
}
