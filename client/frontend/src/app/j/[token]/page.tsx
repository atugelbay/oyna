"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ScanLine,
  MapPin,
  Check,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Brand } from "@/components/ui/Brand";
import { useAuth } from "@/lib/auth-context";
import { balanceService } from "@/services/balance.service";
import api from "@/lib/api";
import { apiError } from "@/lib/api-error";
import { rememberLobby, completeLobby } from "@/lib/pending-lobby";
type Preview = {
  roomId: string;
  roomName: string;
  venueName: string;
  expiresAt: string | null;
  expired: boolean;
  minBalanceMinutes: number;
};
type Joined = { roomName: string; minutesLeft: number; message: string };
export default function LobbyJoinPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [joining, setJoining] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (joined) return;
    rememberLobby(token);
    if (!authLoading && !user) router.replace("/welcome");
  }, [token, user, authLoading, joined, router]);
  useEffect(() => {
    setJoined(null);
  }, [token]);
  useEffect(() => {
    let active = true;
    setLoadError("");
    setPreview(null);
    api
      .get<Preview>(`/lobby/join/${encodeURIComponent(token)}`)
      .then((r) => {
        if (active) setPreview(r.data);
      })
      .catch((e) => {
        if (active)
          setLoadError(
            apiError(
              e,
              "QR-код не найден. Отсканируйте новый код на экране комнаты.",
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [token, revision]);
  useEffect(() => {
    if (!user) {
      setSeconds(null);
      return;
    }
    let active = true;
    async function refresh() {
      try {
        const b = await balanceService.getBalance();
        if (active) {
          setSeconds(b.availableSeconds);
          setBalanceError("");
        }
      } catch (e) {
        if (active) {
          setSeconds(null);
          setBalanceError(apiError(e));
        }
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [user, revision, token]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired =
    preview?.expired ||
    !!(preview?.expiresAt && Date.parse(preview.expiresAt) <= now);
  const minimum = preview?.minBalanceMinutes ?? 10;
  const low = seconds !== null && seconds < minimum * 60;
  async function join() {
    if (!user || joining || expired || low || seconds === null) return;
    setJoining(true);
    setJoinError("");
    try {
      const { data } = await api.post<Joined>(
        `/lobby/join/${encodeURIComponent(token)}`,
      );
      completeLobby(token);
      setJoined(data);
    } catch (e) {
      setJoinError(
        apiError(e, "Не удалось войти в лобби. Попробуйте ещё раз."),
      );
    } finally {
      setJoining(false);
    }
  }
  function login() {
    rememberLobby(token);
    router.push("/welcome");
  }
  if (!authLoading && !user)
    return (
      <div role="status" className="p-10 text-center text-sm text-slate-400">
        Открываем вход в OYNA…
      </div>
    );
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col px-6 pb-10 pt-7">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href={user ? "/home" : "/welcome"}
          aria-label="В кабинет"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-slate-400"
        >
          <ArrowLeft size={20} />
        </Link>
        <Brand />
      </header>
      <div
        className={`mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border ${joined ? "border-[#ccfc64]/30 bg-[#ccfc64]/10 text-[#ccfc64]" : "border-brand/30 bg-brand/10 text-brand"}`}
      >
        {joined ? <Check size={30} /> : <ScanLine size={30} />}
      </div>
      <p className="eyebrow mb-3">
        {joined ? "Всё готово" : "Твой пропуск в игру"}
      </p>
      <h1 className="mb-3 text-3xl font-extrabold tracking-tight">
        {joined ? "Ты в лобби!" : "Присоединиться к игре"}
      </h1>
      {loadError ? (
        <div role="alert" className="panel mt-5 p-5">
          <p className="text-sm text-red-400">{loadError}</p>
          <button
            onClick={() => setRevision((v) => v + 1)}
            className="mt-4 flex min-h-11 items-center gap-2 text-sm text-brand"
          >
            <RefreshCw size={16} />
            Повторить
          </button>
        </div>
      ) : !preview || authLoading ? (
        <p role="status" className="py-8 text-sm text-slate-400">
          Проверяем комнату и аккаунт…
        </p>
      ) : (
        <>
          <div className="arena-art mb-6 mt-4 rounded-3xl border border-brand/20 p-6">
            <p className="eyebrow mb-3 !text-brand">Комната</p>
            <h2 className="text-3xl font-bold tracking-tight">
              {preview.roomName}
            </h2>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <MapPin size={14} />
              {preview.venueName}
            </p>
          </div>
          {joined ? (
            <>
              <p className="text-lg font-semibold">
                Ждите старт на экране комнаты
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                На экране комнаты выберите режим и нажмите «НАЧАТЬ ИГРУ». Минуты
                спишутся только при старте.
              </p>
              <p className="my-6 flex items-center gap-2 text-sm text-brand">
                <Clock3 size={17} />
                На балансе {joined.minutesLeft} мин
              </p>
              <Button onClick={() => router.push("/home")}>
                В личный кабинет
              </Button>
            </>
          ) : expired ? (
            <div role="alert" className="panel p-5">
              <h2 className="mb-2 font-bold text-amber-300">
                Время QR-кода истекло
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Попросите на ресепшене обновить код, затем отсканируйте QR на
                экране комнаты ещё раз.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-5 text-sm leading-relaxed text-slate-400">
                {user
                  ? `${user.nickname}, войди в лобби и дождись своего ника на экране комнаты.`
                  : "Войди в аккаунт, чтобы присоединиться к комнате. После входа ты вернёшься сюда."}
              </p>
              {user && (
                <div className="panel mb-5 flex items-center justify-between p-4 text-sm">
                  <span className="text-slate-400">Твой баланс</span>
                  <span className={low ? "text-amber-300" : "text-brand"}>
                    {seconds === null ? "—" : `${Math.floor(seconds / 60)} мин`}
                  </span>
                </div>
              )}
              {low && (
                <p
                  role="alert"
                  className="mb-4 text-sm leading-relaxed text-amber-300"
                >
                  Недостаточно минут на балансе. Пополните баланс на ресепшене.
                  Для входа нужно {minimum} минут.
                </p>
              )}
              {(joinError || balanceError) && (
                <p role="alert" className="mb-4 text-sm text-red-400">
                  {joinError || balanceError}
                </p>
              )}
              {user ? (
                <>
                  <Button
                    loading={joining}
                    disabled={low || seconds === null}
                    onClick={join}
                  >
                    Войти в лобби
                  </Button>
                  <button
                    onClick={() => setRevision((v) => v + 1)}
                    className="my-2 min-h-11 text-xs font-semibold text-brand"
                  >
                    Обновить баланс и QR
                  </button>
                </>
              ) : (
                <Button onClick={login}>Войти и продолжить</Button>
              )}
              <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
                Минимум {minimum} минут на балансе.
                <br />
                При входе в лобби минуты не списываются.
              </p>
            </>
          )}
        </>
      )}
    </main>
  );
}
