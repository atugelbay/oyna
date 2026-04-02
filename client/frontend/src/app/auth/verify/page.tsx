'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { useAuth } from '@/lib/auth-context';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') ?? '';
  const { verifyOtp, requestOtp } = useAuth();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [serverError, setServerError] = useState('');
  const [otpError, setOtpError] = useState(false);

  const handleComplete = async (code: string) => {
    setServerError('');
    setOtpError(false);
    setLoading(true);
    try {
      const result = await verifyOtp(phone, code);
      if (result.needsProfile) {
        // New user → go to profile creation, carry phone + code
        router.push(`/auth/profile?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`);
      } else {
        // Existing user → go home
        router.push('/home');
      }
    } catch (err: any) {
      setOtpError(true);
      setServerError(err.response?.data?.message ?? 'Неверный код. Попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setServerError('');
    setOtpError(false);
    try {
      await requestOtp(phone);
    } catch (err: any) {
      setServerError(err.response?.data?.message ?? 'Не удалось отправить код');
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-surface px-6"
      style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,208,255,0.06) 0%, #090D17 55%)',
      }}
    >
      {/* Back button */}
      <div className="pt-14 pb-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 text-gray-500 active:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
      </div>

      <div className="flex flex-col flex-1 pt-6">
        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">Введите SMS-код</h1>
        <p className="text-gray-500 text-sm mb-1">Код отправлен на номер</p>
        <p className="text-brand font-semibold text-base mb-10">{phone}</p>

        {/* OTP boxes */}
        <OtpInput length={4} onComplete={handleComplete} disabled={loading} error={otpError} />

        {/* Loading state */}
        {loading && (
          <div className="mt-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
            <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            Проверяем код...
          </div>
        )}

        {/* Error */}
        {serverError && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm text-center">
            {serverError}
          </div>
        )}

        {/* MVP hint */}
        <div className="mt-6 bg-brand/5 border border-brand/15 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">
            Тестовый код: <span className="text-brand font-bold tracking-widest">1234</span>
          </p>
        </div>

        {/* Resend */}
        <div className="mt-auto pb-10 space-y-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full text-brand text-sm font-medium py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {resending && <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />}
            Отправить код повторно
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
