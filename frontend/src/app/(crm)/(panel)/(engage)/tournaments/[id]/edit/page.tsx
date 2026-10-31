"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { tournamentsService } from "@/services/tournaments.service";
import { readApiUserError } from "@/lib/api-error-message";

const TOURNAMENT_STATUSES = ["UPCOMING", "ACTIVE", "COMPLETED", "CANCELLED"] as const;

function toDateInput(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function EditTournamentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [status, setStatus] = useState<string>("UPCOMING");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    tournamentsService
      .getById(id)
      .then(
        (data: {
          name?: string;
          description?: string | null;
          dateStart?: string;
          dateEnd?: string;
          maxTeams?: number;
          status?: string;
        }) => {
          if (cancelled) return;
          setName(data.name ?? "");
          setDescription(data.description ?? "");
          setDateStart(toDateInput(data.dateStart));
          setDateEnd(toDateInput(data.dateEnd));
          setMaxTeams(data.maxTeams ?? 10);
          const st = data.status ?? "UPCOMING";
          setStatus(
            TOURNAMENT_STATUSES.includes(st as (typeof TOURNAMENT_STATUSES)[number]) ? st : "UPCOMING",
          );
        },
      )
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(readApiUserError(err, "Не удалось загрузить турнир"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (submitting) return;
    const trimmed = String(name || "").trim();
    if (!trimmed || !dateStart || !dateEnd) {
      setError("Укажите название и даты");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await tournamentsService.update(id, {
        name: trimmed,
        description: description.trim() || undefined,
        dateStart: new Date(`${dateStart}T12:00:00`).toISOString(),
        dateEnd: new Date(`${dateEnd}T12:00:00`).toISOString(),
        maxTeams,
        status,
      });
      router.push(`/tournaments/${id}`);
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось сохранить турнир"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-lg justify-center py-16">
        <span className="text-text-muted">Загрузка…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16">
        <p className="text-danger">{loadError}</p>
        <Link href="/tournaments" className="text-sm text-cyan hover:underline">
          К списку турниров
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Редактирование турнира</h1>
      </div>

      <div className="space-y-4">
        <Input label="Наименование" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-surface-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <Input label="Дата начала" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
        <Input label="Дата окончания" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
        <Input
          label="Макс. команд"
          type="number"
          min={1}
          value={maxTeams}
          onChange={(e) => setMaxTeams(Math.max(1, parseInt(e.target.value, 10) || 1))}
        />
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-12 w-full rounded-lg border border-surface-border bg-bg-secondary px-3 text-text-primary"
          >
            {TOURNAMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "UPCOMING"
                  ? "Предстоящий"
                  : s === "ACTIVE"
                    ? "Активный"
                    : s === "COMPLETED"
                      ? "Завершён"
                      : "Отменён"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Button type="button" onClick={handleSave} disabled={submitting} className="flex w-full items-center justify-center gap-2">
        {submitting ? "Сохранение..." : "Сохранить"}
      </Button>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
