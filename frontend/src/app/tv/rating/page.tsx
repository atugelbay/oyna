"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export default function TvRatingPage() {
  const [data, setData] = useState<any>(null);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`${API}/tv/rating?point=${params.get("point") || ""}&key=${params.get("key") || ""}&room=${params.get("room") || ""}`);
        const json = await res.json();
        if (!stop) setData(json);
      } catch {
        /* keep last frame */
      }
    }
    load();
    const poll = setInterval(load, 30000);
    const spin = setInterval(() => setSlide((n) => (n + 1) % 4), (data?.seconds || 15) * 1000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(spin);
    };
  }, [data?.seconds]);

  const frames = [data?.day, data?.month, data?.year].filter(Boolean);
  const current = frames[slide % Math.max(frames.length, 1)];
  return (
    <main className="min-h-screen bg-black p-8 text-white" style={{ cursor: "none" }}>
      <h1 className="text-5xl font-bold">{current?.label || "Рейтинг"}</h1>
      <ol className="mt-8 space-y-3 text-4xl">
        {(current?.items || []).map((row: any) => (
          <li key={row.place}>{row.place}. {row.nick} · {row.points}</li>
        ))}
      </ol>
      {data?.ticker && <p className="fixed bottom-6 left-8 right-8 text-2xl">{data.ticker}</p>}
      <p className="fixed bottom-6 right-8 text-xl text-white/60">Обновлено {data?.day?.updatedAt?.slice(11, 16) || ""}</p>
    </main>
  );
}
