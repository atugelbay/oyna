"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ScanLine, Zap } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { useAuth } from "@/lib/auth-context";
import { afterAuthentication, pendingLobby } from "@/lib/pending-lobby";

export default function WelcomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [fromRoom, setFromRoom] = useState(false);

  useEffect(() => {
    setFromRoom(!!pendingLobby());
    if (!loading && user) router.replace(afterAuthentication());
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div role="status" className="p-10 text-center text-sm text-slate-400">
        Открываем твой профиль…
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col px-6 pb-8 pt-8 md:min-h-[calc(100dvh-58px)] md:py-12">
      <header className="flex items-center justify-between">
        <Brand />
        <span className="eyebrow rounded-full border border-white/10 px-3 py-2">
          PLAYER CLUB
        </span>
      </header>
      <div className="welcome-orbit" aria-hidden="true">
        <i />
        <ScanLine size={62} strokeWidth={1.2} className="relative text-brand" />
        <span />
        <span />
      </div>
      <div className="mb-8">
        <p className="eyebrow mb-3 flex items-center gap-2">
          <Zap size={12} className="text-brand" />
          Твой следующий уровень
        </p>
        <h1 className="text-[44px] font-extrabold leading-[1.04] tracking-[-.055em]">
          Меньше скролла.
          <br />
          <span className="text-brand">Больше игры.</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          {fromRoom
            ? "Твоя комната уже ждёт. Войди или создай аккаунт — затем присоединишься к лобби."
            : "Твои минуты, результаты и место в рейтинге — в одном игровом профиле."}
        </p>
      </div>
      <div className="space-y-3">
        <Link
          href="/auth/login"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-bold text-surface"
        >
          Войти
          <ArrowRight size={18} />
        </Link>
        <Link
          href="/auth/register"
          className="flex min-h-14 items-center justify-center rounded-xl border border-white/15 bg-surface-card px-5 font-semibold text-white"
        >
          Зарегистрироваться
        </Link>
        <p className="pt-2 text-center text-xs text-slate-500">
          Вход по никнейму или телефону и паролю
        </p>
      </div>
      <footer className="mt-auto pt-10">
        <div className="flex items-center gap-3 border-t border-white/10 pt-5">
          <span className="h-2 w-2 rounded-full bg-[#ccfc64]" />
          <p className="text-xs text-slate-500">
            Реальные эмоции. Реальные рекорды.
          </p>
        </div>
      </footer>
    </main>
  );
}
