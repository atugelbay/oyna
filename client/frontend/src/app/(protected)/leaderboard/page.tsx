'use client';
import { useEffect, useRef, useState } from 'react';
import { Crown, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n';
import { leaderboardService } from '@/services/leaderboard.service';
import { apiError } from '@/lib/api-error';

type Entry = { id: string; rank: number; nickname: string; totalScore: number; loyaltyStatus: string };
type Period = 'day' | 'month' | 'year' | 'all';

const periods: Period[] = ['day', 'month', 'year', 'all'];
const rooms = [
  ['all', 'allRooms'],
  ['megagrid', 'Mega Grid'],
  ['arena', 'Arena'],
  ['hide', 'Hide'],
  ['lasers', 'Лазеры'],
] as const;
const ZONE = 'Asia/Almaty';
const MONTHS_BACK = 18;
const DAYS_BACK = 14;

function almatyToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftIsoDay(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function recentDays(today: string) {
  return Array.from({ length: DAYS_BACK }, (_, i) => shiftIsoDay(today, -i));
}

function recentMonths(today: string) {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

const MONTH_SHORT = {
  ru: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  kk: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
} as const;
const MONTH_LONG = {
  ru: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'],
  kk: ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'],
} as const;

function formatDay(iso: string, lang: 'kk' | 'ru', today: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const name = MONTH_SHORT[lang][m - 1];
  return y === Number(today.slice(0, 4)) ? `${d} ${name}` : `${d} ${name} ${y}`;
}

function formatMonth(iso: string, lang: 'kk' | 'ru') {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTH_LONG[lang][m - 1]} ${y}`;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { t, toggle, lang } = useI18n();
  const today = almatyToday();
  const days = recentDays(today);
  const months = recentMonths(today);
  const [period, setPeriod] = useState<Period>('day');
  const [room, setRoom] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [label, setLabel] = useState('');
  const [me, setMe] = useState<{ place: number; total: number; points: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  async function load(next: { period?: Period; room?: string; date?: string; month?: string } = {}) {
    const nextPeriod = next.period ?? period;
    const nextRoom = next.room ?? room;
    const nextDate = next.date ?? selectedDate;
    const nextMonth = next.month ?? selectedMonth;
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const data = await leaderboardService.getLeaderboard({
        period: nextPeriod,
        room: nextRoom,
        limit: 50,
        ...(nextPeriod === 'day' && nextDate ? { date: nextDate } : {}),
        ...(nextPeriod === 'month' && nextMonth ? { month: nextMonth } : {}),
      });
      if (id !== requestId.current) return;
      setEntries(data.items ?? []);
      setLabel(data.label ?? '');
      setMe(data.me ?? null);
      if (nextPeriod === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(data.label ?? '') && data.label <= today) {
        setSelectedDate(data.label);
      }
      if (nextPeriod === 'month' && /^\d{4}-\d{2}$/.test(data.label ?? '')) {
        setSelectedMonth(data.label);
      }
    } catch (e) {
      if (id !== requestId.current) return;
      setError(apiError(e));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // Первый заход берёт текущий рейтинг-день с сервера (до 10:00 это вчера).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const caption =
    period === 'day' && selectedDate
      ? formatDay(selectedDate, lang, today)
      : period === 'month' && selectedMonth
        ? formatMonth(selectedMonth, lang)
        : label;

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
              void load({ period: item });
            }}
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${period === item ? 'bg-brand text-black' : 'bg-white/5'}`}
          >
            {t(item)}
          </button>
        ))}
      </div>
      {period === 'day' ? (
        <div className="mb-3 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {days.map((iso) => (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  setSelectedDate(iso);
                  void load({ date: iso });
                }}
                className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${selectedDate === iso ? 'bg-brand text-black' : 'bg-white/5'}`}
              >
                {formatDay(iso, lang, today)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-xs text-slate-400">
            {t('otherDay')}
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => {
                const value = e.target.value;
                if (!value || value > today) return;
                setSelectedDate(value);
                void load({ date: value });
              }}
              className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white [color-scheme:dark]"
            />
          </label>
        </div>
      ) : null}
      {period === 'month' ? (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {months.map((iso) => (
            <button
              key={iso}
              type="button"
              onClick={() => {
                setSelectedMonth(iso);
                void load({ month: iso });
              }}
              className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${selectedMonth === iso ? 'bg-brand text-black' : 'bg-white/5'}`}
            >
              {formatMonth(iso, lang)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {rooms.map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setRoom(id);
              void load({ room: id });
            }}
            className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${room === id ? 'bg-white text-black' : 'bg-white/5'}`}
          >
            {id === 'all' ? t('allRooms') : name}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm text-slate-400">{caption}</p>
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
