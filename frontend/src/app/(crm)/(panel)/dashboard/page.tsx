"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Phone } from "lucide-react";
import api from "@/lib/api";
import { statsService } from "@/services/stats.service";
import { AddPlayerModal } from "@/components/crm/AddPlayerModal";
import { readApiUserError } from "@/lib/api-error-message";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { bookingStatusLabel } from "@/lib/crm-labels";
import { formatTenge } from "@/lib/money";

const CHART_COLORS = ["#36D399", "#7AA2FF", "#A78BFA", "#F59E0B", "#FB7185"];
const panel = "rounded-2xl bg-[#19232E] p-4 sm:p-5";
const row = "rounded-xl bg-[#141C26] px-4 py-3";

type TodayBooking = {
  id: string;
  startsAt: string;
  type: "BIRTHDAY" | "TEAMBUILDING";
  packageName: string;
  people: number;
  contactName: string;
  contactPhone: string;
  amountTenge: number;
  paidTenge: number;
  remainingTenge: number;
  due: { kind: "PREPAY" | "REST" | "PAID"; label: string; amount: number };
  status: string;
  soon: boolean;
};

type TodayRoom = {
  roomId: string;
  name: string;
  status: "FREE" | "BUSY" | "OFFLINE";
  remainingSeconds: number | null;
  paused: boolean;
  players: number;
  playerNicknames: string[];
};

type Today = {
  shift: { id: string; number: number; openedAt: string; operatorName: string } | null;
  bookings: TodayBooking[];
  tomorrowBookings: number;
  rooms: TodayRoom[];
  important: {
    birthdays: { userId: string; nickname: string; age: number }[];
    expiringMinutes: { userId: string; nickname: string; phone: string; minutes: number; expiresAt: string }[];
    offlineRooms: { roomId: string; name: string; minutes: number }[];
    lowStock: { id: string; name: string; stockQty: number; lowStockAt: number }[];
    tournament: { daysLeft: number; leader: { nickname: string; points: number } | null };
  };
  numbers: { scope: "DAY" | "MY_SHIFT"; sales: number; revenue: number };
};

type Stats = {
  sessionsByRoom: { name: string; count: number; roomId: string }[];
  totalSessions: number;
  totalPlayers: number;
  newPlayers: number;
};

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" });
}

