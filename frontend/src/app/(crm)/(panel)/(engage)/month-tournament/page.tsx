"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { readApiUserError } from "@/lib/api-error-message";
import { almatyToday } from "@/lib/almaty";

const ROOMS = [
  { id: "all", label: "Общий зачёт" },
  { id: "megagrid", label: "Mega Grid" },
  { id: "arena", label: "Arena" },
  { id: "hide", label: "Hide" },
  { id: "lasers", label: "Lasers" },
];

/** Правила турнира — изменения от 01.11 (ничья и дисквалификация). */
const RULES = [
  {
    title: "Ничья",
    items: [
      "2 участника — Arena.",
      "3–4 участника — Mega Grid.",
      "5 и больше — забеги в Mega Grid по 2–4 человека; победители забегов играют финал.",
    ],
  },
  {
    title: "Дисквалификация",
    items: [
      "Несколько аккаунтов у одного человека запрещены. Один человек — один аккаунт.",
      "Аккаунты детей на номере родителя разрешены, если каждым играет свой ребёнок.",
    ],
  },
];

type Board = {
  label: string;
  showingPrevious: boolean;
  totalPlayers: number;
  items: { place: number; nick: string; status: string; points: number; userId: string }[];
};

function daysLeft(month: string, today: string) {
  if (month !== today.slice(0, 7)) return null;
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return last - Number(today.slice(8)) + 1;
}

export default function MonthTournamentPage() {
  const { selectedVenueId } = useCrmVenue();
  const today = almatyToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [room, setRoom] = useState("all");
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/rating", { params: { period: "month", month, room, venueId: selectedVenueId || undefined, limit: 50 } })
      .then(({ data }) => {
        setBoard(data);
        setError("");
      })
      .catch((e) => {
        setBoard(null);
        setError(readApiUserError(e, "Таблица не загрузилась"));
      });
  }, [month, room, selectedVenueId]);

  const left = daysLeft(month, today);

  return (
    <div className="space-y-4 text-text-primary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Турнир месяца</h1>
        <input
          type="month"
          value={month}
          max={today.slice(0, 7)}
          onChange={(e) => setMonth(e.target.value || today.slice(0, 7))}
          className="min-h-11 rounded-xl bg-bg-secondary px-3 text-sm"
        />
      </div>
      <p className="text-sm text-text-secondary">
        {board?.label ?? ""}
        {left != null ? ` · до конца месяца ${left} дн.` : " · итоги"}
        {board ? ` · участников ${board.totalPlayers}` : ""}
      </p>

      <div className="flex flex-wrap gap-2">
        {ROOMS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoom(r.id)}
            className={`min-h-11 rounded-xl px-3 text-sm ${room === r.id ? "bg-cyan text-black" : "bg-bg-secondary"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl bg-bg-secondary">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="p-3">Место</th>
              <th className="p-3">Ник</th>
              <th className="p-3">Статус</th>
              <th className="p-3 text-right">Очки</th>
            </tr>
          </thead>
          <tbody>
            {board?.items.map((row) => (
              <tr key={row.userId} className={`border-t border-white/10 ${row.place <= 3 ? "font-semibold" : ""}`}>
                <td className="p-3 tabular-nums">{row.place <= 3 ? ["🥇", "🥈", "🥉"][row.place - 1] : row.place}</td>
                <td className="p-3">{row.nick}</td>
                <td className="p-3 text-text-secondary">{row.status}</td>
                <td className="p-3 text-right tabular-nums">{row.points.toLocaleString("ru-RU")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {board && board.items.length === 0 ? <p className="p-3 text-sm text-text-secondary">В этом месяце ещё нет очков</p> : null}
      </div>

      <section className="rounded-xl bg-bg-secondary p-4">
        <h2 className="mb-2 text-base font-semibold">Правила турнира (обновлены 01.11)</h2>
        {RULES.map((block) => (
          <div key={block.title} className="mb-2">
            <p className="text-sm font-medium">{block.title}</p>
            <ul className="list-disc pl-5 text-sm text-text-secondary">
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-text-muted">Полный текст KZ/RU — на странице турнира для игроков.</p>
      </section>
    </div>
  );
}
