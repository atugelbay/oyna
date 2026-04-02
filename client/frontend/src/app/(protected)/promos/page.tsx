'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, AlignLeft } from 'lucide-react';
import { promosService } from '@/services/promos.service';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Placeholder art generated from promo id (deterministic color)
function PromoPlaceholder({ id }: { id: string }) {
  const hue = (id.charCodeAt(0) * 37 + id.charCodeAt(1) * 13) % 360;
  return (
    <div
      className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, hsl(${hue},40%,18%), hsl(${(hue + 40) % 360},30%,12%))` }}
    >
      {/* Geometric placeholder shapes like in Figma */}
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <polygon points="24,6 34,22 14,22" fill={`hsl(${hue},30%,35%)`} />
        <circle cx="14" cy="34" r="7" fill={`hsl(${hue},25%,30%)`} />
        <rect x="26" y="28" width="13" height="13" rx="2" fill={`hsl(${hue},20%,32%)`} />
      </svg>
    </div>
  );
}

export default function PromosPage() {
  const router = useRouter();
  const [promos, setPromos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    promosService.getActivePromos().then(setPromos).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">Акции</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center pt-32">
          <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : promos.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-40 px-8 text-center">
          <AlignLeft size={32} className="text-gray-600 mb-4" />
          <p className="text-white font-semibold text-base mb-1">Нет доступных акций</p>
          <p className="text-gray-500 text-sm">Специальные предложения отобразятся тут</p>
        </div>
      ) : (
        <div className="px-4 space-y-3 pb-8">
          {promos.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/promos/${p.id}`)}
              className="w-full bg-surface-card rounded-2xl p-3 flex items-center gap-3 active:bg-surface-elevated transition-colors text-left"
            >
              <PromoPlaceholder id={p.id} />

              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight mb-1">{p.title}</p>
                {(p.headline || p.description) && (
                  <p className="text-gray-400 text-xs leading-snug line-clamp-2 mb-2">
                    {p.headline || p.description}
                  </p>
                )}
                {p.dateEnd && (
                  <p className="text-gray-500 text-xs">
                    Действует до: {formatDate(p.dateEnd)}
                  </p>
                )}
              </div>

              <ArrowRight size={18} className="text-gray-500 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
