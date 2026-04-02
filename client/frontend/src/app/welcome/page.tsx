'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';

export default function WelcomePage() {
  const router = useRouter();
  const { requestOtp } = useAuth();

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) { setError('Введите номер телефона'); return; }
    setError('');
    setLoading(true);
    try {
      await requestOtp(phone);
      router.push(`/auth/verify?phone=${encodeURIComponent(phone)}`);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-surface"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,208,255,0.08) 0%, #090D17 60%)',
      }}
    >
      {/* Top area — logo */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-20 pb-6">
        {/* Tagline */}
        <p className="text-gray-400 text-sm tracking-widest uppercase mb-4 text-center">
          Начните новый профиль!
        </p>

        {/* OYNA logo */}
        <h1
          className="text-7xl font-black tracking-tighter mb-2"
          style={{
            color: '#00D0FF',
            textShadow: '0 0 30px rgba(0,208,255,0.5), 0 0 60px rgba(0,208,255,0.2)',
            fontStyle: 'italic',
          }}
        >
          OYNA
        </h1>

        <p className="text-gray-500 text-sm text-center mt-2 mb-10">
          Игровой центр нового поколения
        </p>

        {/* Phone form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
              <Phone size={18} />
            </span>
            <input
              type="tel"
              placeholder="+7 700 000 00 00"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(''); }}
              autoComplete="tel"
              className="w-full bg-surface-input border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-brand/50 transition-colors text-base"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <Button type="submit" loading={loading}>
            Продолжить
          </Button>
        </form>
      </div>

      {/* Bottom decoration */}
      <div className="px-8 pb-10 text-center">
        <p className="text-gray-600 text-xs leading-relaxed">
          Нажимая «Продолжить», вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
}
