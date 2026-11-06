"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { readApiUserError } from "@/lib/api-error-message";
import { formatTenge } from "@/lib/money";

type Participant = {
  id: string;
  userId: string | null;
  isGuest: boolean;
  role: "BIRTHDAY_PERSON" | "ORGANIZER" | "PLAYER";
  displayName: string | null;
  creditedAt: string | null;
};

type Booking = {
  id: string;
  type: "BIRTHDAY" | "TEAMBUILDING";
  people: number;
  packageMinutes: number;
  amountTenge: number;
  paidTenge?: number;
  participants?: Participant[];
};

const ROLE_LABEL: Record<Participant["role"], string> = {
  BIRTHDAY_PERSON: "Именинник",
  ORGANIZER: "Организатор",
  PLAYER: "Игрок",
};

/** День праздника: именинник или организатор, игроки и гости, «Пополнить всем», «Принять доплату». */
export function BookingDayPanel({ booking, onChanged }: { booking: Booking; onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; nickname: string; phone?: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const participants = booking.participants ?? [];
  const leadRole: Participant["role"] = booking.type === "BIRTHDAY" ? "BIRTHDAY_PERSON" : "ORGANIZER";
  const hasLead = participants.some((p) => p.role === leadRole);
  const remaining = Math.max(0, booking.amountTenge - (booking.paidTenge ?? 0));
  const toCredit = participants.filter((p) => p.userId && !p.isGuest && !p.creditedAt).length;

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      api
        .get("/users/search", { params: { q: query, limit: 6 } })
        .then(({ data }) => {
          const rows = Array.isArray(data?.data) ? data.data : [];
          setHits(rows.map((u: any) => ({ id: String(u.id), nickname: String(u.nickname), phone: u.phone })));
        })
        .catch(() => setHits([]));
    }, 280);
    return () => window.clearTimeout(t);
  }, [q]);

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError("");
    setOk("");
    try {
      await fn();
      if (done) setOk(done);
      onChanged();
    } catch (e) {
      setError(readApiUserError(e, "Не получилось"));
    } finally {
      setBusy(false);
    }
  }

  function addPlayer(hit: { id: string; nickname: string }, role: Participant["role"]) {
    setQ("");
    setHits([]);
    void run(() => api.post(`/bookings/${booking.id}/participants`, { userId: hit.id, role, displayName: hit.nickname }));
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-text-muted">День праздника</p>

      <ul className="space-y-1">
        {participants.length === 0 ? <li className="text-text-secondary">Участников пока нет</li> : null}
        {participants.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2">
            <span>
              {p.displayName || (p.isGuest ? "Гость" : "Игрок")}{" "}
              <span className="text-xs text-text-secondary">
                · {p.isGuest ? "гость, без минут" : ROLE_LABEL[p.role]}
                {p.creditedAt ? " · минуты начислены" : ""}
              </span>
            </span>
            {!p.creditedAt ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.post(`/bookings/${booking.id}/participants/${p.id}/remove`))}
                className="text-xs text-text-secondary hover:text-text-primary"
              >
                убрать
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-secondary">
        В списке {participants.length} из {booking.people} по брони
      </p>

      <div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Добавить игрока: ник или телефон"
          className="h-11 w-full rounded-xl bg-bg-secondary px-3 text-sm"
        />
        {hits.length ? (
          <ul className="mt-1 overflow-hidden rounded-xl border border-white/10">
            {hits.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 bg-bg-secondary px-3 py-2">
                <span>
                  {h.nickname}
                  {h.phone ? <span className="text-xs text-text-secondary"> · {h.phone}</span> : null}
                </span>
                <span className="flex gap-2">
                  {!hasLead ? (
                    <button type="button" disabled={busy} onClick={() => addPlayer(h, leadRole)} className="min-h-9 rounded-lg bg-cyan/20 px-2 text-xs text-cyan">
                      {ROLE_LABEL[leadRole]}
                    </button>
                  ) : null}
                  <button type="button" disabled={busy} onClick={() => addPlayer(h, "PLAYER")} className="min-h-9 rounded-lg bg-bg-card px-2 text-xs">
                    Игрок
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.post(`/bookings/${booking.id}/participants`, { isGuest: true, role: "PLAYER" }))}
          className="min-h-10 rounded-lg bg-bg-secondary px-3 text-sm"
        >
          + Гость
        </button>
        <button
          type="button"
          disabled={busy || toCredit === 0}
          onClick={() =>
            void run(
              () => api.post(`/bookings/${booking.id}/credit`),
              `Начислено по ${booking.packageMinutes} мин: ${toCredit} игрок(ам)`,
            )
          }
          className="min-h-10 rounded-lg bg-cyan px-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          Пополнить всем{toCredit ? ` (${toCredit})` : ""}
        </button>
        {remaining > 0 ? (
          <Link href={`/cash?booking=${booking.id}`} className="inline-flex min-h-10 items-center rounded-lg bg-bg-secondary px-3 text-sm">
            Принять доплату {formatTenge(remaining)}
          </Link>
        ) : null}
      </div>
      {remaining > 0 ? (
        <p className="text-xs text-amber-300">Минуты начисляются после полной оплаты брони</p>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}
    </div>
  );
}
