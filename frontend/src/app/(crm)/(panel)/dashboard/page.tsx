"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { statsService } from "@/services/stats.service";
import { gameSessionsService } from "@/services/game-sessions.service";
import {
  ChevronRight,
  CirclePlus,
  CircleStop,
  Pause,
  Play,
  Plus,
  Square,
  UserRound,
} from "lucide-react";
import { Paper } from "@mui/material";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { AddPlayerModal } from "@/components/crm/AddPlayerModal";
import { LaunchRoomModal } from "@/components/crm/LaunchRoomModal";
import { PlayerProfileModal } from "@/components/crm/PlayerProfileModal";
import { readApiUserError } from "@/lib/api-error-message";
import { playersService } from "@/services/players.service";
import { useCrmVenue } from "@/lib/venue-context";

const CHART_COLORS = ["#36D399", "#7AA2FF", "#A78BFA", "#F59E0B", "#FB7185"];
const dashboardContainerFill = "#19232E";

type DashboardRoom = {
  id: string;
  name: string;
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

type DashboardData = {
  sessionsByRoom: { name: string; count: number; roomId: string }[];
  rooms: DashboardRoom[];
  totalSessions: number;
  totalPlayers: number;
  newPlayers: number;
};

const today = new Date();
const dateStr = today.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export default function DashboardPage() {
  const { selectedVenueId } = useCrmVenue();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profilePlayerId, setProfilePlayerId] = useState<string | null>(null);
  const [profileInitialTopUpOpen, setProfileInitialTopUpOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [launchRoom, setLaunchRoom] = useState<{ id: string; name: string } | null>(null);

  const openPlayerProfile = useCallback((id: string, options?: { withTopUp?: boolean }) => {
    setProfilePlayerId(id);
    setProfileInitialTopUpOpen(!!options?.withTopUp);
    setProfileOpen(true);
  }, []);

  const closePlayerProfile = useCallback(() => {
    setProfileOpen(false);
    setProfilePlayerId(null);
    setProfileInitialTopUpOpen(false);
  }, []);

  const refreshDashboard = useCallback(() => {
    statsService.getDashboard(selectedVenueId ?? undefined).then(setData).catch(() => {});
  }, [selectedVenueId]);

  useEffect(() => {
    statsService
      .getDashboard(selectedVenueId ?? undefined)
      .then(setData)
      .catch((err) => setError(readApiUserError(err, "Ошибка загрузки данных")))
      .finally(() => setLoading(false));
  }, [selectedVenueId]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">За сегодня</h1>
          <p className="text-text-secondary mt-1 text-sm">{dateStr}</p>
        </div>
        <div className="rounded-xl p-6" style={{ backgroundColor: dashboardContainerFill }}>
          <p className="text-danger font-medium">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              statsService
                .getDashboard(selectedVenueId ?? undefined)
                .then(setData)
                .catch((err) => setError(readApiUserError(err, "Ошибка загрузки данных")))
                .finally(() => setLoading(false));
            }}
            className="mt-3 text-sm text-cyan hover:underline"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  const sessionsByRoom = (data?.sessionsByRoom ?? []).map((r, i) => ({
    ...r,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));
  const totalChart = sessionsByRoom.reduce((s, r) => s + r.count, 0);
  const totalSessionsCount = data?.totalSessions ?? 0;
  const hasSessionStats = totalSessionsCount > 0 || totalChart > 0;
  const rooms = (data?.rooms ?? []).map(normalizeDashboardRoom);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">За сегодня</h1>
        <p className="text-text-secondary mt-1 text-sm">{dateStr}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6 w-full min-w-0">
          <Paper className="w-full min-w-0 rounded-2xl p-5 h-fit" sx={{ backgroundColor: dashboardContainerFill }}>
            <h2 className="text-sm font-medium text-text-secondary mb-4">Количество сессий</h2>
            {hasSessionStats ? (
              <div className="flex flex-wrap items-center gap-5">
                <span className="text-5xl font-black text-white tabular-nums shrink-0">{totalSessionsCount}</span>
                <DonutChart data={sessionsByRoom} total={totalChart} size={80} />
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 min-w-0">
                  {sessionsByRoom.map((r) => (
                    <div
                      key={r.roomId ?? r.name}
                      className="flex items-center gap-1.5 text-xs text-[#D5E6F7] whitespace-nowrap"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                      <span>
                        {r.name}: <b>{r.count}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-5 sm:gap-6">
                <span className="shrink-0 text-5xl font-black tabular-nums text-white">0</span>
                <DonutChart data={[]} total={0} size={80} />
                <div className="min-w-0">
                  <p className="text-base font-semibold leading-snug text-white">Сегодня сессий нет.</p>
                  <p className="mt-1 text-sm leading-snug text-text-secondary">Они появятся здесь по каждой комнате</p>
                </div>
              </div>
            )}
          </Paper>

          <Paper className="w-full min-w-0 rounded-2xl p-6 h-fit" sx={{ backgroundColor: dashboardContainerFill }}>
            <h2 className="text-sm font-medium text-white mb-4">Статусы комнат в данный момент</h2>
            <div className="flex flex-col gap-2">
              {rooms.map((room) => (
                <RoomStatusRow
                  key={room.id}
                  room={room}
                  onLaunch={(r) => setLaunchRoom(r)}
                  onSessionsChange={refreshDashboard}
                />
              ))}
            </div>
          </Paper>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-6 w-full min-w-0">
            <Paper className="min-w-0 flex-1 basis-[140px] max-lg:flex-none max-lg:w-full rounded-2xl p-4 flex flex-row items-center gap-3" sx={{ backgroundColor: dashboardContainerFill }}>
              <UserRound className="w-5 h-5 text-[#AFC7DA] shrink-0" strokeWidth={1.75} />
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-xs text-[#AFC7DA] leading-tight">Посетившие игроки</span>
                <span className="text-3xl font-bold text-white tabular-nums leading-none">
                  {data?.totalPlayers ?? 0}
                </span>
              </div>
            </Paper>

            <Paper className="min-w-0 flex-1 basis-[140px] max-lg:flex-none max-lg:w-full rounded-2xl p-4 flex flex-row items-center gap-3" sx={{ backgroundColor: dashboardContainerFill }}>
              <UserRound className="w-5 h-5 text-[#AFC7DA] shrink-0" strokeWidth={1.75} />
              <div className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-xs text-[#AFC7DA] leading-tight">Новые игроки</span>
                <span className="text-3xl font-bold text-white tabular-nums leading-none">
                  +{data?.newPlayers ?? 0}
                </span>
              </div>
            </Paper>

            <Link
              href="/players"
              className="shrink-0 flex h-12 items-center gap-3 pl-1 max-lg:h-auto max-lg:min-h-12 max-lg:w-full max-lg:justify-start text-cyan hover:opacity-90 transition-opacity"
            >
              <span className="text-sm font-medium whitespace-nowrap">К таблице игроков</span>
              <span className="flex items-center justify-center w-11 h-11 rounded-full shrink-0" style={{ backgroundColor: dashboardContainerFill }}>
                <ChevronRight className="w-5 h-5 text-[#EAF6FF]" strokeWidth={2} />
              </span>
            </Link>
          </div>

          <Paper className="w-full min-w-0 rounded-2xl p-6 h-fit" sx={{ backgroundColor: dashboardContainerFill }}>
            <h2 className="text-sm font-medium text-white mb-4">Быстрое добавление в справочник</h2>
            <div className="flex flex-col gap-2">
              <QuickActionCard title="Добавить нового игрока" onClick={() => setAddPlayerOpen(true)} />
              <QuickActionCard title="Пополнить минуты" onClick={() => setTopUpOpen(true)} />
              <QuickActionCard title="Создать команду" onClick={() => setCreateTeamOpen(true)} />
            </div>
          </Paper>
        </div>
      </div>
      <AddPlayerModal
        isOpen={addPlayerOpen}
        onClose={() => setAddPlayerOpen(false)}
        onAdded={(id) => {
          openPlayerProfile(id);
          refreshDashboard();
        }}
      />
      <PlayerProfileModal
        playerId={profilePlayerId}
        isOpen={profileOpen}
        onClose={closePlayerProfile}
        initialTopUpOpen={profileInitialTopUpOpen}
      />
      <QuickTopUpModal
        isOpen={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        onSelectPlayer={(id) => {
          setTopUpOpen(false);
          openPlayerProfile(id, { withTopUp: true });
        }}
      />
      <QuickCreateTeamModal isOpen={createTeamOpen} onClose={() => setCreateTeamOpen(false)} />
      <LaunchRoomModal
        target={launchRoom}
        isOpen={launchRoom !== null}
        onClose={() => setLaunchRoom(null)}
        onSessionStarted={refreshDashboard}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-32 bg-bg-card rounded" />
        <div className="h-4 w-48 mt-2 bg-bg-card rounded" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6 w-full min-w-0">
          <div className="w-full min-w-0 rounded-xl p-5 h-fit" style={{ backgroundColor: dashboardContainerFill }}>
            <div className="h-5 w-40 mb-4 bg-bg-card rounded" />
            <div className="flex flex-wrap items-center gap-5">
              <div className="h-14 w-20 bg-bg-card rounded" />
              <div className="w-[80px] h-[80px] rounded-full bg-bg-card shrink-0" />
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-3 w-28 bg-bg-card rounded" />
                ))}
              </div>
            </div>
          </div>
          <div className="w-full min-w-0 rounded-xl p-6 h-fit" style={{ backgroundColor: dashboardContainerFill }}>
            <div className="h-5 w-64 mb-4 bg-bg-card rounded" />
            <div className="flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-bg-card" />
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 flex flex-col gap-6 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-6 w-full min-w-0">
            <div className="min-w-0 flex-1 basis-[140px] max-lg:flex-none max-lg:w-full rounded-xl p-4 flex flex-row items-center gap-3" style={{ backgroundColor: dashboardContainerFill }}>
              <div className="w-5 h-5 rounded bg-bg-card shrink-0" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="h-3 w-28 bg-bg-card rounded" />
                <div className="h-8 w-14 bg-bg-card rounded" />
              </div>
            </div>
            <div className="min-w-0 flex-1 basis-[140px] max-lg:flex-none max-lg:w-full rounded-xl p-4 flex flex-row items-center gap-3" style={{ backgroundColor: dashboardContainerFill }}>
              <div className="w-5 h-5 rounded bg-bg-card shrink-0" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="h-3 w-24 bg-bg-card rounded" />
                <div className="h-8 w-12 bg-bg-card rounded" />
              </div>
            </div>
            <div className="shrink-0 flex h-12 items-center gap-3 pl-1 max-lg:h-auto max-lg:min-h-12 max-lg:w-full">
              <div className="h-4 w-32 bg-bg-card rounded" />
              <div className="w-11 h-11 rounded-full bg-bg-card shrink-0" />
            </div>
          </div>
          <div className="w-full min-w-0 rounded-xl p-6 h-fit" style={{ backgroundColor: dashboardContainerFill }}>
            <div className="h-5 w-64 mb-4 bg-bg-card rounded" />
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-bg-card" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CIRCLE_LENGTH = 2 * Math.PI * 40;

function DonutChart({
  data,
  total,
  size = 80,
}: {
  data: { name: string; count: number; color: string }[];
  total: number;
  size?: number;
}) {
  let offset = 0;
  const segments = data.map((d) => {
    const pct = total ? (d.count / total) * 100 : 0;
    const segment = { ...d, pct, offset };
    offset += pct;
    return segment;
  });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#2A3A4B" strokeWidth="16" />
      {segments.map((seg, i) => {
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
      })}
      <circle cx="50" cy="50" r="28" fill={dashboardContainerFill} />
    </svg>
  );
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

function QuickActionCard({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <div className={`flex items-center justify-between ${dashboardRowFill}`}>
      <div className="flex items-center gap-3">
        <UserRound className="w-4 h-4 text-[#AFC7DA] shrink-0" strokeWidth={1.75} />
        <span className="text-sm text-white">{title}</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-cyan hover:opacity-90 transition-opacity bg-transparent p-0 border-0 cursor-pointer"
      >
        <Plus className="w-4 h-4 shrink-0" strokeWidth={2} />
        Открыть форму
      </button>
    </div>
  );
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

  /** Завершить активную сессию: списание за фактическое время (как «Завершить» по таймеру, так и «Стоп» вручную). */
  const handleFinalizeSession = async () => {
    if (!sessionId || busy) return;
    if (!canCountdown || room.levelDurationSeconds == null || remainingSeconds == null) return;
    if (playerUserIdsForEnd.length < 1) return;

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
      if (!roomProp.pendingSessionToken) return;
      setBusy(true);
      try {
        await gameSessionsService.activateByToken(roomProp.pendingSessionToken);
        onSessionsChange?.();
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

  const waitingLabel = busy ? "Запуск…" : "Начать";

  const occupiedShowComplete = Boolean(isOccupied && sessionId && canCountdown && timeIsUp);
  const occupiedPaused = Boolean(isOccupied && sessionId && room.pausedAt && !timeIsUp);
  const occupiedRunning = Boolean(isOccupied && sessionId && !room.pausedAt && canCountdown && !timeIsUp);

  const sessionEndBlocked =
    busy ||
    !sessionId ||
    (hydratingSession && !canCountdown) ||
    playerUserIdsForEnd.length < 1 ||
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
              Игроки в ожидании:{" "}
              <span className="text-white">{formatWaitingPlayersLine(waitingNames)}</span>
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy || !roomProp.pendingSessionToken}
                onClick={() => void handlePrimarySessionAction()}
                className="inline-flex min-h-[2.25rem] min-w-[6rem] items-center justify-center gap-1.5 rounded-full bg-cyan px-3 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play className="h-4 w-4 shrink-0 fill-current" />
                <span className="whitespace-nowrap">{waitingLabel}</span>
              </button>
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
              Игроки: <span className="text-white">{formatWaitingPlayersLine(inGameNames)}</span>
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
                  (hydratingSession && !canCountdown) ||
                  (occupiedShowComplete && playerUserIdsForEnd.length < 1)
                }
                onClick={() => void handlePrimarySessionAction()}
                title={
                  occupiedShowComplete && playerUserIdsForEnd.length < 1
                    ? "Нет списка игроков для завершения — обновите страницу"
                    : undefined
                }
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

type QuickTopUpPick = { id: string; nickname: string; phone: string };

function formatPhoneShort(phone: string) {
  const d = String(phone || "").replace(/\D/g, "").slice(-10);
  if (d.length < 10) return String(phone || "").trim() || "—";
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6)}`;
}

function QuickTopUpModal({
  isOpen,
  onClose,
  onSelectPlayer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlayer: (playerId: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<QuickTopUpPick[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPlayerSearch("");
    setSearchResults([]);
    setSearchLoading(false);
  }, [isOpen]);

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
          const rows: QuickTopUpPick[] = raw
            .map((p) => {
              const o = p as Record<string, unknown>;
              const id = o.id != null ? String(o.id) : "";
              const nickname = o.nickname != null ? String(o.nickname) : "";
              const phone = o.phone != null ? String(o.phone) : "";
              return { id, nickname, phone };
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

  if (!mounted || !isOpen) return null;

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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6" style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
          <div className="my-auto mx-auto flex w-full max-w-md flex-col gap-6 pb-10 pt-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border text-white hover:bg-white/5">
                <BackIcon />
              </button>
              <h2 className="text-lg font-semibold text-white">Пополнить минуты</h2>
            </div>
            <div className="flex flex-col gap-2">
              <Input
                label="Никнейм или телефон"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                autoComplete="off"
              />
              {playerSearch.trim().length > 0 && playerSearch.trim().length < 2 ? (
                <p className="text-xs text-text-secondary">Введите не меньше 2 символов</p>
              ) : null}
              {searchLoading ? <p className="text-xs text-text-secondary">Поиск…</p> : null}
              {!searchLoading && playerSearch.trim().length >= 2 && searchResults.length === 0 ? (
                <p className="text-xs text-text-secondary">Никого не найдено</p>
              ) : null}
              {searchResults.length > 0 ? (
                <ul className="max-h-[min(50vh,20rem)] overflow-y-auto rounded-xl border border-surface-border/40 bg-[#1F2B38] py-1">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelectPlayer(p.id)}
                        className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                      >
                        <span className="text-sm font-medium text-white">{p.nickname}</span>
                        <span className="text-xs text-text-secondary">{formatPhoneShort(p.phone)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuickCreateTeamModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTeamName("");
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6" style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}>
          <div className="my-auto mx-auto flex w-full max-w-md flex-col gap-6 pb-10 pt-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-surface-border text-white hover:bg-white/5">
                <BackIcon />
              </button>
              <h2 className="text-lg font-semibold text-white">Создать команду</h2>
            </div>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                onClose();
              }}
            >
              <Input label="Название команды" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              <Button type="submit" className="mt-2 inline-flex w-fit items-center justify-center gap-2">
                Сохранить
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
