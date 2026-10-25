"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { roomsService } from "@/services/rooms.service";

interface StationApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  hasKey: boolean;
  onSaved?: () => void;
}

function generateStationKey() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `station_${raw}`;
}

export function StationApiKeyModal({
  isOpen,
  onClose,
  roomId,
  roomName,
  hasKey,
  onSaved,
}: StationApiKeyModalProps) {
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setApiKey("");
    setError(null);
    setSubmitting(false);
    setCopied(false);
  }, [isOpen, roomId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const key = apiKey.trim();
    if (key.length < 24) {
      setError("Ключ должен быть не короче 24 символов");
      return;
    }

    setSubmitting(true);
    try {
      await roomsService.setStationApiKey(roomId, key);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(readApiUserError(err, "Не удалось сохранить ключ станции"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!apiKey.trim()) return;
    try {
      await navigator.clipboard.writeText(apiKey.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Не удалось скопировать — скопируйте вручную");
    }
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Ключ Room Agent</h2>
        <p className="mb-4 text-sm text-text-secondary">
          Комната «{roomName}». Ключ хранится как hash — после сохранения его нельзя посмотреть снова.
          {hasKey ? " Текущий ключ будет заменён." : ""}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="API-ключ станции"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-4"
              onClick={() => {
                setApiKey(generateStationKey());
                setCopied(false);
              }}
            >
              Сгенерировать
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-4"
              onClick={() => void copyKey()}
              disabled={!apiKey.trim()}
            >
              {copied ? "Скопировано" : "Копировать"}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-text-muted">
            Скопируйте ключ в конфиг Room Agent на моноблоке (вместе с публичным URL CRM API).
          </p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Сохранение…" : "Сохранить ключ"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
