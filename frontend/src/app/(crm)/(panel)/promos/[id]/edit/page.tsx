"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { promosService } from "@/services/promos.service";
import { readApiUserError } from "@/lib/api-error-message";

const PROMO_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED"] as const;

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

export default function EditPromoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [reward, setReward] = useState("");
  const [quantity, setQuantity] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    promosService
      .getById(id)
      .then(
        (data: {
          title?: string;
          headline?: string;
          description?: string;
          type?: string;
          reward?: string;
          quantity?: string;
          dateStart?: string;
          dateEnd?: string;
          status?: string;
        }) => {
          if (cancelled) return;
          setTitle(data.title ?? "");
          setHeadline(data.headline ?? "");
          setDescription(data.description ?? "");
          setType(data.type ?? "");
          setReward(data.reward ?? "");
          setQuantity(data.quantity ?? "");
          setDateStart(toDateInput(data.dateStart));
          setDateEnd(toDateInput(data.dateEnd));
          setStatus(data.status && PROMO_STATUSES.includes(data.status as (typeof PROMO_STATUSES)[number]) ? data.status : "ACTIVE");
        },
      )
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(readApiUserError(err, "Не удалось загрузить акцию"));
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
    const trimmedTitle = String(title || "").trim();
    const trimmedType = String(type || "").trim();
    if (!trimmedTitle || !trimmedType || !dateStart) {
      setError("Укажите название, тип и дату начала");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const startIso = new Date(`${dateStart}T12:00:00`).toISOString();
      const endIso = dateEnd ? new Date(`${dateEnd}T23:59:59`).toISOString() : undefined;
      await promosService.update(id, {
        title: trimmedTitle,
        headline: headline.trim() || trimmedTitle,
        description: description.trim() || undefined,
        type: trimmedType,
        reward: reward.trim() || undefined,
        quantity: quantity.trim() || undefined,
        dateStart: startIso,
        dateEnd: endIso,
        status,
      });
      router.push(`/promos/${id}`);
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось сохранить акцию"));
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
        <Link href="/promos" className="text-sm text-cyan hover:underline">
          К списку акций
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/promos/${id}`} className="rounded-lg p-1.5 text-text-secondary hover:text-text-primary">
          <BackIcon />
        </Link>
        <h1 className="text-xl font-semibold text-text-primary">Редактирование акции</h1>
      </div>

      <div className="space-y-4">
        <Input label="Заголовок (внутренний)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input label="Заголовок на витрине" value={headline} onChange={(e) => setHeadline(e.target.value)} />
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-lg border border-surface-border bg-bg-secondary px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <Input label="Тип акции" value={type} onChange={(e) => setType(e.target.value)} />
        <Input label="Награда" value={reward} onChange={(e) => setReward(e.target.value)} />
        <Input label="Количество / условие" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <Input label="Дата начала" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
        <Input label="Дата окончания" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Статус</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-12 w-full rounded-lg border border-surface-border bg-bg-secondary px-3 text-text-primary"
          >
            {PROMO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "ACTIVE" ? "Активна" : s === "INACTIVE" ? "Неактивна" : "Истекла"}
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
