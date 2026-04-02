'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Copy, Check, Link2 } from 'lucide-react';
import api from '@/lib/api';

interface TeamMember {
  isCaptain: boolean;
  user: { id: string; nickname: string };
}
interface Team {
  id: string;
  name: string;
  isCaptain: boolean;
  _count: { members: number };
  members: TeamMember[];
}
interface TournamentInfo {
  id: string;
  name: string;
  dateEnd: string;
  maxTeams: number;
  teams: { id: string }[];
  venue?: { name: string; city: string };
}
interface TeamPreview {
  id: string;
  name: string;
  _count: { members: number };
  members: TeamMember[];
  tournament: { id: string; name: string; dateEnd: string; status: string };
}

type Tab = 'new' | 'existing';

function AvatarLetter({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: size, height: size, background: color + '20', border: `2px solid ${color}`, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <span style={{ color, fontSize: size * 0.4, fontWeight: 700 }}>{name[0]?.toUpperCase()}</span>
    </div>
  );
}

/** Extract teamId from a full invite URL or treat input as raw teamId */
function parseTeamId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Try parsing as URL → last segment of /join/<teamId>
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const joinIdx = parts.indexOf('join');
    if (joinIdx !== -1 && parts[joinIdx + 1]) return parts[joinIdx + 1];
  } catch {}
  // Fallback: treat entire input as teamId (UUID)
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;
  return null;
}

