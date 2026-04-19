"use client";

import { useState, FormEvent, useEffect } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { roomsService } from "@/services/rooms.service";
import { gameModesService } from "@/services/game-modes.service";
import { uniqueSessionsFromModes } from "@/lib/room-sessions";

type EditRoomPayload = {
  id: string;
  name: string;
  modes: Array<{ id: string; name: string; config?: unknown | null }>;
};

interface AddRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueId: string;
  defaultType?: string;
  onAdded?: () => void;
  /** Редактирование существующей комнаты */
  editRoom?: EditRoomPayload | null;
}

type DraftSession = {
  id: string;
  name: string;
  minutes: number;
};

export function AddRoomModal({
  isOpen,
  onClose,
  venueId,
  defaultType,
  onAdded,
  editRoom,
}: AddRoomModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState("");
  const [sessions, setSessions] = useState<DraftSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSessionName("");
    setSessionMinutes("");
    setError(null);
    setSubmitting(false);

    if (editRoom) {
      setName(editRoom.name);
      const rows = uniqueSessionsFromModes(editRoom.modes);
      setSessions(
        rows.map((s, i) => ({
          id: `edit-${editRoom.id}-${i}-${s.name}`,
          name: s.name,
          minutes: s.minutes,
        })),
      );
    } else {
      setName("");
      setSessions([]);
    }
  }, [isOpen, editRoom]);

  function close() {
    onClose();
  }

  function addSession() {
    const trimmedSessionName = String(sessionName || "").trim();
    const parsedMinutes = Number(sessionMinutes);
    if (!trimmedSessionName) {
      setError("Введите название сессии");
      return;
    }
    if (!Number.isInteger(parsedMinutes) || parsedMinutes < 1) {
      setError("Минуты сессии должны быть целым числом от 1");
      return;
    }

    setError(null);
    setSessions((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: trimmedSessionName,
        minutes: parsedMinutes,
      },
    ]);
    setSessionName("");
    setSessionMinutes("");
  }

  function removeSession(sessionId: string) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
      setError("Введите название комнаты");
      return;
    }
    if (!sessions.length) {
      setError("Добавьте хотя бы одну сессию");
      return;
    }

    setSubmitting(true);

    const applyModesForRoom = async (roomId: string) => {
      let order = 0;
      for (const session of sessions) {
        const cfg = { durationSeconds: session.minutes * 60, sortOrder: order };
        await gameModesService.create({
          roomId,
          type: "COOP",
          name: session.name,
          config: cfg,
        });
        await gameModesService.create({
          roomId,
          type: "FFA",
          name: session.name,
          config: cfg,
        });
        order += 1;
      }
    };

    if (editRoom) {
      void (async () => {
        try {
          await Promise.all(editRoom.modes.map((m) => gameModesService.remove(m.id)));
          await roomsService.update(editRoom.id, {
            name: trimmedName,
            defaultLevelDuration: sessions[0].minutes * 60,
          });
          await applyModesForRoom(editRoom.id);
          onAdded?.();
          close();
        } catch (err: unknown) {
          setError(readApiUserError(err, "Не удалось сохранить комнату"));
        } finally {
          setSubmitting(false);
        }
      })();
      return;
    }

    roomsService
      .create({
        venueId,
        name: trimmedName,
        type: defaultType ?? "grid",
        defaultLevelDuration: sessions[0].minutes * 60,
      })
      .then(async (room: { id: string }) => {
        await applyModesForRoom(room.id);
        onAdded?.();
        close();
      })
      .catch((err: unknown) => {
        setError(readApiUserError(err, "Ошибка добавления комнаты"));
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
        onClick={close}
        aria-label="Закрыть"
      />
      <div
        className="absolute bottom-0 left-1/2 top-0 z-10 flex w-full max-w-xl -translate-x-1/2 flex-col bg-[#141C26] shadow-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-room-title"
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
                onClick={close}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-surface-border text-white transition-colors hover:bg-white/5"
                aria-label="Назад"
              >
                <BackIcon />
              </button>
              <h2 id="add-room-title" className="text-lg font-semibold text-white">
                {editRoom ? "Редактирование комнаты" : "Добавление комнаты"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Наименование комнаты"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <div className="rounded-xl bg-[#1F2B38] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-text-primary">Сессии</p>
                  <button
                    type="button"
                    onClick={addSession}
                    className="text-xs font-semibold text-cyan hover:underline"
                  >
                    Добавить
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="Название сессии"
                    className="h-10 w-full rounded-md border border-surface-border bg-[#1F2B38] px-3 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={sessionMinutes}
                    onChange={(e) => setSessionMinutes(e.target.value)}
                    placeholder="Введите минуты"
                    className="h-10 w-full rounded-md border border-surface-border bg-[#1F2B38] px-3 text-sm text-text-primary outline-none focus:border-cyan"
                  />
                </div>

                {sessions.length ? (
                  <div className="mt-3 space-y-2">
                    {sessions.map((session) => (
                      <div key={session.id} className="grid grid-cols-[1fr_1fr_auto] items-stretch gap-2 text-xs">
                        <div className="rounded-md border border-surface-border bg-[#1F2B38] px-3 py-2">
                          <p className="mb-1 text-[11px] text-text-secondary">Название сессии</p>
                          <p className="truncate text-sm text-text-primary">{session.name}</p>
                        </div>
                        <div className="rounded-md border border-surface-border bg-[#1F2B38] px-3 py-2">
                          <p className="mb-1 text-[11px] text-text-secondary">Введите минуты</p>
                          <p className="truncate text-sm tabular-nums text-text-primary">{session.minutes} мин</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSession(session.id)}
                          className="-ml-1 flex h-8 w-8 self-center items-center justify-center rounded-full bg-[#1F2B38] text-text-muted transition-colors hover:text-danger"
                          aria-label="Удалить сессию"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {error ? <p className="text-danger text-sm">{error}</p> : null}
              <Button type="submit" className="mt-2 inline-flex w-fit items-center justify-center gap-2">
                <CheckIcon />
                {submitting ? "Сохранение..." : "Сохранить"}
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

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m18 6-12 12M6 6l12 12" />
    </svg>
  );
}
