"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";
import { SegmentBadge } from "@/components/crm/SegmentBadge";
import { readApiUserError } from "@/lib/api-error-message";
import { playersService } from "@/services/players.service";
import { formatTenge } from "@/lib/money";
import { payMethodLabel, saleStatusLabel, sessionOutcomeLabel } from "@/lib/crm-labels";
import api from "@/lib/api";
import type { Segment } from "@/app/(crm)/(panel)/players/types";

interface PlayerProfileModalProps {
  playerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Устарело: пополнение теперь только в Кассе. Оставлено для совместимости вызовов. */
  initialTopUpOpen?: boolean;
}

type Card = {
  balance: { line: string; paidMinutes: number; bonusMinutes: number };
  payments: {
    id: string;
    number: number;
    at: string;
    status: string;
    totalTenge: number;
    refundTenge: number;
    isBarter: boolean;
    items: string;
    methods: string[];
    minutes: number;
  }[];
  sessions: { id: string; at: string; room: string; mode: string; outcome: string; minutes: number }[];
  compensations: { id: string; at: string; minutes: number; note: string }[];
};

type Tab = "payments" | "sessions" | "compensations";

function when(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Asia/Almaty",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlayerProfileModal({ playerId, isOpen, onClose }: PlayerProfileModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [player, setPlayer] = useState<Record<string, unknown> | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("payments");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !playerId) {
      setPlayer(null);
      setCard(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setTab("payments");
    Promise.all([playersService.getById(playerId), api.get(`/players/${playerId}/card`).then((r) => r.data)])
      .then(([p, c]) => {
        if (cancelled) return;
        setPlayer(p as Record<string, unknown>);
        setCard(c as Card);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(readApiUserError(err, "Ошибка загрузки"));
          setPlayer(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, playerId]);

  if (!mounted) return null;
  if (!isOpen || !playerId) return null;

  const nickname = String(player?.nickname ?? "");
  const points = Number(player?.totalScore ?? 0);

  const body = loading ? (
    <div className="animate-pulse space-y-4">
      <div className="h-36 rounded-xl bg-[#1F2B38]" />
      <div className="h-24 rounded-xl bg-[#1F2B38]" />
      <div className="h-40 rounded-xl bg-[#1F2B38]" />
    </div>
  ) : error || !player ? (
    <p className="text-sm text-text-secondary">{error || "Игрок не найден."}</p>
  ) : (
    <>
      <div className="relative pt-9">
        <div className="relative rounded-xl bg-[#1F2B38] px-5 pb-5 pt-11">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <Avatar letter={nickname[0]?.toUpperCase()} size={76} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-lg font-semibold text-text-primary">{nickname}</p>
            <SegmentBadge segment={player.segment as Segment} />
            <p className="text-xs text-text-secondary">
              {String(player.status ?? "")} · {points.toLocaleString("ru-RU")} очков · сеансов {Number(player.sessionsCount ?? 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#1F2B38] px-5 py-4">
        <p className="mb-2 text-xs text-text-secondary">Баланс</p>
        <div className="flex items-center justify-between gap-4">
          <p className="text-lg font-semibold tabular-nums text-text-primary">
            {card?.balance.line ?? `${Number(player.balanceMinutes ?? 0)} мин`}
          </p>
          <button
            type="button"
            onClick={() => router.push(`/cash?player=${playerId}`)}
            className="shrink-0 rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
          >
            Продать
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#1F2B38] px-5 py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["payments", `Оплаты (${card?.payments.length ?? 0})`],
              ["sessions", `Сеансы (${card?.sessions.length ?? 0})`],
              ["compensations", `Компенсации (${card?.compensations.length ?? 0})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-9 rounded-lg px-3 text-xs ${tab === id ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <ul className="space-y-2 text-sm">
          {tab === "payments" &&
            (card?.payments.length ? (
              card.payments.map((p) => (
                <li key={p.id}>
                  <p className="text-text-primary">
                    №{p.number} · {p.isBarter ? "Бартер" : formatTenge(p.totalTenge)}
                    {p.minutes ? ` · +${p.minutes} мин` : ""}
                    {p.status !== "COMPLETED" ? ` · ${saleStatusLabel(p.status)}` : ""}
                    {p.refundTenge ? ` · возврат ${formatTenge(p.refundTenge)}` : ""}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {when(p.at)} · {p.items}
                    {p.methods.length ? ` · ${p.methods.map(payMethodLabel).join(" + ")}` : ""}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-text-secondary">Оплат нет</li>
            ))}
          {tab === "sessions" &&
            (card?.sessions.length ? (
              card.sessions.map((s) => (
                <li key={s.id}>
                  <p className="text-text-primary">
                    {s.room} · {s.mode} · {s.minutes} мин
                  </p>
                  <p className="text-xs text-text-secondary">
                    {when(s.at)} · {sessionOutcomeLabel(s.outcome)}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-text-secondary">Сеансов нет</li>
            ))}
          {tab === "compensations" &&
            (card?.compensations.length ? (
              card.compensations.map((c) => (
                <li key={c.id}>
                  <p className="text-text-primary">+{c.minutes} бонусных мин</p>
                  <p className="text-xs text-text-secondary">
                    {when(c.at)} · {c.note}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-text-secondary">Компенсаций нет</li>
            ))}
        </ul>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-[200] h-[100dvh] w-full max-w-[100vw]">
      <button
        type="button"
        className="absolute inset-0 h-full min-h-[100dvh] w-full border-0 bg-black/25 p-0 backdrop-blur-xl"
        onClick={onClose}
        aria-label="Закрыть"
      />
      <div
        className="absolute bottom-0 left-1/2 top-0 z-10 flex w-full max-w-xl -translate-x-1/2 flex-col bg-[#141C26] shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-6 py-6">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 id="player-profile-title" className="text-lg font-semibold text-white">
                Профиль игрока
              </h2>
            </div>
            {body}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
