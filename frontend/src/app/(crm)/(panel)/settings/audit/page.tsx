"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { readApiUserError } from "@/lib/api-error-message";

type AuditRow = {
  id: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
};

export default function SettingsAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/audit", { params: { limit: 200 } })
      .then(({ data }) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить журнал"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="py-10 text-text-muted">Загрузка журнала…</p>;
  }
  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">Кто, когда, что изменил (было → стало в detail).</p>
      <div className="overflow-x-auto rounded-xl bg-bg-secondary">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-text-secondary">
              <th className="px-3 py-2">Когда</th>
              <th className="px-3 py-2">Действие</th>
              <th className="px-3 py-2">Сущность</th>
              <th className="px-3 py-2">Детали</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-surface-border/40">
                <td className="px-3 py-2 whitespace-nowrap text-text-secondary">
                  {new Date(row.createdAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })}
                </td>
                <td className="px-3 py-2 text-text-primary">{row.action}</td>
                <td className="px-3 py-2 text-text-secondary">
                  {row.entity}
                  {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
                </td>
                <td className="px-3 py-2 text-text-secondary">{row.detail || "—"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-text-muted">
                  Пока записей нет
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
