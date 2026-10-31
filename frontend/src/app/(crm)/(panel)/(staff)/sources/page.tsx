"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

export default function SourcesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/sources/report")
      .then(({ data }) => setRows(data))
      .catch((e) => setError(e?.response?.data?.message || "Отчёт по источникам доступен владельцу"));
  }, []);

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Откуда узнали</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {rows.map((row) => (
        <article key={row.code} className="flex items-center justify-between rounded-xl bg-bg-secondary p-3 text-sm">
          <span>{row.label}</span>
          <span className="font-semibold">{row.players}</span>
        </article>
      ))}
    </div>
  );
}
