"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { readApiUserError } from "@/lib/api-error-message";
import { statsService } from "@/services/stats.service";
import { useCrmVenue } from "@/lib/venue-context";

const CIRCLE_LENGTH = 2 * Math.PI * 40;

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#3B82F6",
  card: "#A855F7",
  kaspi_qr: "#F59E0B",
  other: "#64748B",
};

const PAYMENT_ORDER = ["cash", "card", "kaspi_qr", "other"] as const;

function formatMoney(n: number) {
  return n.toLocaleString("ru-KZ", { maximumFractionDigits: 0 }) + " ₸";
}

type Period = "today" | "week" | "month" | "custom";

function DonutChart({
  data,
  total,
  size = 160,
}: {
  data: { key: string; name: string; amount: number; color: string }[];
  total: number;
  size?: number;
}) {
  let offset = 0;
  const segments = data.map((d) => {
    const pct = total ? (d.amount / total) * 100 : 0;
    const segment = { ...d, pct, offset };
    offset += pct;
    return segment;
  });

  return (
    <div className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
        {total === 0 ? (
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#334155"
            strokeWidth="16"
            opacity={0.5}
          />
        ) : (
          segments.map((seg, i) => {
            const dash = (seg.pct / 100) * CIRCLE_LENGTH;
            const gap = CIRCLE_LENGTH - dash;
            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={seg.color}
                strokeWidth="16"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-((seg.offset / 100) * CIRCLE_LENGTH)}
                transform="rotate(-90 50 50)"
              />
            );
          })
        )}
        <circle cx="50" cy="50" r="28" fill="var(--tw-gradient-to)" className="fill-[#141E2A]" />
      </svg>
    </div>
  );
}

type RevenueItem = { key: string; name: string; amount: number; color: string };
type OverviewData = {
  totalPlayers: number;
  newPlayers: number;
  totalSessions: number;
  totalSessionMinutes: number;
  bonusMinutesGiven: number;
  bonusSessionsGiven: number;
  popularRooms: { name: string; sessions: number }[];
};

function normalizeRevenueItems(
  raw: { key?: string; name: string; amount: number }[],
): RevenueItem[] {
  const byKey = new Map<string, { name: string; amount: number }>();
  for (const row of raw) {
    const key = row.key ?? row.name;
    const prev = byKey.get(key);
    if (prev) prev.amount += row.amount;
    else byKey.set(key, { name: row.name, amount: row.amount });
  }
  const ordered: RevenueItem[] = [];
  for (const k of PAYMENT_ORDER) {
    const v = byKey.get(k);
    if (v && v.amount > 0) {
      ordered.push({
        key: k,
        name: v.name,
        amount: v.amount,
        color: PAYMENT_COLORS[k] ?? PAYMENT_COLORS.other,
      });
    }
  }
  for (const [key, v] of byKey) {
    if (PAYMENT_ORDER.includes(key as (typeof PAYMENT_ORDER)[number])) continue;
    if (v.amount > 0) {
      ordered.push({
        key,
        name: v.name,
        amount: v.amount,
        color: PAYMENT_COLORS.other,
      });
    }
  }
  return ordered;
}

