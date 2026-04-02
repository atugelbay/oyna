"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { roomsService } from "@/services/rooms.service";
import { gameModesService } from "@/services/game-modes.service";
import { gameSessionsService } from "@/services/game-sessions.service";
import { playersService } from "@/services/players.service";
import { readApiUserError } from "@/lib/api-error-message";

export type LaunchRoomTarget = { id: string; name: string };

/** Режим комнаты; «сессии» из формы создания комнаты — это GameMode с durationSeconds в config */
type RoomModeRow = {
  id: string;
  type: string;
  name: string;
  /** задано при создании комнаты (AddRoomModal) */
  durationSeconds: number | null;
  /** порядок в форме «Сессии»; если нет — используется порядок с API */
  sortOrder: number | null;
};

/** Минимум секунд на балансе у каждого игрока для подтверждения старта (10 мин) */
const MIN_BALANCE_SECONDS = 600;

type PickedPlayer = { id: string; nickname: string; phone: string; balanceSeconds?: number };

function formatPhoneShort(phone: string) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  if (d.length < 10) return String(phone || "").trim() || "—";
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}

function resolveModeId(modes: RoomModeRow[], kind: "collective" | "solo"): string | null {
  if (kind === "collective") {
    const m = modes.find((x) => x.type === "COOP");
    return m?.id ?? null;
  }
  const m = modes.find((x) => x.type === "FFA") ?? modes.find((x) => x.type === "COMPETITIVE");
  return m?.id ?? null;
}

function formatMinutesLabel(minutes: number): string {
  const m = Math.round(minutes);
  if (m % 60 === 0 && m >= 60) {
    const h = m / 60;
    return `${h} ч`;
  }
  return `${m} мин`;
}

