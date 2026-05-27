import { useState, useEffect } from "react";
import { StarIcon, CheckIcon } from "./icons";

export function StarRating({
  value,
  onChange,
  onConfirm,
  disabled = false,
  max = 5,
}: {
  value: number;
  onChange: (n: number) => void;
  onConfirm?: () => void;
  disabled?: boolean;
  max?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const [showCheckmark, setShowCheckmark] = useState(false);
  const display = disabled ? value : (hovered || value);

  useEffect(() => {
    setShowCheckmark(value > 0 && !disabled);
  }, [value, disabled]);

  const handleCheckmarkClick = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  return (
    <div className="relative inline-flex">
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
      {showCheckmark && (
        <button
          type="button"
          onClick={handleCheckmarkClick}
          className="absolute flex items-center justify-center cursor-pointer group"
          style={{
            left: 'calc(100% + 20px)',
            top: '4px',
            animation: 'checkmark-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
          aria-label="Confirm rating"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors duration-200" />
            <CheckIcon className="h-5 w-5 text-white relative z-10 group-hover:brightness-125 transition-all duration-200" />
          </div>
        </button>
      )}
    </div>
  );
}
