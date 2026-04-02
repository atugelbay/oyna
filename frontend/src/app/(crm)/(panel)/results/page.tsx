"use client";

import { useState, useEffect } from "react";
import { Avatar } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { resultsService } from "@/services/results.service";
import { useCrmVenue } from "@/lib/venue-context";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  nickname: string | null;
  score: number;
};

export default function ResultsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [tab, setTab] = useState<"players" | "teams">("players");
  const [search, setSearch] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);
      try {
        const data = await resultsService.getLeaderboard({
          venueId: selectedVenueId ?? undefined,
        });
        if (!cancelled) setLeaderboard(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiUserError(err, "Не удалось загрузить результаты"));
          setLeaderboard([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLeaderboard();
    return () => { cancelled = true; };
  }, [selectedVenueId]);

  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.filter(Boolean);
  const restList = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Результаты игроков</h1>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("players")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "players" ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            Игроки
          </button>
          <button
            type="button"
            onClick={() => setTab("teams")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "teams" ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            Команды
          </button>
        </div>
        <div className="relative w-64">
          <input
            type="text"
            placeholder="Никнейм или номер телефона игрока"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-4 pr-10 bg-bg-secondary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-cyan"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
            <SearchIcon />
          </span>
        </div>
      </div>

      {tab === "players" && (
        <>
          {loading && (
            <div className="rounded-xl bg-bg-secondary overflow-hidden py-12 text-center text-text-muted">
              Загрузка...
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-bg-secondary overflow-hidden py-12 text-center text-danger">
              {error}
            </div>
          )}
          {!loading && !error && (
            <>
          {/* Top 3 cards — подиум: 2, 1, 3 */}
          <div className="grid grid-cols-3 gap-4 max-w-4xl">
            {podiumOrder.map((p) => (
              <div
                key={p.rank}
                className={`rounded-xl p-6 flex flex-col items-center gap-3 ${
                  p.rank === 1
                    ? "bg-amber-500/10 border border-amber-500/30 order-2"
                    : p.rank === 2
                    ? "bg-bg-secondary order-1"
                    : "bg-amber-700/10 border border-amber-700/30 order-3"
                }`}
              >
                <Avatar letter={(p.nickname ?? "?")[0]?.toUpperCase()} size={48} />
                <span className="font-semibold text-text-primary">{p.nickname ?? "—"}</span>
                <span className="text-lg font-bold text-cyan">{p.score.toLocaleString("ru-RU")}</span>
                <span
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${
                    p.rank === 1 ? "bg-amber-500/30 text-amber-400" : p.rank === 2 ? "bg-bg-card text-text-secondary" : "bg-amber-700/30 text-amber-200"
                  }`}
                >
                  {p.rank}
                </span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl bg-bg-secondary overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-text-secondary">
                  <th className="py-3 px-4 font-medium">Никнеймы</th>
                  <th className="py-3 px-4 font-medium">Результат</th>
                </tr>
              </thead>
              <tbody>
                {restList.map((row) => (
                  <tr key={row.rank} className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-text-muted w-6">{row.rank}</span>
                        <Avatar letter={(row.nickname ?? "?")[0]?.toUpperCase()} size={28} />
                        <span className="text-text-primary">{row.nickname ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-primary font-medium">
                      {row.score.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          )}
        </>
      )}

      {tab === "teams" && (
        <div className="py-12 text-center text-text-secondary">
          Результаты по командам — в разработке.
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
