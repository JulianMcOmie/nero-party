import { useEffect, useRef } from "react";

export function BpmPulse({ bpm, isPlaying }: { bpm: number | null; isPlaying: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const pulseCountRef = useRef(0);

  useEffect(() => {
    console.log("[BpmPulse] bpm:", bpm, "isPlaying:", isPlaying);
    if (!containerRef.current || !bpm || !isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const beatDuration = 60000 / bpm;
    console.log("[BpmPulse] Starting pulse with beat duration:", beatDuration, "ms");

    const createPulse = () => {
      const pulse = document.createElement("div");
      pulse.className = "absolute inset-0 rounded-lg pointer-events-none";
      pulse.style.border = "2px solid rgba(255, 255, 255, 0.8)";
      pulse.style.animation = `bpmPulse ${beatDuration}ms ease-out forwards`;
      containerRef.current?.appendChild(pulse);

      setTimeout(() => pulse.remove(), beatDuration);
    };

    createPulse();
    intervalRef.current = setInterval(createPulse, beatDuration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [bpm, isPlaying]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 rounded-lg pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
