'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

function ProfileCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const code = searchParams.get('code') ?? '';
  const { register } = useAuth();

  const [nickname, setNickname] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [errors, setErrors] = useState<{ nickname?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Avatar shows first letter of nickname
  const avatarLetter = nickname.charAt(0).toUpperCase() || null;

  const validate = () => {
    const e: { nickname?: string } = {};
    if (!nickname.trim()) e.nickname = 'Введите никнейм';
    else if (nickname.length < 3) e.nickname = 'Минимум 3 символа';
    else if (!/^[a-zA-Z0-9_]+$/.test(nickname)) e.nickname = 'Только латиница, цифры и _';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setServerError('');
    setLoading(true);
    try {
      await register(phone, code, nickname, birthDate || undefined);
      router.push('/home');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (Array.isArray(msg)) {
        setServerError(msg.join(', '));
      } else {
        setServerError(msg ?? 'Ошибка при создании профиля');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-surface px-6"
      style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,208,255,0.06) 0%, #090D17 55%)',
      }}
    >
      {/* Back */}
      <div className="pt-14 pb-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-gray-500 active:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 pt-4">
        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-1">Создайте профиль игрока</h1>
        <p className="text-gray-500 text-sm mb-8">Выберите никнейм, по которому вас узнают</p>

        {/* Avatar */}
        <div className="flex justify-center mb-8">
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black text-surface"
            style={{
              background: avatarLetter
                ? 'linear-gradient(135deg, #00D0FF, #0099CC)'
                : 'rgba(0,208,255,0.15)',
              boxShadow: avatarLetter ? '0 0 30px rgba(0,208,255,0.4)' : 'none',
              border: '2px solid rgba(0,208,255,0.3)',
            }}
          >
            {avatarLetter ? (
              <span style={{ color: '#090D17' }}>{avatarLetter}</span>
            ) : (
              <User size={32} className="text-brand/40" />
            )}
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {/* Nickname */}
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                <User size={18} />
              </span>
              <input
                type="text"
                placeholder="Никнейм"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value.toLowerCase().replace(/\s/g, '_'));
                  setErrors({});
                  setServerError('');
                }}
                autoComplete="username"
                className={`w-full bg-surface-input border rounded-xl pl-11 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none transition-colors text-base ${
                  errors.nickname ? 'border-red-500/70' : 'border-white/10 focus:border-brand/50'
                }`}
              />
            </div>
            {errors.nickname && (
              <span className="text-xs text-red-400">{errors.nickname}</span>
            )}
          </div>

          {/* Birthday */}
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <Calendar size={18} />
            </span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full bg-surface-input border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand/50 transition-colors text-base [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Server error */}
        {serverError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
            {serverError}
          </div>
        )}

        {/* Submit */}
        <div className="mt-auto pb-10 pt-6">
          <Button type="submit" loading={loading}>
            Создать аккаунт
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProfileCreatePage() {
  return (
    <Suspense>
      <ProfileCreateForm />
    </Suspense>
  );
}