function mmss(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const { selectedVenueId } = useCrmVenue();
  const [today, setToday] = useState<Today | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [sellTo, setSellTo] = useState<string | null>(null);
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [tomorrowOpen, setTomorrowOpen] = useState(false);
  const [tomorrow, setTomorrow] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    if (!selectedVenueId) return;
    try {
      const [{ data }, s] = await Promise.all([
        api.get("/dashboard/today", { params: { venueId: selectedVenueId } }),
        statsService.getDashboard(selectedVenueId).catch(() => null),
      ]);
      setToday(data);
      if (s) setStats(s);
      setError(null);
    } catch (e) {
      setError(readApiUserError(e, "Не удалось загрузить главную"));
    }
  }, [selectedVenueId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => window.clearInterval(id);
  }, [load]);

  // Таймеры комнат тикают каждую секунду между обновлениями
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => setTick(0), [today]);

  async function guestsArrived(bookingId: string) {
    setBusyId(bookingId);
    try {
      await api.post(`/bookings/${bookingId}/status`, { status: "ARRIVED" });
      await load();
    } catch (e) {
      setError(readApiUserError(e, "Статус не обновлён"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTomorrow() {
    const next = !tomorrowOpen;
    setTomorrowOpen(next);
    if (next && tomorrow == null && selectedVenueId) {
      const now = new Date();
      const almaty = new Date(now.getTime() + 5 * 3600000);
      const y = almaty.getUTCFullYear();
      const m = almaty.getUTCMonth();
      const d = almaty.getUTCDate();
      const from = new Date(Date.UTC(y, m, d + 1) - 5 * 3600000).toISOString();
      const to = new Date(Date.UTC(y, m, d + 2) - 5 * 3600000 - 1).toISOString();
      api
        .get("/bookings", { params: { venueId: selectedVenueId, from, to } })
        .then(({ data }) =>
          setTomorrow(
            (Array.isArray(data) ? data : []).filter((b: any) => b.status !== "CANCELLED" && b.status !== "NO_SHOW"),
          ),
        )
        .catch(() => setTomorrow([]));
    }
  }

  if (!selectedVenueId) {
    return <p className="text-text-secondary">Выберите игровую точку</p>;
  }
  if (!today) {
    return error ? (
      <div className={panel}>
        <p className="text-danger">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-sm text-cyan hover:underline">
          Повторить
        </button>
      </div>
    ) : (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 rounded-xl bg-bg-card" />
        <div className="h-16 rounded-xl bg-bg-card" />
        <div className="h-48 rounded-xl bg-bg-card" />
      </div>
    );
  }

  const { shift, bookings, important, numbers } = today;
  const sessionsByRoom = (stats?.sessionsByRoom ?? []).map((r, i) => ({ ...r, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const totalChart = sessionsByRoom.reduce((s, r) => s + r.count, 0);
  const freeRooms = today.rooms.filter((r) => r.status === "FREE");
  const hasImportant =
    important.birthdays.length > 0 ||
    important.expiringMinutes.length > 0 ||
    important.offlineRooms.length > 0 ||
    important.lowStock.length > 0 ||
    important.tournament.leader != null;

  return (
    <div className="space-y-4 text-text-primary">
      {/* Состояние смены */}
      {shift ? (
        <div className="rounded-xl bg-white/5 px-4 py-3 text-sm text-text-secondary">
          Смена №{shift.number} открыта · {shift.operatorName} · с {time(shift.openedAt)}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-500/15 px-4 py-3">
          <span className="font-semibold text-red-300">Смена не открыта — продажи невозможны</span>
          <Link href="/cash" className="min-h-11 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white">
            Открыть смену
          </Link>
        </div>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {/* Быстрые кнопки */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <QuickButton label="Продажа" href="/cash" primary />
        <QuickButton label="Новый игрок" onClick={() => setAddPlayerOpen(true)} />
        <QuickButton label="Запустить комнату" onClick={() => setRoomPickerOpen(true)} />
        <QuickButton label="Новая бронь" href="/bookings?new=1" />
        <QuickButton label="Компенсация" href="/sessions-log?filter=interrupted" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          {/* Брони сегодня */}
          <section className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Брони сегодня</h2>
              <Link href="/bookings" className="text-xs text-cyan">
                Все брони
              </Link>
            </div>
            {bookings.length === 0 ? (
              <p className="text-sm text-text-secondary">Сегодня броней нет</p>
            ) : (
              <div className="space-y-2">
                {bookings.map((b) => (
                  <article
                    key={b.id}
                    className={`${row} ${b.soon && b.status !== "ARRIVED" ? "ring-2 ring-amber-400" : ""}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold">
                        <span className="tabular-nums">{time(b.startsAt)}</span> · {b.packageName} · {b.people}{" "}
                        {plural(b.people, "гость", "гостя", "гостей")}
                      </p>
                      <span className="text-xs text-text-secondary">{bookingStatusLabel(b.status)}</span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {b.contactName} · {b.contactPhone}
                    </p>
                    <p className="text-sm">
                      Предоплата {formatTenge(b.paidTenge)} · остаток{" "}
                      <b className={b.remainingTenge > 0 ? "text-amber-300" : "text-success"}>{formatTenge(b.remainingTenge)}</b>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {b.status !== "ARRIVED" && b.status !== "COMPLETED" ? (
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => void guestsArrived(b.id)}
                          className="min-h-10 rounded-lg bg-cyan px-3 text-sm font-medium text-black disabled:opacity-50"
                        >
                          Гости пришли
                        </button>
                      ) : null}
                      {b.remainingTenge > 0 ? (
                        <Link href={`/cash?booking=${b.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-bg-card px-3 text-sm">
                          {b.due.kind === "PREPAY" ? "Принять предоплату" : "Принять доплату"}
                        </Link>
                      ) : null}
                      <a
                        href={`tel:${b.contactPhone.replace(/[^\d+]/g, "")}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-bg-card px-3 text-sm"
                      >
                        <Phone className="h-4 w-4" /> Позвонить
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {today.tomorrowBookings > 0 ? (
              <div className="mt-3">
                <button type="button" onClick={() => void toggleTomorrow()} className="flex items-center gap-1 text-sm text-text-secondary">
                  {tomorrowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Завтра: {today.tomorrowBookings} {plural(today.tomorrowBookings, "бронь", "брони", "броней")}
                </button>
                {tomorrowOpen ? (
                  <div className="mt-2 space-y-1 text-sm">
                    {tomorrow == null ? (
                      <p className="text-text-secondary">Загрузка…</p>
                    ) : (
                      tomorrow.map((b) => (
                        <p key={b.id}>
                          {time(b.startsAt)} · {b.packageName} · {b.people} чел · {b.contactName}
                        </p>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Комнаты сейчас */}
          <section className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Комнаты сейчас</h2>
              <Link href="/live" className="text-xs text-cyan">
                В зал
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {today.rooms.map((r) => {
                const left = r.remainingSeconds != null ? Math.max(0, r.remainingSeconds - (r.paused ? 0 : tick)) : null;
                return (
                  <Link
                    key={r.roomId}
                    href="/live"
                    className={`${row} block hover:bg-white/5 ${r.status === "OFFLINE" ? "ring-1 ring-danger/60" : ""}`}
                  >
                    <p className="font-semibold">{r.name}</p>
                    <p
                      className={`text-sm ${
                        r.status === "FREE" ? "text-success" : r.status === "OFFLINE" ? "text-danger" : "text-cyan"
                      }`}
                    >
                      {r.status === "FREE"
                        ? "Свободна"
                        : r.status === "OFFLINE"
                          ? "Нет связи"
                          : `Идёт игра${left != null ? ` · ${mmss(left)} осталось` : ""}${r.paused ? " · пауза" : ""}`}
                    </p>
                    {r.status === "BUSY" ? (
                      <p className="text-xs text-text-secondary">
                        {r.players} {plural(r.players, "игрок", "игрока", "игроков")}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:col-span-5">
          {/* Важное сегодня */}
          {hasImportant ? (
            <section className={panel}>
              <h2 className="mb-3 text-base font-semibold">Важное сегодня</h2>
              <ul className="space-y-2 text-sm">
                {important.offlineRooms.map((r) => (
                  <li key={r.roomId} className={`${row} text-danger`}>
                    {r.name}: нет связи {r.minutes} мин
                  </li>
                ))}
                {important.birthdays.length > 0 ? (
                  <li className={row}>
                    🎂 День рождения: {important.birthdays.map((b) => `${b.nickname} (${b.age})`).join(", ")}
                  </li>
                ) : null}
                {important.expiringMinutes.length > 0 ? (
                  <li className={row}>
                    <p className="mb-1">Сгорают сегодня — напомните:</p>
                    {important.expiringMinutes.slice(0, 8).map((e) => (
                      <p key={e.userId} className="text-text-secondary">
                        {e.nickname} · {e.minutes} мин до {time(e.expiresAt)}
                      </p>
                    ))}
                  </li>
                ) : null}
                {important.lowStock.map((i) => (
                  <li key={i.id} className={`${row} text-amber-300`}>
                    {i.name}: осталось {i.stockQty} шт. (порог {i.lowStockAt})
                  </li>
                ))}
                {important.tournament.leader ? (
                  <li className={row}>
                    Турнир месяца: до конца {important.tournament.daysLeft}{" "}
                    {plural(important.tournament.daysLeft, "день", "дня", "дней")}, лидер{" "}
                    <b>{important.tournament.leader.nickname}</b> ({important.tournament.leader.points})
                  </li>
                ) : null}
              </ul>
            </section>
          ) : null}

          {/* Цифры дня */}
          <section className={panel}>
            <h2 className="mb-3 text-base font-semibold">Цифры дня</h2>
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-text-secondary">Сеансов</p>
                <p className="text-3xl font-bold tabular-nums">{stats?.totalSessions ?? 0}</p>
              </div>
              <DonutChart data={sessionsByRoom} total={totalChart} />
              <div className="flex flex-col gap-1 text-xs text-[#D5E6F7]">
                {sessionsByRoom.map((r) => (
                  <span key={r.roomId ?? r.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                    {r.name}: <b>{r.count}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className={row}>
                <p className="text-xs text-text-secondary">Посетители</p>
                <p className="text-xl font-bold tabular-nums">{stats?.totalPlayers ?? 0}</p>
              </div>
              <div className={row}>
                <p className="text-xs text-text-secondary">Новые игроки</p>
                <p className="text-xl font-bold tabular-nums">+{stats?.newPlayers ?? 0}</p>
              </div>
              <div className={`${row} col-span-2`}>
                <p className="text-xs text-text-secondary">
                  {numbers.scope === "DAY" ? "Выручка дня" : "Мои продажи за смену"}
                </p>
                <p className="text-xl font-bold tabular-nums">
                  {formatTenge(numbers.revenue)}{" "}
                  <span className="text-sm font-normal text-text-secondary">
                    · {numbers.sales} {plural(numbers.sales, "продажа", "продажи", "продаж")}
                  </span>
                </p>
              </div>
            </div>
            {isAdmin ? null : (
              <p className="mt-2 text-xs text-text-muted">Выручку за день видит владелец</p>
            )}
          </section>
        </div>
      </div>

      <AddPlayerModal
        isOpen={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onAdded={(id) => {
          setAddPlayerOpen(false);
          setSellTo(id);
        }}
      />

      {sellTo ? (
        <Dialog title="Игрок добавлен" onClose={() => setSellTo(null)}>
          <p className="mt-2 text-sm text-text-secondary">Продать этому игроку?</p>
          <div className="mt-5 flex gap-2">
            <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={() => setSellTo(null)}>
              Нет
            </button>
            <button
              type="button"
              className="min-h-12 flex-1 rounded-xl bg-cyan font-semibold text-black"
              onClick={() => router.push(`/cash?player=${sellTo}`)}
            >
              Продать
            </button>
          </div>
        </Dialog>
      ) : null}

      {roomPickerOpen ? (
        <Dialog title="Какую комнату запустить?" onClose={() => setRoomPickerOpen(false)}>
          {freeRooms.length === 0 ? (
            <p className="mt-3 text-sm text-text-secondary">Свободных комнат нет</p>
          ) : (
            <div className="mt-3 grid gap-2">
              {freeRooms.map((r) => (
                <button
                  key={r.roomId}
                  type="button"
                  onClick={() => router.push(`/live?launch=${r.roomId}`)}
                  className="min-h-12 rounded-xl bg-bg-card px-4 text-left font-medium hover:bg-white/10"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
          <button type="button" className="mt-4 min-h-11 w-full rounded-xl bg-bg-card" onClick={() => setRoomPickerOpen(false)}>
            Закрыть
          </button>
        </Dialog>
      ) : null}
    </div>
  );
}

function QuickButton({ label, href, onClick, primary }: { label: string; href?: string; onClick?: () => void; primary?: boolean }) {
  const cls = `flex min-h-14 items-center justify-center rounded-xl px-3 text-center text-sm font-semibold transition-opacity hover:opacity-90 ${
    primary ? "bg-cyan text-black" : "bg-[#19232E] text-white"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const CIRCLE_LENGTH = 2 * Math.PI * 40;

function DonutChart({ data, total, size = 72 }: { data: { name: string; count: number; color: string }[]; total: number; size?: number }) {
  let offset = 0;
  const segments = data.map((d) => {
    const pct = total ? (d.count / total) * 100 : 0;
    const segment = { ...d, pct, offset };
    offset += pct;
    return segment;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden>
      <circle cx="50" cy="50" r="40" fill="none" stroke="#2A3A4B" strokeWidth="16" />
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * CIRCLE_LENGTH;
        return (
          <circle
            key={i}
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={seg.color}
            strokeWidth="16"
            strokeDasharray={`${dash} ${CIRCLE_LENGTH - dash}`}
            strokeDashoffset={-((seg.offset / 100) * CIRCLE_LENGTH)}
            transform="rotate(-90 50 50)"
          />
        );
      })}
    </svg>
  );
}
