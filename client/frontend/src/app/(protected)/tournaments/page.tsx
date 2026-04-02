'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy, Calendar, MapPin, Users, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Скоро',
  ACTIVE: 'Идёт',
  COMPLETED: 'Завершён',
};
const STATUS_COLOR: Record<string, string> = {
  UPCOMING: 'text-yellow-400 bg-yellow-500/10',
  ACTIVE: 'text-green-400 bg-green-500/10',
  COMPLETED: 'text-gray-400 bg-gray-500/10',
};

interface Tournament {
  id: string;
  name: string;
  description?: string;
  dateStart: string;
  dateEnd: string;
  maxTeams: number;
  status: string;
  venue?: { name: string; city: string };
  _count?: { teams: number };
}

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments')
      .then((r) => setTournaments(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-white active:opacity-60 transition-opacity"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">Турниры</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center pt-32">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tournaments.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-40 px-8 text-center">
          <Trophy size={32} className="text-gray-600 mb-4" />
          <p className="text-white font-semibold text-base mb-1">Нет активных турниров</p>
          <p className="text-gray-500 text-sm">Предстоящие турниры отобразятся тут</p>
        </div>
      ) : (
        <div className="px-4 space-y-3 pb-8">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/tournaments/${t.id}`)}
              className="w-full bg-surface-card rounded-2xl p-4 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
                >
                  <Trophy size={20} className="text-yellow-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-white font-semibold text-sm truncate">{t.name}</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[t.status] ?? 'text-gray-400 bg-gray-500/10'}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {t.dateEnd && (
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        до {new Date(t.dateEnd).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {t._count !== undefined && (
                      <div className="flex items-center gap-1">
                        <Users size={11} />
                        {t._count.teams}/{t.maxTeams} команд
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight size={16} className="text-gray-600 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
