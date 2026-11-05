const numberFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** 57060 → «57 060» (неразрывный пробел между разрядами) */
export function formatNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return numberFormat.format(Number.isFinite(n) ? Math.round(n) : 0);
}

/** 57060 → «57 060 ₸» */
export function formatTenge(value: number | string | null | undefined): string {
  return `${formatNumber(value)} ₸`;
}
