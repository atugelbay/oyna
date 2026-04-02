'use client';

import { useEffect, useState } from 'react';
import { Gamepad2, Trophy, Clock, MapPin } from 'lucide-react';
import { sessionsService } from '@/services/sessions.service';

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Завершена',
  ACTIVE: 'В процессе',
  PENDING: 'Ожидание',
  ERROR: 'Ошибка',
  CANCELLED: 'Отменена',
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'text-green-400 bg-green-500/10',
  ACTIVE: 'text-blue-400 bg-blue-500/10',
  PENDING: 'text-yellow-400 bg-yellow-500/10',
  ERROR: 'text-red-400 bg-red-500/10',
  CANCELLED: 'text-gray-400 bg-gray-500/10',
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    sessionsService.getMySessions(1, 20)
      .then((r) => {
        setSessions(r.data);
        setMeta({ page: r.meta.page, totalPages: r.meta.totalPages, total: r.meta.total });
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (meta.page >= meta.totalPages) return;
    setLoadingMore(true);
    try {
      const res = await sessionsService.getMySessions(meta.page + 1, 20);
      setSessions((p) => [...p, ...res.data]);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages, total: res.meta.total });
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Мои игры</h1>
        <span className="text-gray-500 text-sm">{meta.total} игр</span>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-surface-card rounded-2xl p-10 text-center">
          <Gamepad2 size={40} className="text-gray-600 mx-auto mb-4" />
          <p className="text-white font-semibold mb-1">Игр пока нет</p>
          <p className="text-gray-500 text-sm">После первой игры тут появится история</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="bg-surface-card rounded-2xl p-4">
              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-white font-semibold">{s.room?.name ?? 'Комната'}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{s.mode?.name ?? s.mode?.type}</p>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[s.status] ?? 'text-gray-400 bg-gray-500/10'}`}>
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </div>

              {/* Details */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <MapPin size={12} />
                  {s.venue?.name ?? '—'}
                </div>
                {s.deductedSeconds > 0 && (
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {Math.floor(s.deductedSeconds / 60)}м
                  </div>
                )}
                {s.startTime && (
                  <span>{new Date(s.startTime).toLocaleDateString('ru')}</span>
                )}
              </div>

              {/* Score */}
              {s.myScore !== null && (
                <div className="mt-3 pt-3 border-t border-gray-700/50 flex items-center gap-2">
                  <Trophy size={14} className="text-yellow-400" />
                  <span className="text-yellow-400 font-semibold text-sm">{s.myScore} очков</span>
                </div>
              )}
            </div>
          ))}

          {meta.page < meta.totalPages && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-brand text-sm font-medium flex items-center justify-center gap-2"
            >
              {loadingMore ? (
                <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              ) : (
                'Загрузить ещё'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
