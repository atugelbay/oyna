"use client";

import { useState, useEffect, FormEvent } from "react";
import { createPortal } from "react-dom";
import { Input, Button, PhoneInput } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { authService } from "@/services/auth.service";
import { playersService } from "@/services/players.service";

export type EditPlayerPayload = {
  id: string;
  phone: string;
  nickname: string;
  name: string;
  birthDate?: string | null;
};

interface AddPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** После успешной регистрации */
  onAdded?: (playerId: string) => void;
  /** Режим редактирования */
  editPlayer?: EditPlayerPayload | null;
  onUpdated?: () => void;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function subscriberDigitsFromPhone(phone: string): string {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.length >= 11 && d.startsWith("7")) return d.slice(1, 11);
  return d.slice(-10);
}

export function AddPlayerModal({
  isOpen,
  onClose,
  onAdded,
  editPlayer,
  onUpdated,
}: AddPlayerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState("");
  const [nickname, setNickname] = useState("");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editPlayer;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);

    if (editPlayer) {
      setPhone(subscriberDigitsFromPhone(editPlayer.phone));
      setNickname(editPlayer.nickname);
      setName(editPlayer.name);
      setBirthday(toDateInputValue(editPlayer.birthDate ?? undefined));
    } else {
      setPhone("");
      setNickname("");
      setName("");
      setBirthday("");
    }
  }, [isOpen, editPlayer]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedNickname = String(nickname || "").trim();
    const trimmedName = String(name || "").trim();
    const birthDate = birthday || undefined;

    if (trimmedNickname.length < 2) {
      setError("Укажите никнейм (минимум 2 символа)");
      return;
    }
    if (!trimmedName) {
      setError("Укажите ФИО");
      return;
    }

    if (isEdit && editPlayer) {
      setSubmitting(true);
      playersService
        .update(editPlayer.id, {
          nickname: trimmedNickname,
          name: trimmedName,
          birthDate,
        })
        .then(() => {
          onUpdated?.();
          onClose();
        })
        .catch((err: unknown) => {
          setError(readApiUserError(err, "Не удалось сохранить игрока"));
        })
        .finally(() => setSubmitting(false));
      return;
    }

    const phoneDigits = String(phone || "").replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setError("Проверьте номер телефона");
      return;
    }

    setSubmitting(true);
    authService
      .register({
        phone: phoneDigits,
        nickname: trimmedNickname,
        name: trimmedName,
        birthDate,
      })
      .then((data: { user?: { id?: string } }) => {
        const id = data?.user?.id;
        if (id) onAdded?.(id);
        onClose();
        setPhone("");
        setNickname("");
        setName("");
        setBirthday("");
      })
      .catch((err: unknown) => {
        setError(readApiUserError(err, "Ошибка добавления игрока"));
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  if (!isOpen || !mounted) return null;

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
        aria-labelledby="add-player-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
        >
          <div className="my-auto mx-auto flex w-full max-w-md flex-col gap-6 px-6 pb-10 pt-4">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <BackIcon />
              </button>
              <h2 id="add-player-title" className="text-lg font-semibold text-white">
                {isEdit ? "Редактирование игрока" : "Добавление игрока"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PhoneInput
                label="Номер телефона"
                value={phone}
                onChange={setPhone}
                disabled={isEdit}
                className={isEdit ? "opacity-70" : undefined}
              />
              <Input
                label="Никнейм"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <Input
                label="ФИО"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Дата рождения"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <Button type="submit" className="mt-2 inline-flex w-fit items-center justify-center gap-2">
                <CheckIcon />
                {submitting ? (isEdit ? "Сохранение..." : "Добавление...") : isEdit ? "Сохранить" : "Добавить"}
              </Button>
            </form>
          </div>
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
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
