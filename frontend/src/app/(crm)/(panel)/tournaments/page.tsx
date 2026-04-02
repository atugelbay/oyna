"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { readApiUserError } from "@/lib/api-error-message";
import { tournamentsService } from "@/services/tournaments.service";
import { useCrmVenue } from "@/lib/venue-context";

type TabFilter = "all" | "active" | "inactive";

type TournamentItem = {
  id: string;
  name: string;
  teamsCount: number;
  dateStart: string;
  dateEnd: string;
  status: "active" | "inactive";
  playersCount: number;
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TournamentsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [tab, setTab] = useState<TabFilter>("all");
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    tournamentsService
      .list(selectedVenueId ? { venueId: selectedVenueId } : undefined)
      .then((raw: { id: string; name: string; dateStart: string; dateEnd: string; maxTeams: number; status: string; _count: { teams: number } }[]) => {
        if (cancelled) return;
        const mapped: TournamentItem[] = raw.map((t) => ({
          id: t.id,
          name: t.name,
          teamsCount: t._count?.teams ?? 0,
          dateStart: formatDate(t.dateStart),
          dateEnd: formatDate(t.dateEnd),
          status: t.status?.toLowerCase() === "active" ? "active" : "inactive",
          playersCount: 0,
        }));
        setTournaments(mapped);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить турниры"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedVenueId]);

  const filtered =
    tab === "all"
      ? tournaments
      : tournaments.filter((t) => t.status === (tab === "active" ? "active" : "inactive"));

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Турниры</h1>
        <div className="flex items-center justify-center py-16 text-text-muted">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Турниры</h1>
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Турниры</h1>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "inactive"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === value ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {value === "all" ? "Все" : value === "active" ? "Активные" : "Неактивные"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <p className="text-text-secondary">Турниры не найдены</p>
        ) : (
        filtered.map((t) => (
          <Link
            key={t.id}
            href={`/tournaments/${t.id}`}
            className="block rounded-xl bg-bg-secondary overflow-hidden hover:bg-bg-card/40 transition-colors"
          >
            <div className="aspect-square bg-bg-card relative flex items-center justify-center">
              <div className="text-text-muted">
                <PlaceholderIcon />
              </div>
              {t.status === "active" && (
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium bg-cyan/20 text-cyan">
                  Активно
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="font-semibold text-text-primary">{t.name}</p>
              <p className="text-sm text-text-secondary mt-1">Количество команд: {t.teamsCount}</p>
              <p className="text-sm text-text-secondary">Дата проведения: {t.dateStart}</p>
            </div>
          </Link>
        ))
        )}
      </div>

      <Link
        href="/tournaments/new"
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon />
        Добавить
      </Link>
    </div>
  );
}

function PlaceholderIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
      <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" />
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
