"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { promosService } from "@/services/promos.service";
import { readApiUserError } from "@/lib/api-error-message";

type TabFilter = "all" | "active" | "inactive";

type Promo = {
  id: string;
  title: string;
  headline?: string;
  description?: string;
  type: string;
  dateStart: string;
  dateEnd?: string;
  status: string;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function PromosPage() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchPromos() {
      setLoading(true);
      setError(null);
      try {
        const data = await promosService.list();
        if (!cancelled) setPromos(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiUserError(err, "Не удалось загрузить акции"));
          setPromos([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPromos();
    return () => { cancelled = true; };
  }, []);

  const filtered = tab === "all"
    ? promos
    : promos.filter((p) => {
        if (tab === "active") return p.status === "ACTIVE";
        return p.status === "INACTIVE" || p.status === "EXPIRED";
      });

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Акции</h1>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Акции</h1>
      </div>

      <div className="flex gap-2">
        {(["all", "active", "inactive"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === value ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {value === "all" ? "Все" : value === "active" ? "Активные" : "Неактивные"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-text-secondary">Загрузка...</p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <Link
            key={p.id}
            href={`/promos/${p.id}`}
            className="block rounded-xl bg-bg-secondary overflow-hidden hover:bg-bg-card/40 transition-colors"
          >
            <div className="flex gap-4 p-4">
              <div className="w-20 h-20 rounded-lg bg-bg-card shrink-0 flex items-center justify-center text-text-muted">
                <PlaceholderIcon />
              </div>
              <div className="min-w-0 flex-1">
                {p.status === "ACTIVE" && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-cyan/20 text-cyan mb-1">Активно</span>
                )}
                <p className="font-semibold text-text-primary truncate">{p.title}</p>
                <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{p.description}</p>
                <p className="text-xs text-text-muted mt-2">Дата проведения: {formatDate(p.dateStart)} - {p.dateEnd ? formatDate(p.dateEnd) : "Нет даты"}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      )}

      <Link
        href="/promos/new"
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon />
        Добавить
      </Link>
    </div>
  );
}

function PlaceholderIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
