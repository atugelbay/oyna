"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input, Button } from "@/components/ui";
import { readApiUserError } from "@/lib/api-error-message";
import { venuesService, type VenuePayload } from "@/services/venues.service";

export type VenueFormValues = {
  id: string;
  name: string;
  city: string;
  address: string;
  timezone?: string;
  status?: "OPEN" | "CLOSED" | "MAINTENANCE";
};

interface VenueFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editVenue?: VenueFormValues | null;
  onSaved?: (venue: { id: string; name: string; city?: string }) => void;
}

const STATUS_OPTIONS: Array<{ value: VenuePayload["status"]; label: string }> = [
  { value: "OPEN", label: "Открыта" },
  { value: "CLOSED", label: "Закрыта" },
  { value: "MAINTENANCE", label: "На обслуживании" },
];

export function VenueFormModal({ isOpen, onClose, editVenue, onSaved }: VenueFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("Asia/Almaty");
  const [status, setStatus] = useState<NonNullable<VenuePayload["status"]>>("OPEN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    if (editVenue) {
      setName(editVenue.name);
      setCity(editVenue.city);
      setAddress(editVenue.address);
      setTimezone(editVenue.timezone || "Asia/Almaty");
      setStatus(editVenue.status || "OPEN");
    } else {
      setName("");
      setCity("");
      setAddress("");
      setTimezone("Asia/Almaty");
      setStatus("OPEN");
    }
  }, [isOpen, editVenue]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const payload: VenuePayload = {
      name: name.trim(),
      city: city.trim(),
      address: address.trim(),
      timezone: timezone.trim() || "Asia/Almaty",
      status,
    };

    if (!payload.name || !payload.city || !payload.address) {
      setError("Заполните название, город и адрес");
      return;
    }

    setSubmitting(true);
    try {
      const saved = editVenue
        ? await venuesService.update(editVenue.id, payload)
        : await venuesService.create(payload);
      onSaved?.({
        id: saved.id,
        name: saved.name,
        city: saved.city,
      });
      onClose();
    } catch (err) {
      setError(readApiUserError(err, editVenue ? "Не удалось сохранить площадку" : "Не удалось создать площадку"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-[#141C26] p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          {editVenue ? "Редактировать площадку" : "Новая площадка"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label="Город" value={city} onChange={(e) => setCity(e.target.value)} />
          <Input label="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Часовой пояс" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          <div>
            <label className="mb-1.5 block text-xs text-text-secondary">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as NonNullable<VenuePayload["status"]>)}
              className="h-11 w-full rounded-xl border border-surface-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:ring-1 focus:ring-cyan/40"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Сохранение…" : editVenue ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
