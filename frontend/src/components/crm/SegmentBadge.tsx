import type { Segment } from "@/app/(crm)/(panel)/players/types";

const SEGMENT_STYLES: Record<Segment, string> = {
  GOLD: "bg-[#E2B13C] text-[#1C1508]",
  SILVER: "bg-[#B9C5D1] text-[#151A20]",
  BRONZE: "bg-[#B07A3E] text-[#1A0F06]",
};

function normalizeSegment(input: unknown): Segment | null {
  if (typeof input === "string") {
    const upper = input.toUpperCase();
    if (upper === "GOLD" || upper === "SILVER" || upper === "BRONZE") return upper;
    return null;
  }

  if (input && typeof input === "object") {
    const code = (input as { code?: unknown }).code;
    if (typeof code === "string") {
      const upper = code.toUpperCase();
      if (upper === "GOLD" || upper === "SILVER" || upper === "BRONZE") return upper;
    }
  }

  return null;
}

export function SegmentBadge({ segment }: { segment: unknown }) {
  const normalized = normalizeSegment(segment);
  const label = normalized ?? "UNKNOWN";
  const style = normalized ? SEGMENT_STYLES[normalized] : "bg-bg-card text-text-secondary";

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${style}`}
    >
      {label}
    </span>
  );
}
