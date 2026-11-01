export const PAY_METHOD_LABEL: Record<string, string> = {
  CASH: "Наличные",
  KASPI: "Kaspi",
  HALYK: "Halyk",
  FREEDOM: "Freedom",
};

export const SALE_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Проведена",
  CANCELLED: "Отменена",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  NEW: "Новая",
  CONFIRMED: "Подтверждена",
  ARRIVED: "Гости пришли",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
  NO_SHOW: "Не пришли",
};

export function payMethodLabel(method?: string | null) {
  if (!method) return "—";
  return PAY_METHOD_LABEL[method] ?? method;
}

export function saleStatusLabel(status?: string | null) {
  if (!status) return "—";
  return SALE_STATUS_LABEL[status] ?? status;
}

export function bookingStatusLabel(status?: string | null) {
  if (!status) return "—";
  return BOOKING_STATUS_LABEL[status] ?? status;
}
