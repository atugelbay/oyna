'use client';
import { useEffect, useState } from 'react';
import { Clock3, ArrowDownLeft, ArrowUpRight, MapPin, Info, RefreshCw } from 'lucide-react';
import { balanceService } from '@/services/balance.service';
import { apiError } from '@/lib/api-error';
type Balance = { displayMinutes: number; availableSeconds: number };
type Transaction = { id: string; type: string; equivalentSeconds: number; amountTenge: number; createdAt: string; venue?: { name: string } };
const labels: Record<string, string> = { PURCHASE: 'Пополнение', BONUS: 'Бонусные минуты', PROMO: 'Минуты по акции', GAME_DEBIT: 'Списание за игру', CORRECTION: 'Корректировка' };
export default function BalancePage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState({ page: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const [bal, tx] = await Promise.all([balanceService.getBalance(), balanceService.getTransactions()]); setBalance(bal); setTransactions(tx.data); setMeta(tx.meta); }
    catch (e) { setError(apiError(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function loadMore() {
    setMore(true); setError('');
    try { const tx = await balanceService.getTransactions(meta.page + 1); setTransactions(p => [...p, ...tx.data]); setMeta(tx.meta); }
    catch (e) { setError(apiError(e)); }
    finally { setMore(false); }
  }
  return <div className="px-5 pt-8"><p className="eyebrow mb-2">Твоё время в игре</p><h1 className="mb-6 text-3xl font-extrabold tracking-tight">Баланс минут</h1><div className="grid gap-4 md:grid-cols-2"><section className="balance-hero p-6"><p className="mb-6 flex items-center gap-2 text-xs font-semibold"><Clock3 size={16} />Доступно для игры</p><p className="text-[72px] font-extrabold leading-none tracking-[-.06em]">{balance?.displayMinutes ?? '—'}<span className="ml-2 text-xl tracking-normal">мин</span></p><p className="mt-5 text-xs opacity-70">Единый баланс для всех комнат центра</p></section><section className="panel p-5"><MapPin size={24} className="mb-4 text-brand" /><h2 className="mb-2 text-lg font-bold">Пополни на ресепшене</h2><p className="text-sm leading-relaxed text-slate-400">Назови свой номер телефона или никнейм администратору. Минуты появятся в личном кабинете.</p><button onClick={load} disabled={loading} className="mt-4 flex min-h-11 items-center gap-2 text-xs font-semibold text-brand"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Обновить баланс</button></section></div><div className="my-5 flex gap-3 rounded-xl border border-white/10 px-4 py-3"><Info size={17} className="mt-0.5 shrink-0 text-brand" /><p className="text-xs leading-relaxed text-slate-400">Для входа в лобби нужно от 10 минут. Списание 10 минут происходит при старте игры на экране комнаты.</p></div>
    {error && <div role="alert" className="mb-5 rounded-xl bg-red-500/10 p-4 text-sm text-red-400">{error}<button onClick={load} className="mt-2 block min-h-11 font-semibold underline">Повторить загрузку</button></div>}
    <h2 className="mb-4 mt-7 text-lg font-bold">История операций</h2>{loading ? <p role="status" className="py-10 text-center text-sm text-slate-400">Загружаем операции…</p> : transactions.length ? <div className="panel overflow-hidden">{transactions.map(t => {
      const debit = t.type === 'GAME_DEBIT' || t.equivalentSeconds < 0;
      return <div key={t.id} className="flex items-center gap-3 border-b border-white/5 p-4 last:border-0"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${debit ? 'bg-white/5 text-slate-400' : 'bg-brand/10 text-brand'}`}>{debit ? <ArrowUpRight size={19} /> : <ArrowDownLeft size={19} />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{labels[t.type] ?? 'Операция по балансу'}</p><p className="mt-1 text-[11px] text-slate-500">{t.venue?.name ?? 'OYNA'} · {new Date(t.createdAt).toLocaleDateString('ru-RU', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short' })}</p></div><div className="shrink-0 text-right"><p className={`text-sm font-bold ${debit ? 'text-slate-300' : 'text-brand'}`}>{debit ? '−' : '+'}{Math.floor(Math.abs(t.equivalentSeconds) / 60)} мин</p>{t.amountTenge !== 0 && <p className="mt-1 text-[11px] text-slate-500">{t.amountTenge.toLocaleString('ru')} ₸</p>}</div></div>;
    })}</div> : !error && <div className="panel p-8 text-center"><Clock3 size={28} className="mx-auto mb-3 text-slate-500" /><p className="text-sm font-semibold">Пока без операций</p><p className="mt-2 text-xs leading-relaxed text-slate-400">Первое пополнение или игра появятся здесь.</p></div>}{meta.page < meta.totalPages && <button onClick={loadMore} disabled={more} className="mt-4 min-h-12 w-full text-sm font-semibold text-brand">{more ? 'Загрузка…' : 'Показать ещё'}</button>}
  </div>;
}