export default function ParticipatePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tournamentId = params.id as string;

  const [tab, setTab] = useState<Tab>('new');
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // New team
  const [teamName, setTeamName] = useState('');
  const [newError, setNewError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Join by link
  const [linkInput, setLinkInput] = useState('');
  const [teamPreview, setTeamPreview] = useState<TeamPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  // Confirmation
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Pre-fill teamId from query param (when opened via invite link)
    const preTeamId = searchParams.get('teamId');
    if (preTeamId) {
      setTab('existing');
      setLinkInput(`${window.location.origin}/tournaments/${tournamentId}/join/${preTeamId}`);
    }
  }, []);

  useEffect(() => {
    api.get(`/tournaments/${tournamentId}`)
      .then((r) => {
        const t = r.data;
        setTournament(t);
        if (t.myTeam) { setMyTeam(t.myTeam); setConfirmed(true); }
      })
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [tournamentId]);

  // Fetch team preview whenever valid teamId is in the link input
  const fetchPreview = useCallback(async (input: string) => {
    const teamId = parseTeamId(input);
    if (!teamId) { setTeamPreview(null); return; }
    setPreviewLoading(true);
    setLinkError('');
    try {
      const res = await api.get(`/tournaments/teams/${teamId}`);
      setTeamPreview(res.data);
    } catch {
      setTeamPreview(null);
      setLinkError('Команда не найдена. Проверьте ссылку.');
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'existing') return;
    const timeout = setTimeout(() => fetchPreview(linkInput), 500);
    return () => clearTimeout(timeout);
  }, [linkInput, tab, fetchPreview]);

  const handleCreate = async () => {
    if (!teamName.trim() || teamName.trim().length < 2) {
      setNewError('Название команды минимум 2 символа');
      return;
    }
    setNewError('');
    setSubmitting(true);
    try {
      const res = await api.post(`/tournaments/${tournamentId}/teams`, { name: teamName.trim() });
      setMyTeam({ ...res.data });
      setConfirmed(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setNewError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Ошибка при создании команды');
    } finally {
      setSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!teamPreview) return;
    setJoinError('');
    setJoining(true);
    try {
      const res = await api.post(`/tournaments/teams/${teamPreview.id}/join`);
      setMyTeam({ ...res.data, isCaptain: false });
      setConfirmed(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setJoinError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Ошибка при вступлении в команду');
    } finally {
      setJoining(false);
    }
  };

  const copyInviteLink = () => {
    if (!myTeam) return;
    const link = `${window.location.origin}/tournaments/${tournamentId}/join/${myTeam.id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ─── CONFIRMED ─── */
  if (confirmed && myTeam) {
    const inviteLink = typeof window !== 'undefined'
      ? `${window.location.origin}/tournaments/${tournamentId}/join/${myTeam.id}`
      : '';

    return (
      <div className="min-h-screen bg-surface pb-8">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-white">Участие в турнире</h1>
        </div>

        <div className="px-4 pt-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.4)' }}>
            <CheckCircle2 size={28} className="text-green-400" />
          </div>
          <h2 className="text-white text-xl font-bold mb-1">Вы участник турнира!</h2>
          <p className="text-gray-400 text-sm mb-6">Вы зарегистрированы</p>
        </div>

        {/* О команде */}
        <div className="mx-4 rounded-2xl p-4 mb-3" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <p className="text-xs text-gray-500 mb-3">О команде</p>

          {/* Captain */}
          {myTeam.members.filter((m) => m.isCaptain).map((m) => (
            <div key={m.user.id} className="flex items-center gap-2.5 mb-2">
              <AvatarLetter name={m.user.nickname} size={30} />
              <div>
                <p className="text-xs text-gray-500">Капитан команды</p>
                <p className="text-white text-sm font-semibold">{m.user.nickname}</p>
              </div>
            </div>
          ))}

          {/* Team name */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 flex items-center justify-center shrink-0">
              <span className="text-brand text-lg font-black">≡</span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Название команды</p>
              <p className="text-white text-sm font-semibold">{myTeam.name}</p>
            </div>
          </div>

          {/* Invite link (captain only) */}
          {myTeam.isCaptain && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Ссылка для приглашения участников</p>
              <button
                onClick={copyInviteLink}
                className="w-full flex items-center gap-2 rounded-xl px-3 py-2 active:opacity-70"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-brand text-xs flex-1 truncate text-left">{inviteLink}</span>
                {copied ? <Check size={14} className="text-green-400 shrink-0" /> : <Copy size={14} className="text-gray-500 shrink-0" />}
              </button>
            </div>
          )}

          {/* Members count progress */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Зарегистрировано участников</span>
              <span className="text-white">{myTeam._count.members}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (myTeam._count.members / 10) * 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Участники */}
        {myTeam.members.length > 0 && (
          <div className="mx-4 mb-3">
            <p className="text-xs text-gray-500 mb-2">Участники</p>
            <div className="space-y-2">
              {myTeam.members.map((m) => (
                <div key={m.user.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <AvatarLetter name={m.user.nickname} size={28} />
                  <span className="text-white text-sm flex-1">{m.user.nickname}</span>
                  {m.isCaptain && (
                    <span className="text-xs text-brand px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(6,182,212,0.12)' }}>Капитан</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Детали турнира */}
        {tournament && (
          <div className="mx-4 mb-6 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-gray-500 mb-3">Детали турнира</p>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <span className="text-yellow-400 text-lg">🏆</span>
              </div>
              <div>
                <p className="text-white font-semibold">{tournament.name}</p>
                {tournament.venue && <p className="text-xs text-gray-500">{tournament.venue.name}</p>}
                <p className="text-xs text-gray-500">до {new Date(tournament.dateEnd).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Макс. команд</span>
                <span className="text-white">{tournament.maxTeams}+</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-4">
          <button
            onClick={() => router.push('/home')}
            className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    );
  }

  /* ─── PARTICIPATION FORM ─── */
  return (
    <div className="min-h-screen bg-surface pb-32">
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">Участие в турнире</h1>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mb-6 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {(['new', 'existing'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-brand text-[#090D17]' : 'text-gray-400'}`}
          >
            {t === 'new' ? 'Новая команда' : 'Текущая команда'}
          </button>
        ))}
      </div>

      {/* ── New team ── */}
      {tab === 'new' && (
        <div className="px-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Название команды</label>
            <input
              value={teamName}
              onChange={(e) => { setTeamName(e.target.value); setNewError(''); }}
              placeholder="Введите название команды"
              maxLength={40}
              className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${newError ? 'rgba(239,68,68,0.6)' : teamName ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}` }}
            />
            {newError && <p className="text-red-400 text-xs mt-1.5">{newError}</p>}
          </div>

          {tournament && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs text-gray-500 mb-2">Детали турнира</p>
              <p className="text-white font-bold mb-1">{tournament.name}</p>
              <p className="text-gray-400 text-xs mb-2">до {new Date(tournament.dateEnd).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <div className="flex gap-4 text-xs">
                <div>
                  <p className="text-gray-500">Команд</p>
                  <p className="text-white font-semibold">{tournament.teams.length} / {tournament.maxTeams}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Join by link ── */}
      {tab === 'existing' && (
        <div className="px-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Ссылка на команду</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                <Link2 size={15} />
              </div>
              <input
                value={linkInput}
                onChange={(e) => { setLinkInput(e.target.value); setLinkError(''); setJoinError(''); }}
                placeholder="Вставьте ссылку сюда"
                className="w-full pl-10 pr-4 py-3.5 rounded-xl text-white text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${linkError ? 'rgba(239,68,68,0.6)' : linkInput ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}` }}
              />
            </div>
            {!linkInput && (
              <p className="text-gray-600 text-xs mt-2">Запросите ссылку у вашего капитана чтобы участвовать</p>
            )}
            {linkError && <p className="text-red-400 text-xs mt-1.5">{linkError}</p>}
          </div>

          {/* Team preview */}
          {previewLoading && (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {teamPreview && !previewLoading && (
            <div className="rounded-2xl p-4" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <p className="text-xs text-gray-500 mb-3">О команде</p>

              {teamPreview.members.filter((m) => m.isCaptain).map((m) => (
                <div key={m.user.id} className="flex items-center gap-2.5 mb-2">
                  <AvatarLetter name={m.user.nickname} size={28} />
                  <div>
                    <p className="text-xs text-gray-500">Капитан команды</p>
                    <p className="text-white text-sm font-semibold">{m.user.nickname}</p>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                  <span className="text-brand text-base font-black">≡</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Название команды</p>
                  <p className="text-white text-sm font-semibold">{teamPreview.name}</p>
                </div>
              </div>

              {joinError && <p className="text-red-400 text-xs mt-3">{joinError}</p>}
            </div>
          )}
        </div>
      )}

      {/* Bottom button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4"
        style={{ background: 'linear-gradient(to top, #090D17 80%, transparent)' }}>
        {tab === 'new' ? (
          <button
            onClick={handleCreate}
            disabled={!teamName.trim() || submitting}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40"
            style={{
              background: teamName.trim() && !submitting ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(255,255,255,0.06)',
              color: teamName.trim() && !submitting ? '#090D17' : '#9ca3af',
            }}
          >
            {submitting ? 'Создание...' : 'Подтвердить участие'}
          </button>
        ) : (
          <button
            onClick={handleJoin}
            disabled={!teamPreview || joining}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-40"
            style={{
              background: teamPreview && !joining ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'rgba(255,255,255,0.06)',
              color: teamPreview && !joining ? '#090D17' : '#9ca3af',
            }}
          >
            {joining ? 'Вступление...' : teamPreview ? '✓ Подтвердить участие' : 'Подтвердить участие'}
          </button>
        )}
      </div>
    </div>
  );
}
