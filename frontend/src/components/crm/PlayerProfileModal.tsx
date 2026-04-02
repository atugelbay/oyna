"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui";
import { BalanceTopUpPanel } from "@/components/crm/BalanceTopUpModal";
import { SegmentBadge } from "@/components/crm/SegmentBadge";
import { readApiUserError } from "@/lib/api-error-message";
import { playersService } from "@/services/players.service";
import { useCrmVenue } from "@/lib/venue-context";
import type { Segment } from "@/app/(crm)/(panel)/players/types";

function sessionsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "сессия";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "сессии";
  return "сессий";
}

/** Целое число сессий по балансу: минуты / 10 без остатка */
function sessionsFromBalanceMinutes(minutes: unknown): number {
  return Math.floor(Number(minutes ?? 0) / 10);
}

interface PlayerProfileModalProps {
  playerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Сразу показать панель пополнения (колонка справа), как после «Пополнить» */
  initialTopUpOpen?: boolean;
}

export function PlayerProfileModal({ playerId, isOpen, onClose, initialTopUpOpen = false }: PlayerProfileModalProps) {
  const { selectedVenueId } = useCrmVenue();
  const [mounted, setMounted] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [player, setPlayer] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  async function refreshPlayer() {
    if (!playerId) return;
    setLoading(true);
    setError("");
    try {
      const data = await playersService.getById(playerId);
      setPlayer(data as Record<string, unknown>);
    } catch (err: unknown) {
      setError(readApiUserError(err, "Ошибка загрузки"));
      setPlayer(null);
    } finally {
      setLoading(false);
    }
  }

  useLayoutEffect(() => {
    if (isOpen && playerId && initialTopUpOpen) {
      setTopUpOpen(true);
    }
  }, [isOpen, playerId, initialTopUpOpen]);

  useEffect(() => {
    if (!isOpen || !playerId) {
      setTopUpOpen(false);
      setPlayer(null);
      setError("");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    playersService
      .getById(playerId)
      .then((data) => {
        if (!cancelled) setPlayer(data as Record<string, unknown>);
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
  const pointsToPlatinum = Math.max(0, 10000 - points);
  const progressPct = Math.min(100, (points / (points + pointsToPlatinum)) * 100);

  const profileCards = loading ? (
    <div className="animate-pulse space-y-4">
      <div className="h-36 rounded-xl bg-[#1F2B38]" />
      <div className="h-28 rounded-xl bg-[#1F2B38]" />
      <div className="h-28 rounded-xl bg-[#1F2B38]" />
    </div>
  ) : error || !player ? (
    <p className="text-sm text-text-secondary">{error || "Игрок не найден."}</p>
  ) : (
    <>
      {/* Аватар наполовину выходит за верх карточки */}
      <div className="relative pt-9">
        <div className="relative rounded-xl bg-[#1F2B38] px-5 pb-5 pt-11">
          <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
            <Avatar letter={nickname[0]?.toUpperCase()} size={76} />
          </div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-lg font-semibold text-text-primary">{nickname}</p>
            <SegmentBadge segment={player.segment as Segment} />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#1F2B38] px-5 py-4">
        <p className="mb-3 text-xs font-normal text-text-secondary">Баланс игрока</p>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="leading-tight text-text-primary">
              <span className="text-2xl font-bold tabular-nums">
                {Number(player.balanceMinutes ?? 0)}
              </span>
              <span className="ml-1.5 text-base font-normal text-text-primary/90">мин</span>
            </p>
            <p className="mt-1.5 text-xs font-normal text-text-secondary">
              {(() => {
                const approxSessions = sessionsFromBalanceMinutes(player.balanceMinutes);
                return (
                  <>
                    ≈ доступно <span className="tabular-nums">{approxSessions}</span>{" "}
                    {sessionsWord(approxSessions)}
                  </>
                );
              })()}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTopUpOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan/70 px-3 py-2 text-sm font-medium text-cyan transition-colors hover:bg-cyan/10"
          >
            <PlusIcon />
            Пополнить
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-[#1F2B38] px-5 py-4">
        <p className="mb-3 text-xs font-normal text-text-secondary">Прогресс</p>
        <div className="flex items-start gap-5">
          <div className="shrink-0">
            <p className="leading-none text-text-primary">
              <span className="text-xl font-bold tabular-nums">
                {points.toLocaleString("ru-RU")}
              </span>
            </p>
            <p className="mt-1.5 text-xs font-normal text-text-secondary">моих очков</p>
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="h-2 overflow-hidden rounded-full bg-bg-primary/80">
              <div
                className="h-full rounded-full bg-success transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-normal text-text-secondary">
              {pointsToPlatinum.toLocaleString("ru-RU")} очков до Platinum
            </p>
          </div>
        </div>
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
        className={`absolute bottom-0 left-1/2 top-0 z-10 flex w-full -translate-x-1/2 flex-col bg-[#141C26] shadow-none ${topUpOpen ? "max-w-[980px]" : "max-w-xl"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          {topUpOpen ? (
            <div className="flex min-h-full w-full flex-col justify-center py-6">
              <div className="mx-auto flex w-full max-w-[920px] items-center gap-6 px-6">
                <div className="w-full max-w-[420px] space-y-6">
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                      aria-label="Назад"
                    >
                      <BackIcon />
                    </button>
                    <h2 id="player-profile-title" className="text-lg font-semibold text-white">
                      Профиль игрока
                    </h2>
                  </div>
                  {profileCards}
                </div>
                <div className="flex min-h-0 w-full max-w-[420px] max-h-[min(88dvh,48rem)] flex-col border-l border-surface-border/40 pl-6">
                  <BalanceTopUpPanel
                    playerId={playerId}
                    playerName={nickname}
                    venueId={selectedVenueId}
                    onSuccess={refreshPlayer}
                    onClose={() => setTopUpOpen(false)}
                    className="min-h-0 w-full max-w-none flex-1"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-full w-full flex-col justify-center py-6">
              <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-6">
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                    aria-label="Назад"
                  >
                    <BackIcon />
                  </button>
                  <h2 id="player-profile-title" className="text-lg font-semibold text-white">
                    Профиль игрока
                  </h2>
                </div>
                {profileCards}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
