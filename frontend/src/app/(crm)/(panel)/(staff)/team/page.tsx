"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { readApiUserError } from "@/lib/api-error-message";
import { almatyToday } from "@/lib/almaty";

type TodayRow = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  arrivedAt: string | null;
  leftAt: string | null;
  lateMinutes: number;
  notArrived: boolean;
  note: string | null;
};

function hhmm(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { timeZone: "Asia/Almaty", hour: "2-digit", minute: "2-digit" });
}

/** ISO → «HH:MM» по Алматы для поля time */
function toTimeInput(iso: string | null) {
  return iso ? hhmm(iso) : "";
}

export default function TeamTodayPage() {
  const { selectedVenueId } = useCrmVenue();
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const [rows, setRows] = useState<TodayRow[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [edit, setEdit] = useState<TodayRow | null>(null);

  const load = useCallback(() => {
    if (!selectedVenueId) return;
    api
      .get("/team/today", { params: { venueId: selectedVenueId } })
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e) => setError(readApiUserError(e, "Не удалось загрузить смену")));
  }, [selectedVenueId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Смена сегодня</h1>
      <p className="text-sm text-text-secondary">
        «Пришёл» — открытие кассовой смены или первый вход в CRM. «Ушёл» — закрытие смены.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
      {rows.length === 0 && !error ? <p className="text-sm text-text-secondary">Сегодня по графику никого нет</p> : null}

      <div className="space-y-2">
        {rows.map((r) => (
          <article key={r.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{r.name}</p>
              <p className="text-text-secondary">
                по графику {hhmm(r.startsAt)}–{hhmm(r.endsAt)}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span className={r.lateMinutes ? "font-semibold text-red-400" : r.notArrived ? "text-amber-300" : ""}>
                Пришёл: {r.arrivedAt ? hhmm(r.arrivedAt) : r.notArrived ? "ещё нет" : "—"}
                {r.lateMinutes ? ` · опоздание ${r.lateMinutes} мин` : ""}
              </span>
              <span>Ушёл: {hhmm(r.leftAt)}</span>
            </div>
            {r.note ? <p className="mt-1 text-xs text-text-muted">Поправка: {r.note}</p> : null}
            {isAdmin ? (
              <button type="button" onClick={() => setEdit(r)} className="mt-2 min-h-10 rounded-lg bg-bg-card px-3 text-sm">
                Поправить время
              </button>
            ) : null}
          </article>
        ))}
      </div>

      {edit ? (
        <EditTimes
          row={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            setOk("Время исправлено, запись в журнале");
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function EditTimes({ row, onClose, onSaved }: { row: TodayRow; onClose: () => void; onSaved: () => void }) {
  const day = row.startsAt ? new Date(new Date(row.startsAt).getTime() + 5 * 3600000).toISOString().slice(0, 10) : almatyToday();
  const [arrived, setArrived] = useState(toTimeInput(row.arrivedAt));
  const [left, setLeft] = useState(toTimeInput(row.leftAt));
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!comment.trim()) return setError("Напишите, почему меняется время");
    setBusy(true);
    setError("");
    try {
      await api.patch(`/team/schedule/${row.id}/times`, {
        arrivedAt: arrived ? `${day}T${arrived}` : null,
        leftAt: left ? `${day}T${left}` : null,
        comment: comment.trim(),
      });
      onSaved();
    } catch (e) {
      setError(readApiUserError(e, "Не сохранилось"));
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
      <div className="w-full max-w-sm rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h3 className="text-lg font-semibold">{row.name}</h3>
        <p className="text-sm text-text-secondary">
          по графику {hhmm(row.startsAt)}–{hhmm(row.endsAt)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="text-sm">
            Пришёл
            <input type="time" value={arrived} onChange={(e) => setArrived(e.target.value)} className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3" />
          </label>
          <label className="text-sm">
            Ушёл
            <input type="time" value={left} onChange={(e) => setLeft(e.target.value)} className="mt-1 h-12 w-full rounded-xl bg-bg-card px-3" />
          </label>
        </div>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий (обязательно)"
          className="mt-3 h-12 w-full rounded-xl bg-bg-card px-3"
        />
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="min-h-12 flex-1 rounded-xl bg-bg-card" onClick={onClose}>
            Назад
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="min-h-12 flex-1 rounded-xl bg-cyan font-semibold text-black disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
