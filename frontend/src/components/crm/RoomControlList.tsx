"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CirclePlus, CircleStop, Pause, Play, Square, WifiOff } from "lucide-react";
import { statsService } from "@/services/stats.service";
import { gameSessionsService } from "@/services/game-sessions.service";
import { LaunchRoomModal } from "@/components/crm/LaunchRoomModal";
import { readApiUserError } from "@/lib/api-error-message";
import api from "@/lib/api";

/**
 * Комнаты зала с управлением: запуск, пауза, стоп. Используется в «Зал → Сейчас в зале».
 * Статусы обновляются каждые 3 секунды и при возврате на вкладку.
 */
type DashboardRoom = {
  id: string;
  name: string;
  /** true = virtual/mock (CRM может activate). false = зал: старт на HUD */
  useDevCommands?: boolean;
  status: "free" | "occupied" | "waiting";
  playerNickname?: string;
  waitingPlayerNicknames?: string[];
  pendingSessionId?: string;
  pendingSessionToken?: string;
  sessionPlayerNicknames?: string[];
  sessionPlayerUserIds?: string[];
  activeSessionId?: string;
  sessionStartTime?: string;
  levelDurationSeconds?: number;
  pausedAt?: string;
};

/** ID и строки из API (иногда не string в промежуточных слоях) */
function asNonEmptyString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function pickStr(o: Record<string, unknown>, a: string, b: string): string | undefined {
  return asNonEmptyString(o[a]) ?? asNonEmptyString(o[b]);
}

function pickNum(o: Record<string, unknown>, a: string, b: string): number | undefined {
  const tryVal = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return undefined;
  };
  return tryVal(o[a]) ?? tryVal(o[b]);
}

function pickStrArray(o: Record<string, unknown>, a: string, b: string): string[] | undefined {
  const x = o[a];
  const y = o[b];
  const arr = (Array.isArray(x) ? x : Array.isArray(y) ? y : null) as unknown[] | null;
  if (!arr) return undefined;
  const out = arr
    .map((v) => {
      if (typeof v === "string" || typeof v === "number") return String(v).trim();
      if (v && typeof v === "object" && "nickname" in v) return asNonEmptyString((v as { nickname?: unknown }).nickname);
      return "";
    })
    .filter(Boolean) as string[];
  return out.length ? out : undefined;
}

/** Нормализация ответа API (camelCase / snake_case) и гарантированные id для кнопок */
function normalizeDashboardRoom(raw: unknown): DashboardRoom {
  const r = raw as Record<string, unknown>;
  const status = r.status as DashboardRoom["status"];
  const id = String(r.id ?? "");
  const name = String(r.name ?? "");
  const base: DashboardRoom = {
    id,
    name,
    useDevCommands: Boolean(r.useDevCommands ?? r.use_dev_commands),
    status: status === "free" || status === "occupied" || status === "waiting" ? status : "free",
    playerNickname: pickStr(r, "playerNickname", "player_nickname"),
    waitingPlayerNicknames: pickStrArray(r, "waitingPlayerNicknames", "waiting_player_nicknames") as
      | string[]
      | undefined,
    pendingSessionId: pickStr(r, "pendingSessionId", "pending_session_id"),
    pendingSessionToken: pickStr(r, "pendingSessionToken", "pending_session_token"),
    sessionPlayerNicknames: pickStrArray(r, "sessionPlayerNicknames", "session_player_nicknames") as
      | string[]
      | undefined,
    sessionPlayerUserIds: pickStrArray(r, "sessionPlayerUserIds", "session_player_user_ids") as
      | string[]
      | undefined,
    activeSessionId: pickStr(r, "activeSessionId", "active_session_id"),
    sessionStartTime: pickStr(r, "sessionStartTime", "session_start_time"),
    levelDurationSeconds: pickNum(r, "levelDurationSeconds", "level_duration_seconds"),
    pausedAt: pickStr(r, "pausedAt", "paused_at"),
  };
  return base;
}

/** Не даём полям со значением undefined затирать данные из другого слоя (например гидрация activeSessionId). */
function omitUndefinedShallow<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

function isAxiosNotFound(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 404;
}

const dashboardRowFill = "rounded-xl bg-[#141C26] px-4 py-3.5";

