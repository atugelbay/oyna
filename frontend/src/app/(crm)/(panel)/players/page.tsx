"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Gift, UserPlus, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui";
import { AddPlayerModal } from "@/components/crm/AddPlayerModal";
import { PlayerProfileModal } from "@/components/crm/PlayerProfileModal";
import { SegmentBadge } from "@/components/crm/SegmentBadge";
import { readApiUserError } from "@/lib/api-error-message";
import { playersService } from "@/services/players.service";
import { useCrmVenue } from "@/lib/venue-context";
import type { Player, Segment, VisitStatus } from "./types";

const SEGMENTS: { value: "" | Segment; label: string }[] = [
  { value: "", label: "Все" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silver" },
  { value: "BRONZE", label: "Bronze" },
];

const VISIT_STATUSES: { value: "" | VisitStatus; label: string }[] = [
  { value: "", label: "Все" },
  { value: "Постоянный", label: "Постоянный" },
  { value: "Нечастый", label: "Нечастый" },
  { value: "Неактивный", label: "Неактивный" },
];

type ListQuickFilter = "" | "newToday" | "birthdayToday";

function formatPhone(phone: string) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}

function formatBirthDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function PlayersPageContent() {
  const { selectedVenueId } = useCrmVenue();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<"" | Segment>("");
  const [visitStatus, setVisitStatus] = useState<"" | VisitStatus>("");
  const [listQuickFilter, setListQuickFilter] = useState<ListQuickFilter>("");
  const [page, setPage] = useState(1);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState({ newToday: 0, birthdaysToday: 0 });
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [segment, visitStatus, listQuickFilter]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    Promise.all([
      playersService.list({
        q: search.trim() || undefined,
        page,
        limit: 5,
        filter: listQuickFilter || undefined,
      }),
      playersService.getStats(selectedVenueId ?? undefined),
    ])
      .then(([listRes, statsRes]) => {
        if (cancelled) return;
        setPlayers(listRes.data ?? []);
        setMeta(listRes.meta ?? null);
        setStats({ newToday: statsRes.newToday ?? 0, birthdaysToday: statsRes.birthdaysToday ?? 0 });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(readApiUserError(err, "Ошибка загрузки"));
        setPlayers([]);
        setStats({ newToday: 0, birthdaysToday: 0 });
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, page, refreshTick, listQuickFilter, selectedVenueId]);

  function refreshPlayers() {
    setRefreshTick((t) => t + 1);
  }

  const openPlayerProfile = useCallback((id: string) => {
    setProfilePlayerId(id);
    setProfileOpen(true);
  }, []);

  const closePlayerProfile = useCallback(() => {
    setProfileOpen(false);
    setProfilePlayerId(null);
    if (searchParams.get("player")) {
      router.replace("/players", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    const fromUrl = searchParams.get("player");
    if (fromUrl) {
      setProfilePlayerId(fromUrl);
      setProfileOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = players;
    if (segment) list = list.filter((p) => p.segment === segment);
    if (visitStatus) list = list.filter((p) => p.status === visitStatus);
    return list;
  }, [players, segment, visitStatus]);

  const totalPages = meta ? Math.max(1, meta.pages) : 1;
  const currentPage = Math.min(page, totalPages);
  const rows = filtered;
  const hasResults = filtered.length > 0;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Игроки</h1>
          <p className="text-xs text-text-secondary mt-0.5 leading-tight">Управление игроками в портале OYNA</p>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-bg-secondary rounded-xl text-center">
          <p className="text-lg font-medium text-red-500 mb-1">Ошибка загрузки</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 shrink-0">
          <h1 className="text-2xl font-bold text-white">Игроки</h1>
          <p className="text-xs text-text-secondary mt-0.5 leading-tight">Управление игроками в портале OYNA</p>
        </div>
        <div className="relative w-full sm:w-80 sm:max-w-md sm:shrink-0">
          <input
            type="text"
            placeholder="Никнейм или номер телефона игрока"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-5 pr-11 bg-bg-secondary rounded-full border-0 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-cyan/25 transition-shadow"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <SearchIcon />
          </span>
        </div>
      </div>

      {/* Summary cards — компактные, без растягивания на всю ширину */}
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          aria-pressed={listQuickFilter === "newToday"}
          onClick={() => setListQuickFilter((f) => (f === "newToday" ? "" : "newToday"))}
          className={`inline-flex max-w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 ${
            listQuickFilter === "newToday"
              ? "border-cyan/50 bg-cyan/10"
              : "border-transparent bg-bg-secondary hover:bg-bg-card/90"
          }`}
        >
          <UserRound className="w-5 h-5 shrink-0 text-[#AFC7DA]" strokeWidth={1.75} />
          <div className="min-w-0 min-w-[220px] sm:min-w-[240px]">
            <p className="text-xs text-text-secondary leading-tight">Всего новых игроков за сегодня</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-tight mt-0.5">
              {loading ? <span className="inline-block w-8 h-8 rounded bg-bg-card animate-pulse" /> : stats.newToday}
            </p>
          </div>
        </button>
        <button
          type="button"
          aria-pressed={listQuickFilter === "birthdayToday"}
          onClick={() => setListQuickFilter((f) => (f === "birthdayToday" ? "" : "birthdayToday"))}
          className={`inline-flex max-w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/50 ${
            listQuickFilter === "birthdayToday"
              ? "border-cyan/50 bg-cyan/10"
              : "border-transparent bg-bg-secondary hover:bg-bg-card/90"
          }`}
        >
          <Gift className="w-5 h-5 shrink-0 text-[#AFC7DA]" strokeWidth={1.75} />
          <div className="min-w-0 min-w-[220px] sm:min-w-[240px]">
            <p className="text-xs text-text-secondary leading-tight">Сегодня день рождения</p>
            <p className="text-2xl font-bold text-white tabular-nums leading-tight mt-0.5">
              {loading ? <span className="inline-block w-8 h-8 rounded bg-bg-card animate-pulse" /> : stats.birthdaysToday}
            </p>
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Сегмент:</span>
          <div className="flex gap-1">
            {SEGMENTS.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setSegment(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  segment === value ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-text-secondary">Статус посещения:</span>
          <div className="flex gap-1">
            {VISIT_STATUSES.map(({ value, label }) => (
              <button
                key={value || "all"}
                type="button"
                onClick={() => setVisitStatus(value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  visitStatus === value ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      <p className="text-sm text-text-secondary">Результат поиска</p>

      {loading ? (
        <div className="rounded-xl bg-bg-secondary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-text-secondary">
                <th className="py-3 px-4 font-medium">Прозвище</th>
                <th className="py-3 px-4 font-medium">Контакты</th>
                <th className="py-3 px-4 font-medium">Дата рождения</th>
                <th className="py-3 px-4 font-medium">Статус</th>
                <th className="py-3 px-4 font-medium">Количество сессии</th>
                <th className="py-3 px-4 font-medium">Баланс</th>
                <th className="py-3 px-4 font-medium">Сегмент</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="border-b border-surface-border/50 last:border-0">
                  <td className="py-3 px-4"><span className="inline-block h-5 w-24 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-28 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-20 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-16 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-8 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-12 rounded bg-bg-card animate-pulse" /></td>
                  <td className="py-3 px-4"><span className="inline-block h-5 w-12 rounded bg-bg-card animate-pulse" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : hasResults ? (
        <>
          <div className="rounded-xl bg-bg-secondary overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-text-secondary">
                  <th className="py-3 px-4 font-medium">Прозвище</th>
                  <th className="py-3 px-4 font-medium">Контакты</th>
                  <th className="py-3 px-4 font-medium">Дата рождения</th>
                  <th className="py-3 px-4 font-medium">Статус</th>
                  <th className="py-3 px-4 font-medium">Количество сессии</th>
                  <th className="py-3 px-4 font-medium">Баланс</th>
                  <th className="py-3 px-4 font-medium">Сегмент</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((player) => (
                  <tr
                    key={player.id}
                    className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openPlayerProfile(player.id)}
                        className="flex items-center gap-2 text-left text-text-primary transition-colors hover:text-cyan"
                      >
                        <Avatar letter={player.nickname[0]?.toUpperCase()} size={28} />
                        {player.nickname}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{formatPhone(player.phone)}</td>
                    <td className="py-3 px-4 text-text-secondary">
                      {formatBirthDate(player.birthDate as string)} {player.age && `– ${player.age}`}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{player.status}</td>
                    <td className="py-3 px-4 text-text-primary">{player.sessionsCount}</td>
                    <td className="py-3 px-4 text-text-primary">{player.balanceMinutes} мин</td>
                    <td className="py-3 px-4">
                      <SegmentBadge segment={player.segment} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                <ChevronLeftIcon />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    n === currentPage ? "bg-cyan/20 text-cyan" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-50"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex w-full justify-center">
          <div className="flex w-fit min-w-[min(100%,380px)] max-w-full flex-col items-center rounded-[30px] bg-bg-secondary px-12 py-14 text-center sm:min-w-[490px] sm:px-16">
            <SearchIcon className="mb-5 h-10 w-10 shrink-0 text-white" />
            <div className="mb-8 flex flex-col items-center gap-0.5">
              <p className="text-lg font-medium text-white">Ничего не найдено</p>
              <p className="max-w-sm text-sm text-text-secondary">Проверьте свой запрос в поле ввода</p>
            </div>
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex h-[51px] items-center gap-2 rounded-full bg-cyan px-5 text-sm font-bold text-bg-primary transition-[filter] hover:brightness-110"
            >
              <UserPlus className="h-5 w-5 shrink-0 text-bg-primary" strokeWidth={2} />
              Добавить игрока
            </button>
          </div>
        </div>
      )}

      {(loading || hasResults) && (
        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
        >
          <PlusIcon />
          Добавить
        </button>
      )}

      <AddPlayerModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdded={(id) => {
          refreshPlayers();
          openPlayerProfile(id);
        }}
      />
      <PlayerProfileModal
        playerId={profilePlayerId}
        isOpen={profileOpen}
        onClose={closePlayerProfile}
      />
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Игроки</h1>
            <p className="text-xs text-text-secondary mt-0.5 leading-tight">Управление игроками в портале OYNA</p>
          </div>
          <p className="text-sm text-text-secondary">Загрузка...</p>
        </div>
      }
    >
      <PlayersPageContent />
    </Suspense>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
