/**
 * Tiny deterministic avatar: a circle filled with an HSL color derived from
 * the avatar seed, with the participant's first initial inside.
 */
function colorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 35%, 38%)`;
}

const sizes = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
} as const;

export function Avatar({
  name,
  seed,
  size = "md",
}: {
  name: string;
  seed: string;
  size?: keyof typeof sizes;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center rounded-full text-foreground`}
      style={{ backgroundColor: colorFromSeed(seed || name) }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