function formatWaitingPlayersLine(nicknames: string[]): string {
  const list = nicknames.map((n) => String(n).trim()).filter(Boolean);
  if (list.length === 0) return "—";
  const shown = list.slice(0, 2);
  const rest = list.length - shown.length;
  const head = shown.join(", ");
  if (rest > 0) return `${head}, ещё +${rest}`;
  return head;
}

/** Оставшиеся секунды уровня; при паузе фиксируется на момент pausedAt */
function getSessionRemainingSeconds(
  levelDurationSeconds: number,
  sessionStartTimeIso: string,
  pausedAtIso?: string | null,
  nowMs = Date.now(),
): number {
  const startMs = new Date(sessionStartTimeIso).getTime();
  const endRefMs = pausedAtIso ? new Date(pausedAtIso).getTime() : nowMs;
  const elapsedSec = Math.floor((endRefMs - startMs) / 1000);
  return Math.max(0, levelDurationSeconds - elapsedSec);
}

function formatSessionCountdown(
  levelDurationSeconds: number,
  sessionStartTimeIso: string,
  pausedAtIso?: string | null,
  nowMs = Date.now(),
): string {
  const rem = getSessionRemainingSeconds(levelDurationSeconds, sessionStartTimeIso, pausedAtIso, nowMs);
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function RoomStatusRow({
  room: roomProp,
  onLaunch,
  onSessionsChange,
}: {
  room: DashboardRoom;
  onLaunch?: (room: { id: string; name: string }) => void;
  onSessionsChange?: () => void;
}) {
  const [sessionPatch, setSessionPatch] = useState<Partial<DashboardRoom> | null>(null);
  const [hydratingSession, setHydratingSession] = useState(false);

  /** Сначала patch, потом поля дашборда; undefined из roomProp не затирает patch (иначе гидрация теряет activeSessionId). */
  const room = useMemo(
    () =>
      ({
        ...omitUndefinedShallow(sessionPatch ?? {}),
        ...omitUndefinedShallow(roomProp),
      }) as DashboardRoom,
    [roomProp, sessionPatch],
  );

  const needsActiveSessionFetch = useMemo(() => {
    if (room.status !== "occupied" || !room.id?.trim()) return false;
    const hasId = Boolean(asNonEmptyString(room.activeSessionId));
    const hasStart = Boolean(asNonEmptyString(room.sessionStartTime));
    const dur = room.levelDurationSeconds;
    const hasDur = typeof dur === "number" && Number.isFinite(dur) && dur > 0;
    return !(hasId && hasStart && hasDur);
  }, [
    room.status,
    room.id,
    room.activeSessionId,
    room.sessionStartTime,
    room.levelDurationSeconds,
  ]);

  const roomPropHasFullSessionRow = useMemo(
    () =>
      roomProp.status === "occupied" &&
      Boolean(roomProp.id?.trim()) &&
      Boolean(asNonEmptyString(roomProp.activeSessionId)) &&
      Boolean(asNonEmptyString(roomProp.sessionStartTime)) &&
      typeof roomProp.levelDurationSeconds === "number" &&
      Number.isFinite(roomProp.levelDurationSeconds) &&
      roomProp.levelDurationSeconds > 0,
    [
      roomProp.status,
      roomProp.id,
      roomProp.activeSessionId,
      roomProp.sessionStartTime,
      roomProp.levelDurationSeconds,
    ],
  );

  useEffect(() => {
    if (roomProp.status !== "occupied") {
      setSessionPatch(null);
      setHydratingSession(false);
    }
  }, [roomProp.status]);

  useEffect(() => {
    if (roomPropHasFullSessionRow) setSessionPatch(null);
  }, [roomPropHasFullSessionRow]);

  useEffect(() => {
    if (!needsActiveSessionFetch || !roomProp.id?.trim()) return;

    let cancelled = false;
    setHydratingSession(true);
    void gameSessionsService
      .list({ roomId: roomProp.id, status: "ACTIVE", limit: 1 })
      .then((res) => {
        if (cancelled) return;
        const row = res?.data?.[0] as Record<string, unknown> | undefined;
        if (!row) return;
        const sid = pickStr(row, "id", "session_id");
        if (!sid) return;

        const players = Array.isArray(row.players) ? row.players : [];
        const nicknames = players
          .map((p) => {
            const u =
              p && typeof p === "object" && "user" in p
                ? (p as { user?: { nickname?: unknown } }).user
                : undefined;
            return typeof u?.nickname === "string" ? u.nickname.trim() : "";
          })
          .filter(Boolean) as string[];

        const userIds = players
          .map((p) => {
            if (!p || typeof p !== "object") return "";
            const o = p as { userId?: unknown; user_id?: unknown };
            const id = o.userId ?? o.user_id;
            return id != null ? String(id) : "";
          })
          .filter(Boolean);

        const roomRec =
          row.room && typeof row.room === "object"
            ? (row.room as Record<string, unknown>)
            : {};
        const dur = pickNum(roomRec, "defaultLevelDuration", "default_level_duration");
        const startRaw = pickStr(row, "startTime", "start_time");
        const pausedRaw = pickStr(row, "pausedAt", "paused_at");

        const patch = {
          activeSessionId: sid,
          sessionStartTime: startRaw ? new Date(startRaw).toISOString() : undefined,
          levelDurationSeconds: typeof dur === "number" && dur > 0 ? dur : undefined,
          sessionPlayerNicknames: nicknames.length ? nicknames : undefined,
          sessionPlayerUserIds: userIds.length ? userIds : undefined,
          pausedAt: pausedRaw ? new Date(pausedRaw).toISOString() : undefined,
        };
        setSessionPatch(patch);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydratingSession(false);
      });

    return () => {
      cancelled = true;
      setHydratingSession(false);
    };
  }, [needsActiveSessionFetch, roomProp.id]);

  const isFree = room.status === "free";
  const isWaiting = room.status === "waiting";
  const isOccupied = room.status === "occupied";
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const sessionId = room.activeSessionId?.trim() || null;

  const canCountdown =
    isOccupied &&
    Boolean(room.sessionStartTime) &&
    typeof room.levelDurationSeconds === "number" &&
    room.levelDurationSeconds > 0;

  const needTimerTick = canCountdown && !room.pausedAt;

  useEffect(() => {
    if (!needTimerTick) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [needTimerTick]);

  const remainingSeconds = useMemo(() => {
    if (!canCountdown || !room.sessionStartTime || room.levelDurationSeconds == null) return null;
    return getSessionRemainingSeconds(room.levelDurationSeconds, room.sessionStartTime, room.pausedAt);
  }, [canCountdown, room.sessionStartTime, room.levelDurationSeconds, room.pausedAt, tick]);

  const timeIsUp = remainingSeconds === 0;
  const sessionCountdownLabel =
    canCountdown && room.sessionStartTime && room.levelDurationSeconds != null
      ? formatSessionCountdown(room.levelDurationSeconds, room.sessionStartTime, room.pausedAt)
      : null;

  const waitingNames = room.waitingPlayerNicknames?.length
    ? room.waitingPlayerNicknames
    : room.playerNickname
      ? [room.playerNickname]
      : [];

  const inGameNames = room.sessionPlayerNicknames?.length
    ? room.sessionPlayerNicknames
    : room.playerNickname
      ? [room.playerNickname]
      : [];

  const playerUserIdsForEnd = room.sessionPlayerUserIds?.length
    ? room.sessionPlayerUserIds
    : [];

  /** Завершить активную сессию: списание за фактическое время (как «Завершить» по таймеру, так и «Стоп» вручную).
   * Гости без userId: пустой results → backend шлёт Room API /session/stop. */
  const handleFinalizeSession = async () => {
    if (!sessionId || busy) return;
    if (!canCountdown || room.levelDurationSeconds == null || remainingSeconds == null) return;

    const usedSeconds = Math.min(
      room.levelDurationSeconds,
      Math.max(1, room.levelDurationSeconds - remainingSeconds),
    );

    setBusy(true);
    try {
      await gameSessionsService.end(sessionId, {
        durationSeconds: usedSeconds,
        results: playerUserIdsForEnd.map((userId) => ({ userId, score: 0 })),
      });
      onSessionsChange?.();
    } catch (e) {
      console.error(e);
      if (isAxiosNotFound(e)) {
        setSessionPatch(null);
        onSessionsChange?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePrimarySessionAction = async () => {
    if (busy) return;
    if (isWaiting) {
      // Зал: старт только «НАЧАТЬ ИГРУ» на HUD — CRM activate даст 400.
      if (!room.useDevCommands) return;
      if (!roomProp.pendingSessionToken) return;
      setBusy(true);
      try {
        await gameSessionsService.activateByToken(roomProp.pendingSessionToken);
        onSessionsChange?.();
      } catch (e) {
        console.error(e);
        window.alert(readApiUserError(e, "Не удалось запустить сессию"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!isOccupied || !sessionId) return;

    if (canCountdown && timeIsUp) {
      await handleFinalizeSession();
      return;
    }

    setBusy(true);
    try {
      if (room.pausedAt) {
        await gameSessionsService.resumeActive(sessionId);
      } else {
        await gameSessionsService.pauseActive(sessionId);
      }
      onSessionsChange?.();
    } catch (e) {
      console.error(e);
      if (isAxiosNotFound(e)) {
        setSessionPatch(null);
        onSessionsChange?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const hallAwaitsHud = isWaiting && !room.useDevCommands;
  const waitingLabel = busy ? "Запуск…" : hallAwaitsHud ? "Ждём HUD" : "Начать";

  const occupiedShowComplete = Boolean(isOccupied && sessionId && canCountdown && timeIsUp);
  const occupiedPaused = Boolean(isOccupied && sessionId && room.pausedAt && !timeIsUp);
  const occupiedRunning = Boolean(isOccupied && sessionId && !room.pausedAt && canCountdown && !timeIsUp);

  const sessionEndBlocked =
    busy ||
    !sessionId ||
    (hydratingSession && !canCountdown) ||
    !canCountdown ||
    remainingSeconds === null;

  const occupiedLabel = (() => {
    if (!isOccupied) return "";
    if (!sessionId) return hydratingSession ? "Загрузка…" : "Сессия не найдена";
    if (busy) return "…";
    if (hydratingSession && !canCountdown) return "Загрузка…";
    if (occupiedShowComplete) return "Завершить";
    if (occupiedPaused && sessionCountdownLabel) return `Продолжить (${sessionCountdownLabel})`;
    if (occupiedRunning && sessionCountdownLabel) return `Пауза (${sessionCountdownLabel})`;
    if (canCountdown && sessionCountdownLabel) return `Пауза (${sessionCountdownLabel})`;
    return "Пауза";
  })();

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${dashboardRowFill}`}>
      <span className="text-sm font-medium text-white">{room.name}</span>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        {isWaiting && (
          <>
            <span className="text-sm text-text-secondary min-w-0 sm:max-w-[min(100%,22rem)]">
              {hallAwaitsHud ? "Лобби на экране: " : "Игроки в ожидании: "}
              <span className="text-white">{formatWaitingPlayersLine(waitingNames)}</span>
              {hallAwaitsHud ? (
                <span className="mt-0.5 block text-xs text-text-muted">
                  Режим и «НАЧАТЬ ИГРУ» — на моноблоке
                </span>
              ) : null}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hallAwaitsHud ? (
                <span
                  className="inline-flex min-h-[2.25rem] min-w-[6rem] items-center justify-center gap-1.5 rounded-full border border-surface-border px-3 py-1.5 text-sm font-medium text-text-secondary"
                  title="Старт только кнопкой на HUD комнаты"
                >
                  {waitingLabel}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy || !roomProp.pendingSessionToken}
                  onClick={() => void handlePrimarySessionAction()}
                  className="inline-flex min-h-[2.25rem] min-w-[6rem] items-center justify-center gap-1.5 rounded-full bg-cyan px-3 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Play className="h-4 w-4 shrink-0 fill-current" />
                  <span className="whitespace-nowrap">{waitingLabel}</span>
                </button>
              )}
            </div>
          </>
        )}
        {isFree && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onLaunch?.({ id: room.id, name: room.name })}
              className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-medium text-cyan transition-opacity hover:opacity-90 cursor-pointer"
            >
              <CirclePlus className="h-4 w-4 shrink-0" strokeWidth={2} />
              Запустить
            </button>
            <span className="text-sm font-medium text-success">Свободно</span>
          </div>
        )}
        {isOccupied && (
          <>
            <span className="text-sm text-text-secondary min-w-0 sm:max-w-[min(100%,22rem)]">
              Игроки:{" "}
              <span className="text-white">
                {inGameNames.length
                  ? formatWaitingPlayersLine(inGameNames)
                  : "Гости"}
              </span>
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!occupiedShowComplete ? (
                <button
                  type="button"
                  disabled={sessionEndBlocked}
                  onClick={() => void handleFinalizeSession()}
                  title="Полностью остановить комнату и завершить сессию (списание за сыгранное время)"
                  className="inline-flex min-h-[2.25rem] min-w-[6.5rem] items-center justify-center gap-1.5 rounded-full border border-danger/55 bg-transparent px-3 py-1.5 text-sm font-medium text-danger transition-opacity hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CircleStop className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">Стоп</span>
                </button>
              ) : null}
              <button
                type="button"
                disabled={
                  busy ||
                  !sessionId ||
                  (hydratingSession && !canCountdown)
                }
                onClick={() => void handlePrimarySessionAction()}
                className={`inline-flex min-h-[2.25rem] min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${
                  occupiedShowComplete
                    ? "bg-amber-500 text-black hover:opacity-90"
                    : occupiedPaused
                      ? "border border-surface-border text-white hover:bg-white/5"
                      : "bg-cyan text-black hover:opacity-90"
                }`}
              >
                {occupiedShowComplete ? (
                  <Square className="h-4 w-4 shrink-0 fill-current" />
                ) : null}
                {occupiedRunning ? <Pause className="h-4 w-4 shrink-0" /> : null}
                {occupiedPaused ? <Play className="h-4 w-4 shrink-0 fill-current" /> : null}
                <span className="whitespace-nowrap">{occupiedLabel}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function RoomControlList({
  venueId,
  launchRoomId,
  onLaunchHandled,
}: {
  venueId: string | null;
  /** Открыть запуск этой комнаты сразу (переход с главной «Запустить комнату») */
  launchRoomId?: string | null;
  onLaunchHandled?: () => void;
}) {
  const [rooms, setRooms] = useState<DashboardRoom[]>([]);
  const [live, setLive] = useState<Record<string, { offline: boolean; mode: string | null }>>({});
  const [loaded, setLoaded] = useState(false);
  const [launchRoom, setLaunchRoom] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(() => {
    statsService
      .getDashboard(venueId ?? undefined)
      .then((d: { rooms?: unknown[] }) => {
        setRooms((d?.rooms ?? []).map(normalizeDashboardRoom));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    api
      .get("/live", { params: { venueId: venueId || undefined } })
      .then(({ data }) => {
        const map: Record<string, { offline: boolean; mode: string | null }> = {};
        for (const r of Array.isArray(data) ? data : []) {
          map[String(r.roomId)] = { offline: Boolean(r.offline), mode: r.mode ? String(r.mode) : null };
        }
        setLive(map);
      })
      .catch(() => {});
  }, [venueId]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      refresh();
    }, 3000);
    const onVisibility = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!launchRoomId || !loaded) return;
    const room = rooms.find((r) => r.id === launchRoomId);
    if (room) setLaunchRoom({ id: room.id, name: room.name });
    onLaunchHandled?.();
  }, [launchRoomId, loaded, rooms, onLaunchHandled]);

  if (!loaded) return <p className="text-sm text-text-secondary">Загрузка комнат…</p>;

  return (
    <>
      <div className="flex flex-col gap-2">
        {rooms.length === 0 ? <p className="text-sm text-text-secondary">Комнат нет</p> : null}
        {rooms.map((room) => (
          <div key={room.id}>
            {live[room.id]?.offline ? (
              <p className="mb-1 flex items-center gap-1.5 text-xs text-danger">
                <WifiOff className="h-3.5 w-3.5" /> {room.name}: нет связи с комнатой
              </p>
            ) : live[room.id]?.mode && room.status === "occupied" ? (
              <p className="mb-1 text-xs text-text-secondary">
                {room.name}: режим «{live[room.id]?.mode}»
              </p>
            ) : null}
            <RoomStatusRow room={room} onLaunch={(r) => setLaunchRoom(r)} onSessionsChange={refresh} />
          </div>
        ))}
      </div>
      <LaunchRoomModal
        target={launchRoom}
        isOpen={launchRoom !== null}
        onClose={() => setLaunchRoom(null)}
        onSessionStarted={refresh}
      />
    </>
  );
}
