"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { sessionOutcomeLabel } from "@/lib/crm-labels";
import { almatyRange, almatyToday } from "@/lib/almaty";
import { readApiUserError } from "@/lib/api-error-message";

const REASONS = [
  { value: "GAME_FAILURE", label: "Сбой игры" },
  { value: "EQUIPMENT_FAILURE", label: "Сбой оборудования" },
  { value: "OTHER", label: "Другое" },
];

type JournalRow = {
  id: string;
  start: string | null;
  end: string | null;
  room: string;
  mode: string;
  outcome: string;
  playerMinutes: { userId: string; nickname: string; minutes: number }[];
  unplayedMinutes: number;
  compensations: { id: string; note: string }[];
  compensatedAt: string | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" });
}

export default function SessionsLogPage() {
  const { selectedVenueId } = useCrmVenue();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [rooms, setRooms] = useState<{ roomId: string; name: string }[]>([]);
  const [date, setDate] = useState(almatyToday());
  const [roomId, setRoomId] = useState("");
  const [onlyInterrupted, setOnlyInterrupted] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [comp, setComp] = useState<JournalRow | null>(null);

  // С главной «Компенсация» → /sessions-log?filter=interrupted
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("filter") === "interrupted") setOnlyInterrupted(true);
  }, []);

  const load = useCallback(() => {
    api
      .get("/sessions-journal", {
        params: { venueId: selectedVenueId || undefined, roomId: roomId || undefined, ...almatyRange(date, date) },
      })
      .then(({ data }) => setRows(data.data ?? []))
      .catch((e) => {
        setRows([]);
        setError(readApiUserError(e, "Журнал не загрузился"));
      });
  }, [selectedVenueId, roomId, date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get("/live", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setRooms(Array.isArray(data) ? data.map((r: any) => ({ roomId: r.roomId, name: r.name })) : []))
      .catch(() => setRooms([]));
  }, [selectedVenueId]);

  async function download() {
    const { data } = await api.get("/sessions-journal/export", {
      params: { venueId: selectedVenueId || undefined },
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oyna-sessions.xls";
    link.click();
    URL.revokeObjectURL(url);
  }

  const visible = onlyInterrupted ? rows.filter((r) => r.outcome === "INTERRUPTED") : rows;

  return (
    <div className="space-y-3 text-text-primary">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Сеансы</h1>
        <button type="button" onClick={download} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">
          Скачать Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="date"
          value={date}
          disabled={!isAdmin}
          onChange={(e) => setDate(e.target.value || almatyToday())}
          title={isAdmin ? undefined : "Сотрудник видит сеансы за сегодня"}
          className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm disabled:opacity-60"
        />
        <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm">
          <option value="">Все комнаты</option>
          {rooms.map((r) => (
            <option key={r.roomId} value={r.roomId}>
              {r.name}
            </option>
          ))}
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl bg-bg-secondary px-3 text-sm">
          <input type="checkbox" checked={onlyInterrupted} onChange={(e) => setOnlyInterrupted(e.target.checked)} className="h-4 w-4" />
          Только прерванные
        </label>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
      {visible.length === 0 ? (
        <p className="text-sm text-text-secondary">{onlyInterrupted ? "Прерванных сеансов нет" : "Сеансов нет"}</p>
      ) : null}

      {visible.map((row) => {
        const canCompensate = row.playerMinutes.length > 0 && (isAdmin || row.compensations.length === 0) && !(row.compensatedAt && !isAdmin);
        return (
          <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">
                {row.room} · {row.mode}
              </p>
              <span
                className={`text-xs ${
                  row.outcome === "INTERRUPTED" ? "text-amber-300" : row.outcome === "COMPENSATED" ? "text-cyan" : "text-text-secondary"
                }`}
              >
                {sessionOutcomeLabel(row.outcome)}
              </span>
            </div>
            <p className="text-text-secondary">
              {row.start ? fmtTime(row.start) : "—"}
              {row.end ? ` – ${fmtTime(row.end)}` : ""}
            </p>
            <p>
              {row.playerMinutes.length
                ? row.playerMinutes.map((p) => `${p.nickname} ${p.minutes}`).join(", ")
                : "Гость"}
            </p>
            {row.compensations.map((c) => (
              <p key={c.id} className="text-cyan">
                {c.note}
              </p>
            ))}
            {canCompensate ? (
              <button type="button" onClick={() => setComp(row)} className="mt-2 min-h-11 rounded-xl bg-bg-card px-3">
                {row.compensations.length ? "Компенсировать ещё раз" : "Компенсировать"}
              </button>
            ) : null}
          </article>
        );
      })}

      {comp ? (
        <CompensateModal
          row={comp}
          onClose={() => setComp(null)}
          onDone={(note) => {
            setComp(null);
            setOk(note);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function CompensateModal({ row, onClose, onDone }: { row: JournalRow; onClose: () => void; onDone: (note: string) => void }) {
  const [selected, setSelected] = useState<string[]>(row.playerMinutes.map((p) => p.userId));
  const [minutes, setMinutes] = useState(String(row.unplayedMinutes || 10));
  const [reason, setReason] = useState("GAME_FAILURE");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    setError("");
    const n = Number(minutes);
    if (!selected.length) return setError("Отметьте хотя бы одного игрока");
    if (!Number.isInteger(n) || n < 10 || n % 10 !== 0) return setError("Минуты — кратно 10");
    if (reason === "OTHER" && !comment.trim()) return setError("Для «Другое» напишите комментарий");
    setBusy(true);
    try {
      const { data } = await api.post(`/sessions/${row.id}/compensate`, {
        userIds: selected,
        minutes: n,
        reason,
        comment: comment.trim() || undefined,
      });
      onDone(data.note);
    } catch (e) {
      setError(readApiUserError(e, "Компенсация не начислена"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Компенсация · {row.room}</h3>
        <p className="mt-1 text-sm text-text-secondary">Минуты начислятся как бонусные</p>

        <p className="mt-4 text-sm font-medium">Игроки</p>
        <div className="mt-2 space-y-1">
          {row.playerMinutes.map((p) => (
            <label key={p.userId} className="flex min-h-11 items-center gap-3 rounded-xl bg-bg-card px-3 text-sm">
              <input type="checkbox" checked={selected.includes(p.userId)} onChange={() => toggle(p.userId)} className="h-5 w-5" />
              {p.nickname}
              <span className="ml-auto text-xs text-text-secondary">списано {p.minutes} мин</span>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-sm">
          Минут каждому (недоиграно ≈ {row.unplayedMinutes})
          <input
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))}
            className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3 text-base"
          />
        </label>

        <p className="mt-4 text-sm font-medium">Причина</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`min-h-11 rounded-xl px-3 text-sm ${reason === r.value ? "bg-cyan text-black" : "bg-bg-card"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={reason === "OTHER" ? "Комментарий (обязательно)" : "Комментарий"}
          className="mt-2 h-12 w-full rounded-xl bg-bg-card px-3"
        />

        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        <div className="mt-5 flex gap-2">
          <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={onClose}>
            Назад
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-12 flex-1 rounded-xl bg-cyan font-semibold text-black disabled:opacity-50"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
