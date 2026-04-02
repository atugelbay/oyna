'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Phone, Calendar, Edit3, Check, X,
  LogOut, Trophy, Star, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { profileService } from '@/services/profile.service';

// ── helpers ───────────────────────────────────────────────────────
const PALETTE = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#3b82f6'];
function avatarColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

const LOYALTY_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const LOYALTY_THRESHOLDS: Record<string, number> = { BRONZE: 0, SILVER: 500, GOLD: 2000, PLATINUM: 5000 };
const LOYALTY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  BRONZE:   { bg: 'rgba(146,64,14,0.25)',  color: '#FCD34D', label: 'Bronze' },
  SILVER:   { bg: 'rgba(55,65,81,0.5)',    color: '#D1D5DB', label: 'Silver' },
  GOLD:     { bg: 'rgba(146,64,14,0.35)',  color: '#FBBF24', label: 'Gold'   },
  PLATINUM: { bg: 'rgba(22,78,99,0.5)',    color: '#67E8F9', label: 'Platinum' },
};

function getProgress(status: string, score: number) {
  const idx = LOYALTY_ORDER.indexOf(status as any);
  if (idx === -1 || idx === LOYALTY_ORDER.length - 1) return { nextLevel: null, pct: 100, pointsToNext: 0 };
  const next = LOYALTY_ORDER[idx + 1];
  const cur  = LOYALTY_THRESHOLDS[status];
  const nxt  = LOYALTY_THRESHOLDS[next];
  const pct  = Math.min(100, Math.max(0, ((score - cur) / (nxt - cur)) * 100));
  return { nextLevel: next, pct, pointsToNext: Math.max(0, nxt - score) };
}

interface FullProfile {
  id: string;
  phone: string;
  nickname: string;
  name: string | null;
  birthDate: string | null;
  loyaltyStatus: string;
  totalScore: number;
  balanceSeconds: number;
  createdAt: string;
}

// ── Editable field ────────────────────────────────────────────────
function EditField({
  label, value, onSave, type = 'text', maxLength,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: string;
  maxLength?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const start = () => { setDraft(value); setError(''); setEditing(true); };
  const cancel = () => { setEditing(false); setError(''); };

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-3 border-b border-white/5 last:border-0">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={maxLength}
            autoFocus
            className="flex-1 bg-transparent text-white text-sm outline-none border-b border-brand pb-0.5"
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          />
          <button onClick={cancel} className="text-gray-500 p-0.5"><X size={16} /></button>
          <button onClick={save} disabled={saving} className="text-brand p-0.5">
            {saving ? <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-sm">{value || <span className="text-gray-600">Не указано</span>}</p>
          <button onClick={start} className="text-gray-500 active:text-brand transition-colors p-0.5">
            <Edit3 size={15} />
          </button>
        </div>
      )}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();

  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileService.getMe()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async (field: Partial<{ name: string; nickname: string; birthDate: string }>) => {
    const updated = await profileService.updateMe(field);
    setProfile(updated);
    await refreshUser();
  };

  const handleLogout = () => {
    if (confirm('Выйти из аккаунта?')) logout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const p = profile ?? { loyaltyStatus: 'BRONZE', totalScore: 0, nickname: user?.nickname ?? '', phone: user?.phone ?? '', name: null, birthDate: null, balanceSeconds: 0, createdAt: '', id: '' };
  const ls = LOYALTY_STYLE[p.loyaltyStatus] ?? LOYALTY_STYLE['BRONZE'];
  const prog = getProgress(p.loyaltyStatus, p.totalScore);
  const color = avatarColor(p.nickname);
  const displayMinutes = Math.floor(p.balanceSeconds / 60);

  return (
    <div className="min-h-screen bg-surface pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60 transition-opacity">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">Профиль</h1>
      </div>

      {/* Avatar + name block */}
      <div className="flex flex-col items-center pt-4 pb-6 px-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black mb-3"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}88)`, color: '#090D17', boxShadow: `0 0 24px ${color}44` }}
        >
          {p.nickname.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-white text-xl font-bold">{p.nickname}</h2>
        {p.name && <p className="text-gray-400 text-sm mt-0.5">{p.name}</p>}

        {/* Loyalty badge */}
        <div
          className="flex items-center gap-1.5 mt-3 px-4 py-1.5 rounded-full"
          style={{ background: ls.bg, border: `1px solid ${ls.color}44` }}
        >
          <Star size={12} style={{ color: ls.color }} fill={ls.color} />
          <span className="text-xs font-bold tracking-wide" style={{ color: ls.color }}>
            {ls.label}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 px-4 mb-5">
        <div className="flex-1 rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-white font-bold text-xl">{displayMinutes}</p>
          <p className="text-gray-500 text-xs mt-0.5">мин на балансе</p>
        </div>
        <div className="flex-1 rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-white font-bold text-xl">{p.totalScore.toLocaleString('ru')}</p>
          <p className="text-gray-500 text-xs mt-0.5">очков</p>
        </div>
      </div>

      {/* Loyalty progress */}
      {prog.nextLevel && (
        <div className="mx-4 mb-5 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Прогресс до {prog.nextLevel}</span>
            <span className="text-xs text-brand font-medium">{prog.pointsToNext.toLocaleString('ru')} очков</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${prog.pct}%`, background: 'linear-gradient(90deg, #06b6d4, #00ff88)' }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-gray-600">
            <span>{p.loyaltyStatus}</span>
            <span>{prog.nextLevel}</span>
          </div>
        </div>
      )}

      {/* Editable info */}
      <div className="mx-4 mb-4 rounded-2xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <EditField
          label="Никнейм"
          value={p.nickname}
          maxLength={30}
          onSave={(v) => save({ nickname: v })}
        />
        <EditField
          label="Имя"
          value={p.name ?? ''}
          maxLength={60}
          onSave={(v) => save({ name: v })}
        />
        <EditField
          label="Дата рождения"
          value={p.birthDate ? p.birthDate.slice(0, 10) : ''}
          type="date"
          onSave={(v) => save({ birthDate: v })}
        />
      </div>

      {/* Contact info (read-only) */}
      <div className="mx-4 mb-4 rounded-2xl px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 py-3 border-b border-white/5">
          <Phone size={15} className="text-gray-500 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Номер телефона</p>
            <p className="text-white text-sm">{p.phone}</p>
          </div>
        </div>
        {p.createdAt && (
          <div className="flex items-center gap-3 py-3">
            <Calendar size={15} className="text-gray-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Дата регистрации</p>
              <p className="text-white text-sm">
                {new Date(p.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Shortcuts */}
      <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => router.push('/sessions')}
          className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition-colors border-b border-white/5"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <Trophy size={16} className="text-brand shrink-0" />
          <span className="flex-1 text-white text-sm text-left">История посещений</span>
          <ChevronRight size={16} className="text-gray-600" />
        </button>
        <button
          onClick={() => router.push('/tournaments')}
          className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/5 transition-colors"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <Trophy size={16} className="text-yellow-400 shrink-0" />
          <span className="flex-1 text-white text-sm text-left">Мои турниры</span>
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Logout */}
      <div className="mx-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-red-400 font-semibold active:opacity-70 transition-opacity"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <LogOut size={18} />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
