import axios from 'axios';
export function apiError(error: unknown, fallback = 'Не удалось загрузить данные. Попробуйте ещё раз.') {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.';
    const message: unknown = error.response.data?.message;
    const text = Array.isArray(message) ? message.join('. ') : message;
    if (typeof text === 'string' && /[а-яё]/i.test(text)) return text;
    if (error.response.status === 401) return 'Войдите в аккаунт, чтобы продолжить.';
    if (error.response.status === 429) return 'Слишком много попыток. Подождите немного.';
  }
  return fallback;
}
