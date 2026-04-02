interface AvatarProps {
  letter?: string;
  size?: number;
}

export function Avatar({ letter, size = 64 }: AvatarProps) {
  return (
    <div
      className="rounded-full bg-cyan flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-bold text-bg-primary"
        style={{ fontSize: size * 0.4 }}
      >
        {letter || "-"}
      </span>
    </div>
  );
}
