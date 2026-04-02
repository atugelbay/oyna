'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QrCode, Trophy, ChevronDown, Check, Tag, Gamepad2, Plus, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { balanceService } from '@/services/balance.service';
import { promosService } from '@/services/promos.service';
import { leaderboardService } from '@/services/leaderboard.service';
import { venuesService } from '@/services/venues.service';
import api from '@/lib/api';

// ── helpers ──────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#00D0FF', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

const LOYALTY_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const LOYALTY_THRESHOLDS: Record<string, number> = { BRONZE: 0, SILVER: 500, GOLD: 2000, PLATINUM: 5000 };
const LOYALTY_BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  BRONZE:   { bg: '#92400E', color: '#FCD34D' },
  SILVER:   { bg: '#374151', color: '#D1D5DB' },
  GOLD:     { bg: '#92400E', color: '#FBBF24' },
  PLATINUM: { bg: '#164E63', color: '#67E8F9' },
};

function getProgress(status: string, score: number) {
  const idx = LOYALTY_ORDER.indexOf(status as any);
  if (idx === -1 || idx === LOYALTY_ORDER.length - 1) {
    return { nextLevel: null, pointsToNext: 0, pct: 100 };
  }
  const next = LOYALTY_ORDER[idx + 1];
  const cur = LOYALTY_THRESHOLDS[status];
  const nxt = LOYALTY_THRESHOLDS[next];
  const pct = Math.min(100, Math.max(0, ((score - cur) / (nxt - cur)) * 100));
  return { nextLevel: next, pointsToNext: Math.max(0, nxt - score), pct };
}

const PODIUM: Record<number, { podBg: string; avatarBg: string; ht: string }> = {
  1: { podBg: '#78350F', avatarBg: '#F59E0B', ht: 'h-28' },
  2: { podBg: '#1F2937', avatarBg: '#9CA3AF', ht: 'h-20' },
  3: { podBg: '#431407', avatarBg: '#C2410C', ht: 'h-20' },
};

interface LBEntry { rank: number; id: string; nickname: string; totalScore: number; loyaltyStatus: string; }
interface Venue    { id: string; name: string; address: string; city: string; }
interface ActiveTournament {
  isCaptain: boolean;
  team: { id: string; name: string; membersCount: number };
  tournament: { id: string; name: string; dateEnd: string; status: string };
}

