"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Старый URL /players/:id — перенаправляем на список с модалкой профиля */
export default function PlayerProfileRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    router.replace(`/players?player=${encodeURIComponent(id)}`);
  }, [id, router]);

  return <div className="p-6 text-sm text-text-secondary">Открываем профиль…</div>;
}
