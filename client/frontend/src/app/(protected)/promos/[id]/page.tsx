'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Share2 } from 'lucide-react';
import { promosService } from '@/services/promos.service';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PromoHero({ id, title }: { id: string; title: string }) {
  const hue = (id.charCodeAt(0) * 37 + id.charCodeAt(1) * 13) % 360;
  return (
    <div
      className="w-full aspect-[4/3] flex items-center justify-center overflow-hidden"
      style={{
        background: `linear-gradient(145deg, hsl(${hue},50%,12%), hsl(${(hue + 60) % 360},40%,8%))`,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <polygon points="60,10 90,55 30,55" fill={`hsl(${hue},45%,30%)`} />
        <circle cx="32" cy="82" r="20" fill={`hsl(${hue},35%,25%)`} />
        <rect x="66" y="63" width="38" height="38" rx="6" fill={`hsl(${hue},30%,28%)`} />
        {/* Glow center */}
        <circle cx="60" cy="60" r="30" fill={`hsla(${hue},60%,50%,0.07)`} />
      </svg>
    </div>
  );
}

export default function PromoDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [promo, setPromo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    promosService.getPromoById(id)
      .then(setPromo)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    if (!promo) return;
    if (navigator.share) {
      await navigator.share({ title: promo.title, text: promo.headline ?? promo.description ?? '' }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !promo) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-white">О акции</h1>
        </div>
        <div className="flex flex-col items-center justify-center pt-32 text-center px-8">
          <p className="text-white font-semibold mb-1">Акция не найдена</p>
          <p className="text-gray-500 text-sm">Возможно, она уже завершилась</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-2 z-10">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-white active:opacity-60">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-white">О акции</h1>
      </div>

      {/* Hero image */}
      <PromoHero id={promo.id} title={promo.title} />

      {/* Content */}
      <div className="flex-1 px-4 pt-5 pb-28">
        <h2 className="text-white text-xl font-bold mb-1">{promo.title}</h2>
        {promo.dateEnd && (
          <p className="text-gray-500 text-sm mb-5">
            Действует до: {formatDate(promo.dateEnd)}
          </p>
        )}

        {(promo.description || promo.headline) && (
          <div className="bg-surface-card rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-medium mb-2 uppercase tracking-wide">Описание</p>
            <p className="text-white text-sm leading-relaxed">
              {promo.description || promo.headline}
            </p>
          </div>
        )}

        {promo.reward && (
          <div className="mt-3 bg-brand/10 border border-brand/20 rounded-2xl p-4">
            <p className="text-gray-500 text-xs font-medium mb-1 uppercase tracking-wide">Награда</p>
            <p className="text-brand font-semibold">🎁 {promo.reward}</p>
          </div>
        )}
      </div>

      {/* Share button — fixed bottom */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile px-4 pb-8 pt-4 bg-gradient-to-t from-surface via-surface/95 to-transparent">
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 bg-surface-elevated text-white font-semibold py-4 rounded-2xl active:opacity-80 transition-opacity"
        >
          <Share2 size={18} />
          Поделиться
        </button>
      </div>
    </div>
  );
}
