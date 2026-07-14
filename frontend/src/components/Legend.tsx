import { CATEGORY_COLORS } from "../constants";
import { CATEGORY_LABELS } from "../types";
import type { Category } from "../types/graph";

export default function Legend() {
  const categories = Object.keys(CATEGORY_COLORS) as Category[];

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/80 px-3 py-2 backdrop-blur">

      {categories.map((cat) => (
        <span
          key={cat}
          className="flex items-center gap-1.5 text-xs text-ink-dim"
        >

          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: CATEGORY_COLORS[cat]
            }}
          />

          {CATEGORY_LABELS[cat]}

        </span>
      ))}

    </div>
  );
}