export default function StatsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [period, setPeriod] = useState<Period>("today");
  const [customOpen, setCustomOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);

  const [revenue, setRevenue] = useState<{ items: RevenueItem[]; total: number }>({ items: [], total: 0 });
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQueryParams = useCallback(() => {
    if (period === "custom" && appliedCustom?.from && appliedCustom?.to) {
      return { from: appliedCustom.from, to: appliedCustom.to };
    }
    const periodParam = period === "today" ? "today" : period === "week" ? "week" : "month";
    return { period: periodParam };
  }, [period, appliedCustom]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = {
      ...buildQueryParams(),
      ...(selectedVenueId ? { venueId: selectedVenueId } : {}),
    };
    Promise.all([statsService.getRevenue(params), statsService.getOverview(params)])
      .then(([revRes, ovRes]) => {
        const rev = revRes as { items: { key?: string; name: string; amount: number }[]; total: number };
        const items = normalizeRevenueItems(rev?.items ?? []);
        setRevenue({
          items,
          total: rev?.total ?? items.reduce((s, d) => s + d.amount, 0),
        });
        setOverview(ovRes as OverviewData);
      })
      .catch((err) => setError(readApiUserError(err, "Ошибка загрузки данных")))
      .finally(() => setLoading(false));
  }, [period, appliedCustom, buildQueryParams, selectedVenueId]);

  const revenueData = revenue.items;
  const totalRevenue = revenue.total;
  const popularRooms = overview?.popularRooms ?? [];
  const maxSessions = popularRooms.length ? Math.max(...popularRooms.map((r) => r.sessions)) : 0;

  if (loading && !revenueData.length && !overview) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-text-secondary">Загрузка...</p>
      </div>
    );
  }

  if (error && !revenueData.length && !overview) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Статистика</h1>
          <p className="mt-1 text-text-secondary">За период</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p);
                setAppliedCustom(null);
                setCustomOpen(false);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === p
                  ? "bg-white text-[#0f172a] shadow-sm"
                  : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              {p === "today" ? "Сегодня" : p === "week" ? "За неделю" : "За месяц"}
            </button>
          ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === "custom"
                  ? "bg-white text-[#0f172a] shadow-sm ring-1 ring-white/20"
                  : "bg-bg-card text-text-secondary hover:text-text-primary"
              }`}
            >
              Указать период
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            {customOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[220px] rounded-lg bg-bg-secondary px-3 py-2 shadow-lg">
                <p className="mb-2 text-xs text-text-secondary">Выберите даты</p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mb-2 h-9 w-full rounded border border-surface-border bg-bg-card px-2 text-sm text-text-primary"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mb-2 h-9 w-full rounded border border-surface-border bg-bg-card px-2 text-sm text-text-primary"
                />
                <button
                  type="button"
                  disabled={!dateFrom || !dateTo}
                  onClick={() => {
                    if (!dateFrom || !dateTo) return;
                    setPeriod("custom");
                    setAppliedCustom({ from: dateFrom, to: dateTo });
                    setCustomOpen(false);
                  }}
                  className="h-9 w-full rounded-lg bg-cyan/90 text-sm font-medium text-[#0f172a] disabled:opacity-40"
                >
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl bg-bg-secondary p-6">
            <div className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
              <DonutChart data={revenueData} total={totalRevenue} size={168} />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                <p className="text-3xl font-bold tabular-nums text-text-primary sm:text-4xl">
                  {formatMoney(totalRevenue)}
                </p>
                <p className="text-sm text-text-secondary">Выручка за период</p>
              </div>
            </div>

            <h2 className="mb-3 mt-8 text-sm font-semibold text-text-primary">Методы оплат клиентов</h2>
            <ul className="divide-y divide-surface-border border-t border-surface-border">
              {revenueData.length === 0 ? (
                <li className="py-4 text-sm text-text-secondary">Нет пополнений за выбранный период</li>
              ) : (
                revenueData.map((d) => (
                  <li key={d.key} className="flex items-center gap-3 py-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-text-secondary">{d.name}</span>
                    <span className="ml-auto font-medium tabular-nums text-text-primary">{formatMoney(d.amount)}</span>
                  </li>
                ))
              )}
            </ul>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-bg-card p-4">
                <p className="flex items-center gap-2 text-xs text-text-secondary">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-secondary">
                    <StarInCircleIcon className="h-4 w-4 text-cyan" />
                  </span>
                  Выданные бонусные минуты
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
                  {Math.round(overview?.bonusMinutesGiven ?? 0)} мин
                </p>
              </div>
              <div className="rounded-lg bg-bg-card p-4">
                <p className="text-xs text-text-secondary">Выданные бонусные сессии</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">
                  {overview?.bonusSessionsGiven ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-bg-secondary p-4">
              <p className="flex items-center gap-1 text-xs text-text-secondary">
                <PersonIcon className="h-3.5 w-3.5 shrink-0" />
                Общее количество игроков
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{overview?.totalPlayers ?? 0}</p>
            </div>
            <div className="rounded-xl bg-bg-secondary p-4">
              <p className="text-xs text-text-secondary">Количество новых игроков</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-success">+{overview?.newPlayers ?? 0}</p>
            </div>
            <div className="rounded-xl bg-bg-secondary p-4">
              <p className="flex items-start justify-between gap-2 text-xs text-text-secondary">
                <span className="flex min-w-0 items-center gap-1">
                  <SessionsIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="leading-tight">Количество сессий</span>
                </span>
                <Link
                  href="/results"
                  className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-cyan hover:underline"
                >
                  История
                  <HistoryIcon className="h-3 w-3" />
                </Link>
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">{overview?.totalSessions ?? 0}</p>
            </div>
            <div className="rounded-xl bg-bg-secondary p-4">
              <p className="text-xs text-text-secondary">Суммарное время сессий</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                {Math.round(overview?.totalSessionMinutes ?? 0).toLocaleString("ru-RU")} мин
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-bg-secondary p-6">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="text-lg font-semibold text-text-primary">Игровые залы по популярности</h2>
              <span className="hidden text-xs text-text-secondary sm:inline">Количество сессий</span>
            </div>
            <div className="space-y-4">
              {popularRooms.length === 0 ? (
                <p className="text-sm text-text-secondary">Нет сессий за период</p>
              ) : (
                popularRooms.map((room) => (
                  <div key={room.name} className="flex items-center gap-3 sm:gap-4">
                    <span className="w-28 shrink-0 text-sm text-text-primary sm:w-36">{room.name}</span>
                    <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-bg-card">
                      <div
                        className="h-full rounded-full bg-success transition-all"
                        style={{ width: `${maxSessions ? (room.sessions / maxSessions) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums text-text-primary">
                      {room.sessions}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SessionsIcon({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
      <path d="M6.5 7.5 10 11M17.5 7.5 14 11M10 13l2 2M12 15l2-2" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function StarInCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 17.8 5.7 21l2.3-7-6-4.6h7.6L12 2z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}
