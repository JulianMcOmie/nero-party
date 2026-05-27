import { useState } from "react";
import { StarIcon } from "./icons";

export function StarRating({
  value,
  onChange,
  disabled = false,
  max = 5,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const display = disabled ? value : (hovered || value);

  return (
    <div
      className="flex gap-1.5"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => !disabled && setHovered(n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          className="text-foreground disabled:opacity-50"
        >
          <StarIcon className="h-7 w-7" filled={n <= display} />
        </button>
      ))}
    </div>
  );
}
