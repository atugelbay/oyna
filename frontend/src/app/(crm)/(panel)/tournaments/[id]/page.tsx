"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";
import { tournamentsService } from "@/services/tournaments.service";
import { readApiUserError } from "@/lib/api-error-message";

type TeamMember = { nickname: string; phone: string; birthDate: string; segment: string; isCaptain: boolean };
type ResultRow = { rank: number; nickname: string; score: number };
type TeamWithMembers = { id: string; name: string; participantsCount: number; members: TeamMember[] };
type TournamentDetail = {
  id: string;
  name: string;
  dateStart: string;
  dateEnd: string;
  playersCount: number;
  description: string;
  maxTeams: number;
  teams: TeamWithMembers[];
  results: ResultRow[];
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TournamentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [detailTab, setDetailTab] = useState<"teams" | "results">("teams");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    tournamentsService
      .getById(id)
      .then((raw: {
        id: string;
        name: string;
        dateStart: string;
        dateEnd: string;
        description: string | null;
        maxTeams: number;
        teams: { id: string; name: string; members: { user: { nickname: string; phone: string; birthDate: string | null; loyaltyStatus: string }; isCaptain: boolean }[]; _count?: { members: number } }[];
        results: { rank: number; score: number; user: { nickname: string } | null }[];
      }) => {
        if (cancelled) return;
        const teams: TeamWithMembers[] = (raw.teams ?? []).map((team) => ({
          id: team.id,
          name: team.name,
          participantsCount: team._count?.members ?? team.members?.length ?? 0,
          members: (team.members ?? []).map((m) => ({
            nickname: m.user?.nickname ?? "-",
            phone: m.user?.phone ?? "-",
            birthDate: m.user?.birthDate ? formatDate(m.user.birthDate) : "-",
            segment: m.user?.loyaltyStatus ?? "-",
            isCaptain: m.isCaptain ?? false,
          })),
        }));
        const results: ResultRow[] = (raw.results ?? [])
          .sort((a, b) => a.rank - b.rank)
          .map((r) => ({
            rank: r.rank,
            nickname: r.user?.nickname ?? "-",
            score: r.score ?? 0,
          }));
        let playersCount = 0;
        for (const team of raw.teams ?? []) {
          playersCount += team._count?.members ?? team.members?.length ?? 0;
        }
        setT({
          id: raw.id,
          name: raw.name,
          dateStart: formatDate(raw.dateStart),
          dateEnd: formatDate(raw.dateEnd),
          playersCount,
          description: raw.description ?? "",
          maxTeams: raw.maxTeams ?? 10,
          teams,
          results,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить турнир"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  async function handleDelete() {
    if (deleting) return;
    if (!id) return;

    setActionError(null);
    const ok = window.confirm("Удалить это событие?");
    if (!ok) return;

    setDeleting(true);
    try {
      await tournamentsService.remove(id);
      router.push("/tournaments");
    } catch (err: unknown) {
      setActionError(readApiUserError(err, "Не удалось удалить турнир"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-text-primary">Турнир</h1>
        <div className="flex items-center justify-center py-16 text-text-muted">Загрузка...</div>
      </div>
    );
  }

  if (error || !t) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-text-primary">Турнир</h1>
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">{error ?? "Турнир не найден"}</div>
      </div>
    );
  }

  const selectedTeam = selectedTeamId ? t.teams.find((team) => team.id === selectedTeamId) : null;
  const teamMembers = selectedTeam?.members ?? [];
  const registeredCount = t.teams.length;
  const filteredTeams = teamSearch.trim()
    ? t.teams.filter((team) => team.name.toLowerCase().includes(teamSearch.trim().toLowerCase()))
    : t.teams;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link href="/tournaments" className="inline-flex items-center gap-2 text-text-secondary hover:text-cyan text-sm">
          <BackIcon />
          О турнире
        </Link>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-lg border border-surface-border text-text-primary text-sm font-medium hover:bg-bg-card">
            Изменить
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-danger text-danger text-sm font-medium hover:bg-danger/10 disabled:opacity-50"
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>

      {actionError ? <p className="text-danger text-sm">{actionError}</p> : null}

      <div className="flex gap-6 flex-wrap">
        <div className="w-48 h-48 rounded-xl bg-bg-card flex items-center justify-center shrink-0">
          <PlaceholderIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-secondary">Дата проведения: {t.dateStart} – {t.dateEnd}</p>
          <p className="text-sm text-text-secondary mt-1">Количество игроков: {t.playersCount}</p>
          <p className="text-xl font-semibold text-text-primary mt-2">{t.name}</p>
          <div className="mt-3">
            <p className="text-sm text-text-secondary mb-1">Правила / Описание</p>
            <p className="text-sm text-text-primary">{t.description}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-surface-border">
        <button
          type="button"
          onClick={() => setDetailTab("teams")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            detailTab === "teams" ? "border-success text-cyan" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Команды
        </button>
        <button
          type="button"
          onClick={() => setDetailTab("results")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            detailTab === "results" ? "border-success text-cyan" : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Результаты команд
        </button>
      </div>

      {detailTab === "teams" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Поиск по наименованию команды"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="w-full h-10 pl-4 pr-10 bg-bg-secondary border border-surface-border rounded-lg text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-cyan"
              />
              <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
            </div>
            <div className="h-2 bg-bg-card rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${(registeredCount / t.maxTeams) * 100}%` }} />
            </div>
            <p className="text-sm text-text-secondary">Зарегистрировано {registeredCount} из {t.maxTeams}</p>
            <div className="space-y-1">
              {filteredTeams.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                    selectedTeamId === team.id ? "bg-cyan/15 text-cyan" : "bg-bg-secondary hover:bg-bg-card"
                  }`}
                >
                  <span className="font-medium text-text-primary">{team.name}</span>
                  <span className="text-sm text-text-secondary">Количество участников: {team.participantsCount}</span>
                  <ChevronRightIcon className="w-4 h-4 text-text-muted" />
                </button>
              ))}
            </div>
            <button type="button" className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan text-bg-primary font-medium text-sm">
              <PlusIcon />
              Команда
            </button>
          </div>
          <div className="lg:col-span-2 bg-bg-secondary rounded-xl p-4">
            {selectedTeam ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedTeamId(null)} className="p-1 text-text-muted hover:text-text-primary">
                      <CloseIcon />
                    </button>
                    <h3 className="font-semibold text-text-primary">{selectedTeam.name}</h3>
                  </div>
                  <span className="text-sm text-text-secondary">Участники команды</span>
                  <button type="button" className="text-danger text-sm font-medium hover:underline">Дисквалифицировать</button>
                </div>
                <div className="rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border text-left text-text-secondary">
                        <th className="py-2 px-3 font-medium">Прозвище</th>
                        <th className="py-2 px-3 font-medium">Контакты</th>
                        <th className="py-2 px-3 font-medium">Дата рождения</th>
                        <th className="py-2 px-3 font-medium">Сегмент</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((m, i) => (
                        <tr key={i} className="border-b border-surface-border/50 last:border-0">
                          <td className="py-2 px-3">
                            <span className="text-text-primary">{m.nickname}</span>
                            {m.isCaptain && <span className="ml-2 text-xs text-cyan">Капитан</span>}
                          </td>
                          <td className="py-2 px-3 text-text-secondary">{m.phone}</td>
                          <td className="py-2 px-3 text-text-secondary">{m.birthDate}</td>
                          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">{m.segment}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <SearchIcon className="w-12 h-12 text-text-muted mb-3" />
                <p className="font-medium text-text-primary">Нет команд</p>
                <p className="text-sm text-text-secondary mt-1">Пока регистрация новых команд капитанами еще нет</p>
              </div>
            )}
          </div>
        </div>
      )}

      {detailTab === "results" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 max-w-3xl">
            {t.results.slice(0, 3).map((r) => (
              <div
                key={r.rank}
                className={`rounded-xl p-4 flex flex-col items-center gap-2 ${
                  r.rank === 1 ? "bg-amber-500/10 border border-amber-500/30" : r.rank === 2 ? "bg-bg-secondary" : "bg-amber-700/10 border border-amber-700/30"
                }`}
              >
                <Avatar letter={r.nickname[0]} size={40} />
                <span className="font-medium text-text-primary">{r.nickname}</span>
                <span className="text-cyan font-bold">{r.score.toLocaleString("ru-RU")}</span>
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  r.rank === 1 ? "bg-amber-500/30 text-amber-400" : r.rank === 2 ? "bg-bg-card text-text-secondary" : "bg-amber-700/30 text-amber-200"
                }`}>{r.rank}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-bg-secondary overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border text-left text-text-secondary">
                  <th className="py-3 px-4 font-medium">Никнеймы</th>
                  <th className="py-3 px-4 font-medium">Результат</th>
                </tr>
              </thead>
              <tbody>
                {t.results.map((r, i) => (
                  <tr key={i} className="border-b border-surface-border/50 last:border-0">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <span className="text-text-muted w-6">{r.rank}</span>
                      <Avatar letter={r.nickname[0]} size={24} />
                      <span className="text-text-primary">{r.nickname}</span>
                    </td>
                    <td className="py-3 px-4 text-text-primary font-medium">{r.score.toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
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
function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="m9 18 6-6-6-6" />
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
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function PlaceholderIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-text-muted">
      <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" />
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <path d="M14 5h5v5" />
    </svg>
  );
}
