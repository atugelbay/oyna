"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { promosService } from "@/services/promos.service";
import { readApiUserError } from "@/lib/api-error-message";
import { useConfirmDelete } from "@/components/ui/ConfirmDeleteModal";

type PromoDetail = {
  id: string;
  title: string;
  headline?: string;
  description?: string;
  type: string;
  reward?: string;
  quantity?: string;
  dateStart: string;
  dateEnd?: string;
  status?: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function PromoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [p, setP] = useState<PromoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function fetchPromo() {
      setLoading(true);
      setError(null);
      try {
        const data = await promosService.getById(id);
        if (!cancelled) setP(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiUserError(err, "Не удалось загрузить акцию"));
          setP(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPromo();
    return () => { cancelled = true; };
  }, [id]);

  async function handleDelete() {
    if (deleting) return;
    if (!id || !p) return;

    setActionError(null);
    const ok = await confirmDelete({
      title: "Удалить акцию?",
      message: `Акция «${p.title}» будет удалена безвозвратно.`,
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await promosService.remove(id);
      router.push("/promos");
    } catch (err: unknown) {
      setActionError(readApiUserError(err, "Не удалось удалить акцию"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Link href="/promos" className="inline-flex items-center gap-2 text-text-secondary hover:text-cyan text-sm">
          <BackIcon />
          О акции
        </Link>
        <p className="text-text-secondary">Загрузка...</p>
      </div>
    );
  }

  if (error || !p) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Link href="/promos" className="inline-flex items-center gap-2 text-text-secondary hover:text-cyan text-sm">
          <BackIcon />
          О акции
        </Link>
        <p className="text-danger">{error ?? "Акция не найдена"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <Link href="/promos" className="inline-flex items-center gap-2 text-text-secondary hover:text-cyan text-sm">
          <BackIcon />
          О акции
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/promos/${id}/edit`}
            className="rounded-lg border border-surface-border px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card"
          >
            Изменить
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-danger text-danger text-sm font-medium hover:bg-danger/10 disabled:opacity-50"
          >
            {deleting ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>

      {actionError ? <p className="text-danger text-sm">{actionError}</p> : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex gap-6 flex-wrap">
            <div className="w-48 h-48 rounded-xl bg-bg-card flex items-center justify-center shrink-0">
              <PlaceholderIcon />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-secondary">Дата проведения: {formatDate(p.dateStart)} – {p.dateEnd ? formatDate(p.dateEnd) : "—"}</p>
              <p className="text-2xl font-bold text-text-primary mt-2">{p.headline}</p>
              <div className="mt-3">
                <p className="text-sm text-text-secondary mb-1">Правила / Описание</p>
                <p className="text-sm text-text-primary leading-relaxed">{p.description}</p>
              </div>
            </div>
          </div>
          <div className="bg-bg-secondary rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Детали</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Тип акции</dt>
                <dd className="text-text-primary">{p.type}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Награда</dt>
                <dd className="text-text-primary">{p.reward ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Количество</dt>
                <dd className="text-text-primary">{p.quantity ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="bg-bg-secondary rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Превью</h3>
          <div className="rounded-xl overflow-hidden bg-bg-card max-w-[280px] mx-auto">
            <div className="h-8 flex items-center justify-between px-3 bg-bg-primary/50 text-xs text-text-secondary">
              <span>9:30</span>
              <span>••••</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <BackIcon className="w-4 h-4 text-text-secondary" />
                <span className="text-sm text-text-primary">Label</span>
                <span className="ml-auto">⋮</span>
              </div>
              <div className="aspect-video rounded-lg bg-bg-secondary flex items-center justify-center">
                <PlaceholderIcon className="w-10 h-10 text-text-muted" />
              </div>
              <p className="text-sm font-medium text-text-primary">Headline</p>
              <p className="text-xs text-text-secondary">supporting text</p>
              <button type="button" className="w-full py-2 rounded-lg bg-cyan text-bg-primary text-xs font-medium">
                Download
              </button>
              <p className="text-xs text-text-muted">Published date</p>
              <p className="text-xs text-text-secondary line-clamp-3">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
          </div>
        </div>
      </div>
      {deleteDialog}
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
function PlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className}>
      <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8" />
      <rect x="3" y="3" width="6" height="6" rx="1" />
    </svg>
  );
}
