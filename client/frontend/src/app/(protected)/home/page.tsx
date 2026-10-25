'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ScanLine, Trophy, Tag, MapPin, ChevronRight, Clock3, Zap, Crown } from 'lucide-react';
import { Brand } from '@/components/ui/Brand';
import { useAuth } from '@/lib/auth-context';
import { balanceService } from '@/services/balance.service';
import { leaderboardService } from '@/services/leaderboard.service';
import { promosService } from '@/services/promos.service';
import { venuesService } from '@/services/venues.service';
import { apiError } from '@/lib/api-error';

type Leader = { id: string; nickname: string; rank: number; totalScore: number };
type Promo = { id: string; title: string; headline?: string; reward?: string };
type Venue = { id: string; name: string; address: string };
export default function HomePage() {
  const { user } = useAuth();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueId, setVenueId] = useState('');
  const [error, setError] = useState('');
  const [leadersError, setLeadersError] = useState(false);
  const [promosError, setPromosError] = useState(false);
  useEffect(() => {
    balanceService.getBalance().then(b => setMinutes(b.displayMinutes)).catch(e => setError(apiError(e)));
    leaderboardService.getLeaderboard(3).then(setLeaders).catch(() => setLeadersError(true));
    venuesService.getVenues().then(setVenues).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    setPromosError(false);
    promosService.getActivePromos(venueId || undefined).then(p => { if (active) setPromos(p); }).catch(() => { if (active) setPromosError(true); });
    return () => { active = false; };
  }, [venueId]);
  return <div className="px-5 pb-4 pt-7 md:px-8 md:pt-8">
    <header className="mb-8 flex items-center justify-between gap-4"><Link href="/home" aria-label="OYNA — главная"><Brand /></Link><label className="flex max-w-[52%] items-center gap-1.5 text-xs text-slate-300"><MapPin size={14} className="shrink-0 text-brand" /><select aria-label="Игровой центр" value={venueId} onChange={e => setVenueId(e.target.value)} className="min-h-11 min-w-0 max-w-full bg-transparent">{!venues.length && <option value="">Игровой центр</option>}{venues.length > 0 && <option value="">Все центры</option>}{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label></header>
    <div className="mb-6 flex items-end justify-between gap-4"><div><p className="eyebrow mb-2">Личный кабинет игрока</p><h1 className="text-[30px] font-extrabold leading-tight tracking-[-.045em]">Привет, <span className="break-all">{user?.nickname}</span><span className="text-brand">.</span></h1></div><Link href="/profile" aria-label="Открыть профиль" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/30 bg-brand/10 font-bold text-brand">{user?.nickname?.[0]?.toUpperCase()}</Link></div>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="balance-hero p-6"><div className="relative z-10"><div className="mb-5 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold"><Clock3 size={15} />Твой игровой баланс</p><span className="rounded-full border border-[#07202a]/20 px-2 py-1 text-[9px] font-bold tracking-widest">PLAY TIME</span></div><p className="mb-2 text-[64px] font-extrabold leading-none tracking-[-.06em]">{minutes ?? '—'}<span className="ml-2 text-xl font-semibold tracking-normal">мин</span></p><p className="text-xs opacity-70">{minutes === null ? 'Загружаем баланс…' : minutes >= 10 ? `Хватит на ${Math.floor(minutes / 10)} игр по 10 минут` : 'Для входа в лобби нужно 10 минут'}</p><Link href="/balance" className="mt-6 flex min-h-11 items-center justify-between rounded-xl bg-[#07202a] px-4 text-xs font-bold text-white">Баланс и пополнение<ArrowRight size={17} /></Link></div></section>
      <Link href="/how-to-play" className="arena-art flex min-h-[220px] flex-col justify-between rounded-3xl border border-brand/20 p-6"><div className="flex items-center justify-between"><span className="eyebrow !text-brand">Включайся в игру</span><ScanLine size={27} strokeWidth={1.4} className="text-brand" /></div><div><h2 className="max-w-48 text-[27px] font-bold leading-tight tracking-tight">Твоя игра начинается с QR</h2><p className="mb-4 mt-2 max-w-52 text-xs leading-relaxed text-slate-400">Отсканируй код на экране комнаты камерой телефона.</p><span className="inline-flex items-center gap-2 text-xs font-semibold text-brand">Как это работает<ArrowRight size={15} /></span></div></Link>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-400">{error} <Link className="underline" href="/balance">Открыть баланс</Link></p>}
    <section className="panel my-4 flex items-center gap-3 p-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ccfc64]/10 text-[#ccfc64]"><Zap size={21} /></span><div className="min-w-0 flex-1"><p className="mb-1 text-sm font-semibold">{user?.loyaltyStatus ?? 'BRONZE'} <span className="font-normal text-slate-500">· твой статус</span></p><p className="text-xs text-slate-400">Играй, набирай очки, повышай уровень</p></div><div className="text-right"><p className="text-lg font-bold tabular-nums">{(user?.totalScore ?? 0).toLocaleString('ru')}</p><p className="text-[10px] text-slate-500">очков</p></div></section>
    <div className="my-6 grid grid-cols-2 gap-3">{[{ href: '/promos', title: 'Акции', text: 'Больше игры', icon: Tag, color: 'text-brand' }, { href: '/tournaments', title: 'Турниры', text: 'Время побеждать', icon: Trophy, color: 'text-[#ccfc64]' }].map(({ href, title, text, icon: Icon, color }) => <Link key={href} href={href} className="panel flex items-center gap-3 p-4"><Icon size={21} className={`shrink-0 ${color}`} /><div className="min-w-0"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-[10px] text-slate-500">{text}</p></div><ChevronRight size={14} className="ml-auto shrink-0 text-slate-500" /></Link>)}</div>
    <section className="mb-6"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold tracking-tight">На вершине игры</h2><Link href="/leaderboard" className="flex items-center gap-1 text-xs text-brand">Весь рейтинг<ChevronRight size={14} /></Link></div><div className="panel overflow-hidden">{leaders.length ? leaders.map((p, i) => <div key={p.id} className="flex items-center gap-3 border-b border-white/5 px-4 py-4 last:border-0"><span className={`w-5 text-sm font-bold ${i === 0 ? 'text-[#ccfc64]' : 'text-slate-500'}`}>{String(p.rank).padStart(2, '0')}</span><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${i === 0 ? 'bg-[#ccfc64]/10 text-[#ccfc64]' : 'bg-white/5 text-slate-400'}`}>{i === 0 ? <Crown size={17} /> : p.nickname[0]?.toUpperCase()}</span><p className="min-w-0 flex-1 truncate text-sm font-semibold">{p.nickname}</p><p className="text-sm font-bold tabular-nums">{p.totalScore.toLocaleString('ru')}<span className="ml-1 text-[10px] font-normal text-slate-500">очк.</span></p></div>) : <p className="p-5 text-sm text-slate-400">{leadersError ? 'Рейтинг временно недоступен. Попробуйте открыть его позже.' : 'Рейтинг ждёт первых рекордов. Сыграй и займи своё место.'}</p>}</div></section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold tracking-tight">Для твоей следующей игры</h2><Link href="/promos" aria-label="Все акции" className="p-2 text-slate-400"><ArrowRight size={18} /></Link></div>{promos.length ? <div className="grid gap-3 md:grid-cols-2">{promos.slice(0, 2).map(p => <Link href={`/promos/${p.id}`} key={p.id} className="arena-art rounded-2xl border border-white/10 p-5"><p className="eyebrow mb-5 !text-brand">Предложение OYNA</p><h3 className="text-lg font-bold">{p.title}</h3><p className="mt-2 text-xs text-slate-400">{p.reward || p.headline || 'Подробнее об акции'} →</p></Link>)}</div> : <p className="panel p-5 text-sm leading-relaxed text-slate-400">{promosError ? 'Не удалось загрузить предложения. Попробуйте открыть акции позже.' : 'Новые предложения скоро появятся здесь. А пока — увидимся в игре!'}</p>}</section>
    <p className="mt-7 text-center text-[9px] tracking-[.25em] text-slate-600">OYNA · ВЫХОДИ ЗА ПРЕДЕЛЫ ЭКРАНА</p>
  </div>;
}
