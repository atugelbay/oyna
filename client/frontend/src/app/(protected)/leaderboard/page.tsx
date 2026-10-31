'use client';
import { useEffect, useState } from 'react';
import { Crown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { leaderboardService } from '@/services/leaderboard.service';
import { apiError } from '@/lib/api-error';

type Entry = { id: string; rank: number; nickname: string; totalScore: number; loyaltyStatus: string };
const periods = ['day', 'month', 'year', 'all'] as const;
const rooms = [
  ['all', 'allRooms'],
  ['megagrid', 'Mega Grid'],
  ['arena', 'Arena'],
  ['hide', 'Hide'],
  ['lasers', 'Лазеры'],
] as const;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { t, toggle } = useI18n();
  const [period, setPeriod] = useState<(typeof periods)[number]>('day');
  const [room, setRoom] = useState('all');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [label, setLabel] = useState('');
  const [me, setMe] = useState<{ place: number; total: number; points: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(nextPeriod = period, nextRoom = room) {
    setLoading(true);
    setError('');
    try {
      const data = await leaderboardService.getLeaderboard({ period: nextPeriod, room: nextRoom, limit: 50 });
      setEntries(data.items ?? []);
      setLabel(data.label ?? '');
      setMe(data.me ?? null);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="px-5 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('ratingTitle')}</h1>
        <button type="button" onClick={toggle} className="min-h-11 rounded-xl border border-white/10 px-3 text-xs font-bold">
          ҚАЗ / РУС
        </button>
      </div>
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {periods.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPeriod(item);
              void load(item, room);
            }}
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${period === item ? 'bg-brand text-black' : 'bg-white/5'}`}
          >
            {t(item === 'day' ? 'day' : item === 'month' ? 'month' : item === 'year' ? 'year' : 'all')}
          </button>
        ))}
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {rooms.map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setRoom(id);
              void load(period, id);
            }}
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${room === id ? 'bg-white text-black' : 'bg-white/5'}`}
          >
            {id === 'all' ? t('allRooms') : name}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-400">{label}</p>
      {me && (
        <p className="mb-4 text-sm text-brand">
          {t('yourPlace')} — {me.place} / {me.total} · {me.points}
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">…</p>
      ) : error ? (
        <div className="panel p-5">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => load()} className="mt-3 flex min-h-11 items-center gap-2 text-sm text-brand">
            <RefreshCw size={16} />
          </button>
        </div>
      ) : !entries.length ? (
        <p className="panel p-8 text-center text-sm text-slate-400">{t('empty')}</p>
      ) : (
        <div className="panel overflow-hidden">
          {entries.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 border-b border-white/5 p-4 last:border-0 ${p.id === user?.id ? 'bg-brand/10' : ''}`}>
              <span className={`w-6 text-sm font-bold ${p.rank <= 3 ? 'text-[#ccfc64]' : 'text-slate-500'}`}>
                {p.rank === 1 ? <Crown size={21} /> : String(p.rank).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{p.nickname}</p>
                <p className="mt-1 text-[10px] text-slate-500">{p.loyaltyStatus}</p>
              </div>
              <p className="text-sm font-bold tabular-nums">{p.totalScore.toLocaleString('ru')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
