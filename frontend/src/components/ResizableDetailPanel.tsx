import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onClose: () => void;
}

const WIDTH_KEY = "atlas_detail_panel_width";
const MIN_WIDTH = 360;
const MAX_WIDTH = 760;

function clampWidth(value: number) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - 40, value));
}

export default function ResizableDetailPanel({ children, onClose }: Props) {
  const [width, setWidth] = useState(() => {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    return clampWidth(Number.isFinite(stored) && stored > 0 ? stored : 430);
  });

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  function resize(nextWidth: number) {
    const next = clampWidth(nextWidth);
    setWidth(next);
    localStorage.setItem(WIDTH_KEY, String(next));
  }

  return (
    <div
      className="atlas-detail-panel absolute inset-0 z-30 shadow-[-24px_0_60px_rgba(0,0,0,.28)] sm:inset-y-0 sm:left-auto sm:right-0"
      style={{ "--detail-width": `${width}px` } as CSSProperties}
    >
      <div
        role="separator"
        aria-label="Redimensionner la fiche"
        aria-orientation="vertical"
        tabIndex={0}
        onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(window.innerWidth - event.clientX);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") resize(width + 24);
          if (event.key === "ArrowRight") resize(width - 24);
        }}
        className="group absolute inset-y-0 -left-2 z-40 hidden w-4 cursor-col-resize touch-none sm:block"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition group-hover:w-0.5 group-hover:bg-[#9eb5ff]/70 group-focus:bg-[#9eb5ff]" />
      </div>
      <button
        aria-label="Fermer la fiche"
        title="Fermer (Échap)"
        onClick={onClose}
        className="absolute right-3 top-[84px] z-50 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-[#090d15]/90 text-sm text-white shadow-xl backdrop-blur-xl hover:bg-[#1b2435] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#9eb5ff]"
      >
        ✕
      </button>
      {children}
    </div>
  );
}
