import Image from 'next/image';
export function Brand({ large = false }: { large?: boolean }) {
  return <span className="inline-flex items-center gap-2.5 brightness-[3]"><Image src="/brand/oyna-mark.png" width={large ? 50 : 32} height={large ? 50 : 32} alt="" className="object-contain mix-blend-lighten" priority /><Image src="/brand/oyna-wordmark.png" width={large ? 150 : 96} height={large ? 34 : 22} alt="OYNA" className="object-contain mix-blend-lighten" priority /></span>;
}
