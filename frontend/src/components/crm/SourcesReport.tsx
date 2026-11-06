"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

/** «Откуда узнали» — маркетинговый отчёт, показывается в Финансы → Статистика. Видит владелец. */
export function SourcesReport() {
  const [rows, setRows] = useState<{ code: string; label: string; players: number }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/sources/report")
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((e) => setError(e?.response?.data?.message || "Отчёт по источникам доступен владельцу"));
  }, []);

  const total = rows.reduce((s, r) => s + r.players, 0);

  return (
    <section id="sources" className="rounded-xl bg-bg-secondary p-6">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">Откуда узнали</h2>
      {error ? <p className="text-sm text-text-secondary">{error}</p> : null}
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.code} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-text-primary">{row.label}</span>
            <span className="tabular-nums text-text-secondary">
              {row.players}
              {total ? ` · ${Math.round((row.players / total) * 100)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
