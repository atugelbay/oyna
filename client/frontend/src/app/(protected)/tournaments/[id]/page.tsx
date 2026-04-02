'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Share2, Trophy, Calendar, MapPin, Users, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Скоро',
  ACTIVE: 'Идёт',
  COMPLETED: 'Завершён',
};
const STATUS_COLOR: Record<string, string> = {
  UPCOMING: 'text-yellow-400 border-yellow-500/40',
  ACTIVE: 'text-green-400 border-green-500/40',
  COMPLETED: 'text-gray-400 border-gray-500/40',
};

interface TeamMember {
  isCaptain: boolean;
  user: { id: string; nickname: string };
}
interface MyTeam {
  id: string;
  name: string;
  isCaptain: boolean;
  _count: { members: number };
  members: TeamMember[];
}
interface Tournament {
  id: string;
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  maxTeams: number;
  status: string;
  venue?: { id: string; name: string; city: string; address?: string };
  teams: {
    id: string;
    name: string;
    _count: { members: number };
    members: TeamMember[];
  }[];
  myTeam: MyTeam | null;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}

function AvatarLetter({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div
      style={{ width: size, height: size, background: color + '20', border: `2px solid ${color}`, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <span style={{ color, fontSize: size * 0.4, fontWeight: 700 }}>
        {name[0]?.toUpperCase()}
      </span>
    </div>
  );
}

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/tournaments/${id}`)
      .then((r) => setTournament(r.data))
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [id]);

  const share = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: tournament?.name, url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Ссылка скопирована'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) return null;

  const teamsLeft = tournament.maxTeams - tournament.teams.length;
  const isOver = tournament.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-surface pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">О турнире</h1>
      </div>

      {/* Cover placeholder */}
      <div className="mx-4 rounded-2xl overflow-hidden mb-5" style={{ height: 180, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-full h-full flex items-center justify-center">
          <Trophy size={56} className="text-yellow-400/40" />
        </div>
      </div>

      {/* Title + status */}
      <div className="px-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2 className="text-white text-xl font-bold">{tournament.name}</h2>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 mt-1 ${STATUS_COLOR[tournament.status] ?? 'text-gray-400 border-gray-500/40'}`}>
            {STATUS_LABEL[tournament.status] ?? tournament.status}
          </span>
        </div>
        {tournament.venue && (
          <div className="flex items-center gap-1.5 text-gray-400 text-sm">
            <MapPin size={13} />
            <span>{tournament.venue.name}{tournament.venue.city ? `, ${tournament.venue.city}` : ''}</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mx-4 rounded-2xl p-4 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Начало</span>
            <span className="text-white font-medium">{fmt(tournament.dateStart)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Конец</span>
            <span className="text-white font-medium">{fmt(tournament.dateEnd)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Кол-во команд</span>
            <span className="text-white font-medium">{tournament.teams.length} / {tournament.maxTeams}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Свободных мест</span>
            <span className={`font-medium ${teamsLeft > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {teamsLeft > 0 ? `${teamsLeft} команд` : 'Мест нет'}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {tournament.description && (
        <div className="px-4 mb-4">
          <p className="text-sm font-semibold text-gray-400 mb-2">Описание</p>
          <p className="text-sm text-gray-300 leading-relaxed">{tournament.description}</p>
        </div>
      )}

      {/* My team (if participating) */}
      {tournament.myTeam && (
        <div className="px-4 mb-4">
          <p className="text-sm font-semibold text-gray-400 mb-2">Моя команда</p>
          <div className="rounded-2xl p-4" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <div className="flex items-center gap-3 mb-3">
              <AvatarLetter name={tournament.myTeam.name} size={38} />
              <div>
                <p className="text-white font-bold">{tournament.myTeam.name}</p>
                <p className="text-xs text-brand">
                  {tournament.myTeam.isCaptain ? 'Вы капитан' : 'Участник'}
                  {' · '}
                  {tournament.myTeam._count.members} чел.
                </p>
              </div>
            </div>
            {/* Invite link */}
            {tournament.myTeam.isCaptain && (
              <div
                className="rounded-xl px-3 py-2 text-xs text-gray-400 break-all"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                Ссылка для участников:<br />
                <span className="text-brand">{typeof window !== 'undefined' ? `${window.location.origin}/tournaments/${tournament.id}/join/${tournament.myTeam.id}` : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teams list preview */}
      {tournament.teams.length > 0 && (
        <div className="px-4 mb-4">
          <p className="text-sm font-semibold text-gray-400 mb-2">Команды ({tournament.teams.length})</p>
          <div className="space-y-2">
            {tournament.teams.slice(0, 5).map((team) => {
              const captain = team.members.find((m) => m.isCaptain);
              return (
                <div key={team.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <AvatarLetter name={team.name} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{team.name}</p>
                    {captain && <p className="text-xs text-gray-500">Капитан: {captain.user.nickname}</p>}
                  </div>
                  <span className="text-xs text-gray-500">{team._count.members} чел.</span>
                </div>
              );
            })}
            {tournament.teams.length > 5 && (
              <p className="text-xs text-center text-gray-600 py-1">
                и ещё {tournament.teams.length - 5} команд
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4" style={{ background: 'linear-gradient(to top, #090D17 80%, transparent)' }}>
        {tournament.myTeam ? (
          <button
            onClick={() => router.push(`/tournaments/${tournament.id}/participate`)}
            className="w-full py-4 rounded-2xl text-white font-bold text-base"
            style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)' }}
          >
            Моя команда
          </button>
        ) : isOver ? (
          <button disabled className="w-full py-4 rounded-2xl text-gray-500 font-bold text-base bg-surface-card">
            Турнир завершён
          </button>
        ) : teamsLeft <= 0 ? (
          <button disabled className="w-full py-4 rounded-2xl text-gray-500 font-bold text-base bg-surface-card">
            Мест нет
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={share}
              className="flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-gray-300 font-medium"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Share2 size={18} />
              <span className="text-sm">Поделиться</span>
            </button>
            <button
              onClick={() => router.push(`/tournaments/${tournament.id}/participate`)}
              className="flex-1 py-4 rounded-2xl font-bold text-base text-[#090D17]"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #0891b2)' }}
            >
              Участвовать
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
