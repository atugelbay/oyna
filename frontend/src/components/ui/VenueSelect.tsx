"use client";

interface VenueSelectProps {
  value: string;
  onChange: (value: string) => void;
  venues: { id: string; name: string }[];
}

export function VenueSelect({ value, onChange, venues }: VenueSelectProps) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm">
      <span className="text-text-secondary">Точка:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg-card border border-surface-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none cursor-pointer pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239FB4C6%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_8px_center]"
      >
        {venues.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </div>
  );
}
