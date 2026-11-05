"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { readApiUserError } from "@/lib/api-error-message";

type Rules = { newDays: string; windowDays: string; regularVisits: string };

export default function SettingsPlayerStatusPage() {
  const [rules, setRules] = useState<Rules>({ newDays: "14", windowDays: "30", regularVisits: "3" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/users/visit-rules")
      .then(({ data }) => {
        setRules({
          newDays: String(data.newDays),
          windowDays: String(data.windowDays),
          regularVisits: String(data.regularVisits),
        });
      })
      .catch((err) => setError(readApiUserError(err, "Не удалось загрузить пороги")))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setOk("");
    try {
      await api.patch("/users/visit-rules", {
        newDays: Number(rules.newDays),
        windowDays: Number(rules.windowDays),
        regularVisits: Number(rules.regularVisits),
      });
      setOk("Пороги сохранены");
    } catch (err) {
      setError(readApiUserError(err, "Менять пороги может только владелец"));
    } finally {
      setSaving(false);
    }
  }

  const n = rules.windowDays || "30";

  return (
    <div className="max-w-xl space-y-4">
      <div className="space-y-1 text-sm text-text-secondary">
        <p>Визит — день, в который у игрока был хотя бы один сеанс.</p>
        <p>
          <b className="text-text-primary">Новый</b> — первый визит не больше {rules.newDays || "14"} дней назад.{" "}
          <b className="text-text-primary">Постоянный</b> — {rules.regularVisits || "3"} и больше визитов за {n} дней.{" "}
          <b className="text-text-primary">Нечастый</b> — меньше визитов, но хотя бы один за {n} дней.{" "}
          <b className="text-text-primary">Неактивный</b> — ни одного визита за {n} дней.
        </p>
      </div>
      {loading ? <p className="text-text-muted">Загрузка…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}

      {(
        [
          ["newDays", "«Новый»: дней с первого визита"],
          ["windowDays", "Период подсчёта визитов, дней"],
          ["regularVisits", "«Постоянный»: визитов за период"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-sm text-text-secondary">
          {label}
          <input
            inputMode="numeric"
            value={rules[key]}
            onChange={(e) => setRules({ ...rules, [key]: e.target.value.replace(/\D/g, "") })}
            className="mt-1 h-12 w-full rounded-lg border border-surface-border bg-bg-card px-3 text-text-primary"
          />
        </label>
      ))}

      <button
        type="button"
        disabled={saving || loading}
        onClick={() => void save()}
        className="h-12 rounded-xl bg-cyan px-5 font-semibold text-bg-primary disabled:opacity-50"
      >
        {saving ? "Сохранение…" : "Сохранить"}
      </button>
    </div>
  );
}