function normalizeRoomModes(list: unknown): RoomModeRow[] {
  if (!Array.isArray(list)) return [];
  const withIndex = list
    .map((raw, apiIndex) => {
      const o = raw as Record<string, unknown>;
      const config = o.config;
      let durationSeconds: number | null = null;
      let sortOrder: number | null = null;
      if (config && typeof config === "object" && config !== null) {
        const c = config as { durationSeconds?: unknown; sortOrder?: unknown };
        if (typeof c.durationSeconds === "number" && Number.isFinite(c.durationSeconds) && c.durationSeconds > 0) {
          durationSeconds = Math.round(c.durationSeconds);
        }
        if (typeof c.sortOrder === "number" && Number.isFinite(c.sortOrder)) {
          sortOrder = c.sortOrder;
        }
      }
      return {
        id: o.id != null ? String(o.id) : "",
        type: String(o.type ?? ""),
        name: String(o.name ?? ""),
        durationSeconds,
        sortOrder,
        _apiIndex: apiIndex,
      };
    })
    .filter((m) => m.id);

  withIndex.sort((a, b) => {
    if (a.sortOrder != null && b.sortOrder != null && a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    if (a.sortOrder != null && b.sortOrder == null) return -1;
    if (a.sortOrder == null && b.sortOrder != null) return 1;
    return a._apiIndex - b._apiIndex;
  });

  return withIndex.map(({ _apiIndex: _, ...row }) => row);
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

type LaunchRoomModalProps = {
  target: LaunchRoomTarget | null;
  isOpen: boolean;
  onClose: () => void;
  onSessionStarted?: () => void;
};

export function LaunchRoomModal({ target, isOpen, onClose, onSessionStarted }: LaunchRoomModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [roomDefaultSeconds, setRoomDefaultSeconds] = useState(120);
  const [roomModes, setRoomModes] = useState<RoomModeRow[]>([]);
  const [modeKind, setModeKind] = useState<"collective" | "solo">("collective");
  const [selectedSessionModeId, setSelectedSessionModeId] = useState<string | null>(null);
  const [players, setPlayers] = useState<PickedPlayer[]>([]);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerSearchFocused, setPlayerSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<PickedPlayer[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !target) return;
    setLoadError(null);
    setSubmitError(null);
    setPlayers([]);
    setPlayerSearch("");
    setPlayerSearchFocused(false);
    setSearchResults([]);
    setLoading(true);

    (async () => {
      try {
        const [room, list] = await Promise.all([
          roomsService.getById(target.id),
          gameModesService.listByRoom(target.id),
        ]);
        const r = room as {
          venueId?: string;
          defaultLevelDuration?: number;
        };
        if (!r?.venueId) {
          setLoadError("У комнаты не указана площадка");
          return;
        }
        setVenueId(String(r.venueId));
        const def = typeof r.defaultLevelDuration === "number" ? r.defaultLevelDuration : 120;
        setRoomDefaultSeconds(def);

        const rows = normalizeRoomModes(list);
        setRoomModes(rows);

        const collectiveSessions = rows.filter((m) => m.durationSeconds != null && m.type === "COOP");
        const soloSessions = rows.filter(
          (m) => m.durationSeconds != null && (m.type === "FFA" || m.type === "COMPETITIVE"),
        );

        if (collectiveSessions.length) {
          setModeKind("collective");
          const match = collectiveSessions.find((s) => s.durationSeconds === def) ?? collectiveSessions[0];
          setSelectedSessionModeId(match.id);
        } else if (soloSessions.length) {
          setModeKind("solo");
          const match = soloSessions.find((s) => s.durationSeconds === def) ?? soloSessions[0];
          setSelectedSessionModeId(match.id);
        } else {
          const hasCollective = rows.some((m) => m.type === "COOP");
          const hasSolo = rows.some((m) => m.type === "FFA" || m.type === "COMPETITIVE");
          if (hasCollective) setModeKind("collective");
          else if (hasSolo) setModeKind("solo");
          else setModeKind("collective");
          setSelectedSessionModeId(null);
        }
      } catch (e) {
        setLoadError(readApiUserError(e, "Не удалось загрузить данные"));
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, target]);

  const collectiveSessions = useMemo(
    () => roomModes.filter((m) => m.durationSeconds != null && m.type === "COOP"),
    [roomModes],
  );
  const soloSessions = useMemo(
    () =>
      roomModes.filter(
        (m) => m.durationSeconds != null && (m.type === "FFA" || m.type === "COMPETITIVE"),
      ),
    [roomModes],
  );

  const sessionOptions = useMemo(
    () => (modeKind === "collective" ? collectiveSessions : soloSessions),
    [modeKind, collectiveSessions, soloSessions],
  );

  useEffect(() => {
    if (!sessionOptions.length) {
      setSelectedSessionModeId(null);
      return;
    }
    setSelectedSessionModeId((prev) => {
      if (prev && sessionOptions.some((o) => o.id === prev)) return prev;
      const match =
        sessionOptions.find((s) => s.durationSeconds === roomDefaultSeconds) ?? sessionOptions[0];
      return match.id;
    });
  }, [sessionOptions, roomDefaultSeconds]);

  useEffect(() => {
    if (!isOpen) return;
    const q = playerSearch.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSearchLoading(true);
      playersService
        .list({ q, page: 1, limit: 12 })
        .then((res: { data?: unknown[] }) => {
          if (cancelled) return;
          const raw = Array.isArray(res?.data) ? res.data : [];
          const rows: PickedPlayer[] = raw
            .map((p) => {
              const o = p as Record<string, unknown>;
              const id = o.id != null ? String(o.id) : "";
              const nickname = o.nickname != null ? String(o.nickname) : "";
              const phone = o.phone != null ? String(o.phone) : "";
              let balanceSeconds: number | undefined;
              if (typeof o.balanceSeconds === "number" && Number.isFinite(o.balanceSeconds)) {
                balanceSeconds = Math.max(0, Math.floor(o.balanceSeconds));
              } else if (typeof o.balanceMinutes === "number" && Number.isFinite(o.balanceMinutes)) {
                balanceSeconds = Math.max(0, Math.floor(o.balanceMinutes * 60));
              }
              return { id, nickname, phone, balanceSeconds };
            })
            .filter((r) => r.id && r.nickname);
          setSearchResults(rows);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          setSearchLoading(false);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [playerSearch, isOpen]);

  const hasCollectiveMode = roomModes.some((m) => m.type === "COOP");
  const hasSoloMode = roomModes.some((m) => m.type === "FFA" || m.type === "COMPETITIVE");

  const effectiveModeId = useMemo(() => {
    if (sessionOptions.length > 0) {
      if (selectedSessionModeId && sessionOptions.some((o) => o.id === selectedSessionModeId)) {
        return selectedSessionModeId;
      }
      return sessionOptions[0]?.id ?? null;
    }
    return resolveModeId(roomModes, modeKind);
  }, [sessionOptions, selectedSessionModeId, roomModes, modeKind]);

  const selectedSessionSeconds = useMemo(() => {
    const row = roomModes.find((m) => m.id === effectiveModeId);
    if (row?.durationSeconds != null) return row.durationSeconds;
    return roomDefaultSeconds;
  }, [roomModes, effectiveModeId, roomDefaultSeconds]);

  const addPlayer = useCallback((p: PickedPlayer) => {
    setPlayers((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev;
      return [...prev, p];
    });
    setPlayerSearch("");
    setSearchResults([]);
  }, []);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleConfirm = async () => {
    if (!target || !venueId || !effectiveModeId) {
      setSubmitError("Выберите сессию и режим");
      return;
    }
    if (players.length < 1) {
      setSubmitError("Добавьте хотя бы одного игрока");
      return;
    }
    const shortBalance = players.filter(
      (p) => typeof p.balanceSeconds === "number" && p.balanceSeconds < MIN_BALANCE_SECONDS,
    );
    if (shortBalance.length > 0) {
      setSubmitError(
        `У каждого игрока нужно минимум ${MIN_BALANCE_SECONDS / 60} мин на балансе: ${shortBalance.map((p) => p.nickname).join(", ")}`,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (selectedSessionSeconds !== roomDefaultSeconds) {
        await roomsService.update(target.id, { defaultLevelDuration: selectedSessionSeconds });
      }
      await gameSessionsService.start({
        roomId: target.id,
        modeId: effectiveModeId,
        venueId,
        playerIds: players.map((p) => p.id),
      });
      onSessionStarted?.();
      onClose();
    } catch (e) {
      setSubmitError(readApiUserError(e, "Не удалось выполнить действие"));
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || !isOpen || !target) return null;

  const chipBase =
    "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const chipOff = "border-surface-border bg-[#1A2430] text-text-primary hover:border-surface-border/80";
  const chipOn = "border-white bg-white text-black";

  const modeMissing = !effectiveModeId;
  const hasPlayerBelowMinBalance = players.some(
    (p) => typeof p.balanceSeconds === "number" && p.balanceSeconds < MIN_BALANCE_SECONDS,
  );
  const playerSearchLabelFloating = playerSearchFocused || playerSearch.length > 0;
  const playerSearchBorderActive = playerSearchFocused || searchResults.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[200] h-[100dvh] w-full max-w-[100vw]">
      <button
        type="button"
        className="absolute inset-0 h-full min-h-[100dvh] w-full border-0 bg-black/25 p-0 backdrop-blur-xl"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className="absolute bottom-0 left-1/2 top-0 z-10 flex w-full max-w-xl -translate-x-1/2 flex-col bg-[#141C26] shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-room-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          <div className="my-auto mx-auto flex w-full max-w-md flex-col gap-6 pb-10 pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <BackIcon />
              </button>
              <h2 id="launch-room-title" className="text-lg font-semibold text-white">
                {target.name}
              </h2>
            </div>

            {loading ? (
              <p className="text-sm text-text-secondary">Загрузка…</p>
            ) : loadError ? (
              <p className="text-sm text-danger">{loadError}</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Выбор сессии</p>
                  {sessionOptions.length === 0 ? (
                    <p className="text-sm text-text-secondary">
                      Для комнаты не заданы сессии с длительностью (как при создании комнаты). Будет использован
                      режим по умолчанию и длительность из настроек комнаты:{" "}
                      <span className="text-white">{formatMinutesLabel(roomDefaultSeconds / 60)}</span>.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sessionOptions.map((s) => {
                        const selected = selectedSessionModeId === s.id;
                        const sec = s.durationSeconds ?? 0;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelectedSessionModeId(s.id)}
                            className={`${chipBase} shrink-0 whitespace-nowrap ${selected ? chipOn : chipOff}`}
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className={selected ? "text-black/65" : "text-text-secondary"}>
                              {" "}
                              - {formatMinutesLabel(sec / 60)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Режим игры</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!hasSoloMode}
                      title={
                        !hasSoloMode
                          ? "Для этой комнаты не создан одиночный режим (FFA). Добавьте комнату заново или создайте режим вручную."
                          : undefined
                      }
                      onClick={() => setModeKind("solo")}
                      className={`${chipBase} ${modeKind === "solo" ? chipOn : chipOff}`}
                    >
                      Одиночный
                    </button>
                    <button
                      type="button"
                      disabled={!hasCollectiveMode}
                      title={
                        !hasCollectiveMode
                          ? "Для этой комнаты не настроен коллективный режим (COOP)."
                          : undefined
                      }
                      onClick={() => setModeKind("collective")}
                      className={`${chipBase} ${modeKind === "collective" ? chipOn : chipOff}`}
                    >
                      Коллективный
                    </button>
                  </div>
                  {modeKind === "collective" && hasCollectiveMode && collectiveSessions.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                      Коллективные сессии с длительностью не добавлены — будет выбран первый коллективный режим
                      комнаты.
                    </p>
                  ) : null}
                  {modeKind === "solo" && hasSoloMode && soloSessions.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                      Одиночные сессии с длительностью не добавлены — будет выбран первый одиночный режим комнаты.
                    </p>
                  ) : null}
                  {modeMissing ? (
                    <p className="text-xs text-danger">Для этой комнаты не настроен выбранный режим</p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-surface-border/50 bg-[#1A2430]/80 p-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Игроки</p>
                  <div className="relative">
                    <label
                      className={`pointer-events-none absolute z-10 transition-all duration-200 ${
                        playerSearchLabelFloating
                          ? "-top-2.5 left-3 bg-[#1A2430] px-1 text-xs text-cyan"
                          : "left-10 top-1/2 -translate-y-1/2 text-sm text-text-secondary"
                      }`}
                    >
                      Введите никнейм чтобы добавить
                    </label>
                    <UserPlus
                      className={`pointer-events-none absolute left-3 z-[1] h-[18px] w-[18px] text-text-secondary ${
                        playerSearchLabelFloating ? "top-4" : "top-1/2 -translate-y-1/2"
                      }`}
                      strokeWidth={1.75}
                    />
                    <input
                      type="search"
                      value={playerSearch}
                      onChange={(e) => setPlayerSearch(e.target.value)}
                      onFocus={() => setPlayerSearchFocused(true)}
                      onBlur={() => setPlayerSearchFocused(false)}
                      autoComplete="off"
                      className={`h-14 w-full rounded-lg border bg-bg-secondary pl-10 pr-3 text-sm text-text-primary outline-none transition-colors ${
                        playerSearchLabelFloating ? "pt-4" : ""
                      } ${
                        playerSearchBorderActive
                          ? "border-cyan shadow-[0_0_0_1px_rgba(0,229,255,0.28)]"
                          : "border-surface-border"
                      }`}
                    />
                  </div>
                  {playerSearch.trim().length > 0 && playerSearch.trim().length < 2 ? (
                    <p className="mt-2 text-xs text-text-secondary">Не меньше 2 символов</p>
                  ) : null}
                  {searchLoading ? <p className="mt-2 text-xs text-text-secondary">Поиск…</p> : null}
                  {!searchLoading && playerSearch.trim().length >= 2 && searchResults.length === 0 ? (
                    <p className="mt-2 text-xs text-text-secondary">Никого не найдено</p>
                  ) : null}
                  {searchResults.length > 0 ? (
                    <ul className="launch-room-player-dropdown mt-2 max-h-[min(40vh,16rem)] overflow-y-auto rounded-lg border border-surface-border/50 bg-[#141C26] py-1">
                      {searchResults.map((p) => {
                        const already = players.some((x) => x.id === p.id);
                        const tooLow =
                          typeof p.balanceSeconds === "number" && p.balanceSeconds < MIN_BALANCE_SECONDS;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              disabled={already || tooLow}
                              onClick={() => addPlayer(p)}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-white">{p.nickname}</div>
                                <div className="mt-0.5 text-xs text-text-secondary">
                                  {formatPhoneShort(p.phone)}
                                  {tooLow ? (
                                    <span className="mt-0.5 block text-danger">
                                      Минимум {MIN_BALANCE_SECONDS / 60} мин на балансе
                                    </span>
                                  ) : typeof p.balanceSeconds === "number" ? (
                                    <span className="mt-0.5 block text-text-muted">
                                      {Math.floor(p.balanceSeconds / 60)} мин на балансе
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <span
                                className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center leading-none rounded-full border ${
                                  already
                                    ? "border-surface-border text-text-muted"
                                    : "border-cyan text-cyan"
                                }`}
                                aria-hidden
                              >
                                <Plus
                                  className="absolute left-1/2 top-1/2 block size-3 shrink-0 -translate-x-1/2 -translate-y-1/2"
                                  strokeWidth={2}
                                  strokeLinecap="butt"
                                  shapeRendering="geometricPrecision"
                                />
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  {players.length > 0 ? (
                    <div className="mt-3 flex flex-col gap-2">
                      {players.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-lg border border-surface-border bg-bg-secondary px-3 py-2.5"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#122A3D] text-[13px] font-bold text-cyan">
                            {p.nickname.trim().charAt(0).toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white">{p.nickname}</span>
                            {typeof p.balanceSeconds === "number" ? (
                              <span
                                className={
                                  p.balanceSeconds < MIN_BALANCE_SECONDS
                                    ? "mt-0.5 block text-xs text-danger"
                                    : "mt-0.5 block text-xs text-text-muted"
                                }
                              >
                                Баланс: {Math.floor(p.balanceSeconds / 60)} мин
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePlayer(p.id)}
                            className="shrink-0 rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label={`Убрать ${p.nickname}`}
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-xs text-text-muted">
                    В сессии игроков: {players.length} (минимум 1). У каждого — не менее {MIN_BALANCE_SECONDS / 60}{" "}
                    мин на балансе.
                  </p>
                </div>

                {submitError ? <p className="text-sm text-danger">{submitError}</p> : null}

                <Button
                  type="button"
                  disabled={submitting || modeMissing || players.length < 1 || hasPlayerBelowMinBalance}
                  onClick={() => void handleConfirm()}
                  className="inline-flex w-fit items-center gap-2"
                >
                  <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                  {submitting ? "Запуск…" : "Подтвердить"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
