'use client';
import { useEffect, useState } from 'react';
import { Crown, Trophy, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { leaderboardService } from '@/services/leaderboard.service';
import { apiError } from '@/lib/api-error';
type Entry = { id: string; rank: number; nickname: string; totalScore: number; loyaltyStatus: string };
export default function LeaderboardPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [rank, setRank] = useState<{ rank: number | null; total: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try { const [list, mine] = await Promise.all([leaderboardService.getLeaderboard(50), leaderboardService.getMyRank()]); setEntries(list); setRank(mine); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <div className="px-5 pt-8"><p className="eyebrow mb-2 !text-brand">Играй. Соревнуйся. Побеждай.</p><h1 className="text-3xl font-extrabold tracking-tight">Рейтинг игроков</h1><div className="arena-art my-6 rounded-3xl border border-brand/20 p-6"><Trophy size={28} className="mb-5 text-[#ccfc64]" /><p className="text-2xl font-bold">Каждая игра имеет значение.</p><p className="mt-2 text-sm text-slate-400">Общий рейтинг за всё время · топ-50</p>{rank && <p className="mt-5 text-sm text-brand">{rank.rank ? `Твоё место — ${rank.rank} из ${rank.total}` : 'Сыграй свою первую игру и попади в рейтинг'}</p>}</div>
    {loading ? <p role="status" className="py-10 text-center text-sm text-slate-400">Загружаем рекорды…</p> : error ? <div role="alert" className="panel p-5"><p className="text-sm text-red-400">{error}</p><button onClick={load} className="mt-3 flex min-h-11 items-center gap-2 text-sm text-brand"><RefreshCw size={16} />Попробовать ещё</button></div> : !entries.length ? <p className="panel p-8 text-center text-sm text-slate-400">Рекордов пока нет. Первое место может стать твоим.</p> : <div className="panel overflow-hidden">{entries.map(p => <div key={p.id} className={`flex items-center gap-3 border-b border-white/5 p-4 last:border-0 ${p.id === user?.id ? 'bg-brand/10' : ''}`}><span className={`w-6 text-sm font-bold ${p.rank <= 3 ? 'text-[#ccfc64]' : 'text-slate-500'}`}>{p.rank === 1 ? <Crown size={21} /> : String(p.rank).padStart(2, '0')}</span><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-brand">{p.nickname[0]?.toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{p.nickname}{p.id === user?.id && <span className="ml-2 text-[10px] text-brand">ТЫ</span>}</p><p className="mt-1 text-[10px] text-slate-500">{p.loyaltyStatus}</p></div><p className="text-sm font-bold tabular-nums">{p.totalScore.toLocaleString('ru')}</p></div>)}</div>}
  </div>;
}
