"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Brand } from "@/components/ui/Brand";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth-context";
import { apiError } from "@/lib/api-error";
import {
  afterAuthentication,
  normalizePhone,
  pendingLobby,
} from "@/lib/pending-lobby";

function PasswordField({
  id,
  label,
  value,
  onChange,
  registration = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  registration?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-xs font-semibold text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={registration ? "new-password" : "current-password"}
          required
          className="input-field pr-14"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Скрыть: ${label}` : `Показать: ${label}`}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-slate-400"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const registering = mode === "register";
  const router = useRouter();
  const { user, loading, login, register } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fromRoom, setFromRoom] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);

  useEffect(() => {
    setFromRoom(!!pendingLobby());
    if (!loading && user) router.replace(afterAuthentication());
  }, [user, loading, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const normalizedPhone = normalizePhone(phone);
    if (registering) {
      if (!/^(?=.*[a-zA-Z])[a-zA-Z0-9_]{3,32}$/.test(nickname.trim())) {
        setError(
          "Никнейм: 3–32 символа, латиница, цифры и _. Добавь хотя бы одну букву.",
        );
        return;
      }
      if (!normalizedPhone) {
        setError("Введи номер в формате +7 700 000 00 00");
        return;
      }
      if (password.length < 8) {
        setError("В пароле должно быть минимум 8 символов");
        return;
      }
      if (password !== confirmation) {
        setError("Пароли не совпадают");
        return;
      }
      if (!offerAccepted || !privacyAccepted || !guardianConfirmed) {
        setError("Нужны согласие с офертой, согласие на данные и подтверждение родителя");
        return;
      }
    } else if (!identifier.trim() || !password) {
      setError("Введи никнейм или телефон и пароль");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Пароль слишком длинный. Максимум 72 байта.");
      return;
    }
    setSubmitting(true);
    try {
      if (registering)
        await register(
          normalizedPhone!,
          password,
          nickname.trim().toLowerCase(),
          birthDate || undefined,
          { offerAccepted, privacyAccepted, guardianConfirmed },
        );
      else await login(identifier.trim(), password);
      router.replace(afterAuthentication());
    } catch (e) {
      setError(
        apiError(
          e,
          registering
            ? "Не удалось создать аккаунт. Попробуй ещё раз."
            : "Не удалось войти. Проверь логин и пароль.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user)
    return (
      <div role="status" className="p-10 text-center text-sm text-slate-400">
        Проверяем сессию…
      </div>
    );

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-[440px] flex-col px-6 pb-10 pt-7 md:min-h-[calc(100dvh-58px)]">
      <header className="mb-9 flex items-center justify-between">
        <Link
          href="/welcome"
          aria-label="Назад"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <Brand />
      </header>
      <p className="eyebrow mb-3 !text-brand">
        {registering ? "Твой игровой профиль" : "С возвращением"}
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight">
        {registering ? "Создать аккаунт" : "Войти в OYNA"}
      </h1>
      <p className="mb-7 mt-3 text-sm leading-relaxed text-slate-400">
        {fromRoom
          ? "После входа ты продолжишь в выбранной комнате."
          : registering
            ? "Задай пароль. Он понадобится для входа по нику или телефону."
            : "Введи никнейм или телефон и свой пароль."}
      </p>
      <form onSubmit={submit} className="space-y-4">
        {registering ? (
          <>
            <div>
              <label
                htmlFor="nickname"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Никнейм
              </label>
              <input
                id="nickname"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={32}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="input-field"
                placeholder="player_one"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                От 3 до 32 символов: латиница, цифры и _
              </p>
            </div>
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Номер телефона
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="+7 700 000 00 00"
              />
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-xs font-semibold text-slate-300"
            >
              Никнейм или телефон
            </label>
            <input
              id="identifier"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="input-field"
              placeholder="player_one или +7 700 000 00 00"
            />
          </div>
        )}
        <PasswordField
          id="password"
          label="Пароль"
          value={password}
          onChange={setPassword}
          registration={registering}
        />
        {registering && (
          <>
            <p className="text-[11px] text-slate-500">Минимум 8 символов</p>
            <PasswordField
              id="confirmation"
              label="Повтори пароль"
              value={confirmation}
              onChange={setConfirmation}
              registration
            />
            <div>
              <label
                htmlFor="birthDate"
                className="mb-2 block text-xs font-semibold text-slate-300"
              >
                Дата рождения{" "}
                <span className="font-normal text-slate-500">
                  · необязательно
                </span>
              </label>
              <input
                id="birthDate"
                type="date"
                autoComplete="bday"
                max={new Date().toLocaleDateString("en-CA")}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="input-field"
              />
            </div>
            <label className="flex min-h-11 items-start gap-3 text-xs leading-relaxed text-slate-300">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={offerAccepted} onChange={(e) => setOfferAccepted(e.target.checked)} />
              <span>Согласен с <Link href="/offer" className="text-brand">публичной офертой</Link>. Оплаченные минуты действуют 24 часа.</span>
            </label>
            <label className="flex min-h-11 items-start gap-3 text-xs leading-relaxed text-slate-300">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
              <span>Согласен на <Link href="/privacy" className="text-brand">сбор и обработку персональных данных</Link>.</span>
            </label>
            <label className="flex min-h-11 items-start gap-3 text-xs leading-relaxed text-slate-300">
              <input type="checkbox" className="mt-1 h-5 w-5" checked={guardianConfirmed} onChange={(e) => setGuardianConfirmed(e.target.checked)} />
              <span>Регистрирую себя (18+) или своего ребёнка как родитель / законный представитель.</span>
            </label>
          </>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-500/10 p-3 text-sm leading-relaxed text-red-400"
          >
            {error}
          </p>
        )}
        <Button type="submit" loading={submitting} className="!shadow-none">
          {registering ? "Создать аккаунт" : "Войти"}
          <ArrowRight size={18} />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        {registering ? "Уже есть аккаунт?" : "Впервые в OYNA?"}{" "}
        <Link
          href={registering ? "/auth/login" : "/auth/register"}
          className="inline-flex min-h-11 items-center font-semibold text-brand"
        >
          {registering ? "Войти" : "Зарегистрироваться"}
        </Link>
      </p>
    </main>
  );
}
