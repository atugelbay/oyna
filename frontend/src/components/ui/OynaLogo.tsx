export function OynaLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        {["O", "Y", "N", "A"].map((letter) => (
          <div
            key={letter}
            className="
              w-28 h-28 rounded-2xl
              bg-gradient-to-b from-bg-secondary to-bg-primary
              border border-white/10
              flex items-center justify-center
              shadow-[0_0_30px_rgba(0,229,255,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]
            "
          >
            <span
              className="
                text-5xl font-black text-cyan
                drop-shadow-[0_0_20px_rgba(0,229,255,0.6)]
              "
            >
              {letter}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