// ── component ────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [balance, setBalance]           = useState<any>(null);
  const [promos, setPromos]             = useState<any[]>([]);
  const [leaderboard, setLB]            = useState<LBEntry[]>([]);
  const [venues, setVenues]             = useState<Venue[]>([]);
  const [venueId, setVenueId]           = useState<string | null>(null);
  const [venueOpen, setVenueOpen]       = useState(false);
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const selectedVenue = venues.find((v) => v.id === venueId) ?? venues[0] ?? null;

  useEffect(() => {
    balanceService.getBalance().then(setBalance).catch(() => {});
    leaderboardService.getLeaderboard(50).then(setLB).catch(() => {});
    venuesService.getVenues().then((list) => { setVenues(list); if (list[0]) setVenueId(list[0].id); }).catch(() => {});
    api.get('/tournaments/my-active').then((r) => setActiveTournament(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    promosService.getActivePromos(venueId ?? undefined).then(setPromos).catch(() => {});
  }, [venueId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setVenueOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const top3       = leaderboard.slice(0, 3);
  const podiumShow = [top3[1], top3[0], top3[2]] as (LBEntry | undefined)[];
  const podiumRank = [2, 1, 3];
  const myEntry    = leaderboard.find((e) => e.id === user?.id);
  const prog       = getProgress(user?.loyaltyStatus ?? 'BRONZE', user?.totalScore ?? 0);
  const badge      = LOYALTY_BADGE_STYLE[user?.loyaltyStatus ?? 'BRONZE'];
  const estSessions = balance ? Math.floor(balance.displayMinutes / 35) : null;

  return (
    <div className="pb-8">

      {/* ── Top nav ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-12 pb-4">
        <span
          className="text-2xl font-black tracking-tight"
          style={{ color: '#00D0FF', textShadow: '0 0 16px rgba(0,208,255,0.4)', fontStyle: 'italic' }}
        >
          OYNA
        </span>

        {/* Venue selector */}
        <div className="relative" ref={dropRef}>
          <button
            onClick={() => setVenueOpen((p) => !p)}
            className="flex items-center gap-1.5 bg-surface-elevated border border-white/10 rounded-xl px-3 py-1.5"
          >
            <span className="text-gray-400 text-xs">Точка:</span>
            <span className="text-white text-xs font-semibold max-w-[110px] truncate">
              {selectedVenue?.name ?? '…'}
            </span>
            <ChevronDown size={13} className={`text-gray-400 transition-transform ${venueOpen ? 'rotate-180' : ''}`} />
          </button>

          {venueOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-surface-card border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden">
              {venues.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { setVenueId(v.id); setVenueOpen(false); }}
                  className="w-full flex items-start justify-between gap-2 px-4 py-3 active:bg-surface-elevated text-left"
                >
                  <div>
                    <p className="text-white text-sm font-semibold">{v.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{v.address}</p>
                  </div>
                  {v.id === (venueId ?? venues[0]?.id) && (
                    <Check size={16} className="text-brand mt-0.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── События ─────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-gray-400 text-xs font-medium uppercase tracking-wider px-4 mb-2">События</p>

        {/* Scrollable cards */}
        <div className="flex gap-3 overflow-x-auto pb-1 px-4 no-scrollbar">
          {promos.length > 0 ? promos.map((p) => (
            <div
              key={p.id}
              className="shrink-0 w-52 h-28 rounded-2xl overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg, #0f1e3d, #0d1a33)' }}
            >
              {/* Decorative triangles like in design */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(0,208,255,0.3) 0%, transparent 60%)',
              }} />
              <div className="absolute inset-0 p-3 flex flex-col justify-end">
                <p className="text-white font-bold text-sm leading-tight">{p.title}</p>
                {p.reward && <p className="text-brand text-xs mt-0.5">{p.reward}</p>}
              </div>
            </div>
          )) : (
            <div
              className="shrink-0 w-52 h-28 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #0f1e3d, #0d1a33)' }}
            >
              <Gamepad2 size={28} className="text-brand/30" />
            </div>
          )}
        </div>

        {/* Round category buttons */}
        <div className="flex gap-4 px-4 mt-3">
          <Link href="/promos">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,208,255,0.15)', border: '1px solid rgba(0,208,255,0.25)' }}>
                <Tag size={22} className="text-brand" />
              </div>
              <span className="text-white text-xs font-medium">Акции</span>
            </div>
          </Link>
          <Link href="/tournaments">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,208,255,0.15)', border: '1px solid rgba(0,208,255,0.25)' }}>
                <Trophy size={22} className="text-brand" />
              </div>
              <span className="text-white text-xs font-medium">Турниры</span>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Мой профиль ─────────────────────────────────────── */}
      <div className="mx-4 mb-5 bg-surface-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white text-sm font-semibold">Мой профиль</span>
          <Link href="/sessions" className="text-brand text-xs font-medium">
            История посещений
          </Link>
        </div>

        {/* Avatar row */}
        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-3 mb-4 w-full active:opacity-70 transition-opacity"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{
              background: `linear-gradient(135deg, ${avatarColor(user?.nickname ?? 'N')}, ${avatarColor(user?.nickname ?? 'N')}99)`,
              color: '#090D17',
            }}
          >
            {(user?.nickname ?? 'N').charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-semibold flex-1 truncate text-left">{user?.nickname}</span>
          {badge && (
            <span
              className="px-2.5 py-1 rounded-md text-xs font-bold tracking-wide shrink-0"
              style={{ background: badge.bg, color: badge.color }}
            >
              {user?.loyaltyStatus}
            </span>
          )}
        </button>

        {/* Tournament banner */}
        {activeTournament && (
          <button
            onClick={() => router.push(`/tournaments/${activeTournament.tournament.id}`)}
            className="w-full text-left rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2.5 active:opacity-70 transition-opacity"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(6,182,212,0.15)' }}>
              <Trophy size={14} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">
                Команда {activeTournament.team.name}
              </p>
              <p className="text-gray-400 text-xs truncate">
                {activeTournament.isCaptain
                  ? 'Вы капитан. Приглашайте других.'
                  : 'Вы участник турнира. Приглашайте других.'}
              </p>
            </div>
            <div className="flex items-center gap-1 text-gray-500 shrink-0">
              <Users size={11} />
              <span className="text-xs">{activeTournament.team.membersCount}</span>
            </div>
          </button>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Balance */}
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-2">Мой баланс</p>
            <p className="text-white font-bold text-2xl leading-none">
              {balance ? `${balance.displayMinutes} мин` : '—'}
            </p>
            {estSessions !== null && (
              <p className="text-gray-500 text-xs mt-1.5">
                ≈ доступно {estSessions} сессии
              </p>
            )}
            <button
              onClick={() => {}}
              className="flex items-center gap-1 mt-3 border border-brand/40 text-brand text-xs font-semibold px-3 py-1.5 rounded-lg active:bg-brand/10 transition-colors"
            >
              <Plus size={12} />
              Пополнить
            </button>
          </div>

          {/* Progress */}
          <div className="bg-surface-elevated rounded-xl p-3">
            <p className="text-gray-500 text-xs mb-2">Прогресс</p>
            <p className="text-white font-bold text-2xl leading-none">
              {(user?.totalScore ?? 0).toLocaleString('ru')}
            </p>
            <p className="text-gray-500 text-xs mt-1">моих очков</p>

            {prog.nextLevel && (
              <>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-surface-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${prog.pct}%`,
                      background: 'linear-gradient(90deg, #00D0FF, #00FF88)',
                    }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: '#00FF88' }}
                  />
                  <span className="text-gray-500 text-xs">
                    {prog.pointsToNext.toLocaleString('ru')} очков до {prog.nextLevel}
                  </span>
                </div>
              </>
            )}
            {!prog.nextLevel && (
              <p className="text-brand text-xs mt-2 font-semibold">Максимальный уровень</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Таблица лидеров ─────────────────────────────────── */}
      {leaderboard.length > 0 && (
        <div className="mx-4">
          <p className="text-white text-sm font-semibold mb-5 text-center">Таблица лидеров</p>

          {/* Podium */}
          {top3.length >= 3 && (
            <div className="flex items-end justify-center gap-2 mb-6">
              {podiumShow.map((entry, idx) => {
                if (!entry) return null;
                const rank = podiumRank[idx];
                const s = PODIUM[rank];
                const isMe = entry.id === user?.id;
                return (
                  <div key={entry.id} className="flex flex-col items-center" style={{ width: 96 }}>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-base font-black mb-1.5 shrink-0"
                      style={{ background: s.avatarBg, color: '#090D17' }}
                    >
                      {entry.nickname.charAt(0).toUpperCase()}
                    </div>
                    <p className={`text-xs font-semibold truncate w-full text-center ${isMe ? 'text-brand' : 'text-white'}`}>
                      {entry.nickname}
                    </p>
                    <p className="text-gray-400 text-xs mb-1.5">{entry.totalScore.toLocaleString('ru')}</p>
                    <div
                      className={`w-full rounded-t-xl flex items-center justify-center font-black text-xl text-white/70 ${s.ht}`}
                      style={{ background: s.podBg }}
                    >
                      {rank}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* List header */}
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-gray-600 text-xs">Никнейм</span>
            <span className="text-gray-600 text-xs">Результат</span>
          </div>

          {/* List rows */}
          {leaderboard.map((entry) => {
            const isMe = entry.id === user?.id;
            const color = avatarColor(entry.nickname);
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 py-2.5 border-b border-white/5 ${isMe ? 'bg-brand/5 -mx-4 px-5 rounded-xl' : 'px-1'}`}
              >
                <span className="w-5 text-gray-600 text-xs text-right shrink-0">{entry.rank}</span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: color, color: '#090D17' }}
                >
                  {entry.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="flex-1 text-white text-sm font-medium truncate">
                  {entry.nickname}
                  {isMe && <span className="ml-2 text-brand text-xs font-normal">Вы</span>}
                </span>
                <span className="text-white text-sm font-semibold shrink-0">
                  {entry.totalScore.toLocaleString('ru')}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Floating QR ─────────────────────────────────────── */}
      <div className="fixed bottom-6 right-4 z-40">
        <button
          className="flex items-center gap-2 px-4 py-3 rounded-2xl font-semibold text-sm"
          style={{
            background: 'linear-gradient(135deg, #00D0FF, #00A8CC)',
            color: '#090D17',
            boxShadow: '0 4px 20px rgba(0,208,255,0.45)',
          }}
        >
          <QrCode size={18} />
          Скан QR
        </button>
      </div>
    </div>
  );
}
