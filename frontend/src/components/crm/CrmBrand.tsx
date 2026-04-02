"use client";

import Image from "next/image";
import Link from "next/link";

/** Круговая часть логотипа */
export function CrmBrandIcon() {
  return (
    <Link
      href="/dashboard"
      aria-label="OYNA — главная"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-white/5"
    >
      <Image
        src="/brand/oyna-mark.png"
        alt=""
        width={72}
        height={72}
        className="h-fit w-fit object-contain mix-blend-lighten"
        unoptimized
        priority
      />
    </Link>
  );
}

/** Вордмарк OYNA */
export function CrmBrandWordmark() {
  return (
    <Link
      href="/dashboard"
      aria-label="OYNA — главная"
      className="flex shrink-0 items-center transition-opacity hover:opacity-90"
    >
      <Image
        src="/brand/oyna-wordmark.png"
        alt="OYNA"
        width={220}
        height={48}
        className="h-fit w-[123px] object-contain object-left mix-blend-lighten"
        unoptimized
        priority
      />
    </Link>
  );
}
