import { useEffect, useRef } from "react";

export function BpmPulse({ bpm, isPlaying }: { bpm: number | null; isPlaying: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    console.log("[BpmPulse] bpm:", bpm, "isPlaying:", isPlaying);

    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];

    if (!containerRef.current || !bpm || !isPlaying) {
      return;
    }

    const beatDuration = 60000 / bpm;
    console.log("[BpmPulse] Starting pulse with beat duration:", beatDuration, "ms");
    console.log("[BpmPulse] Container ref:", containerRef.current);

    // Main strong pulses on each beat
    const createMainPulse = () => {
      console.log("[BpmPulse] Creating main pulse");
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          const pulse = document.createElement("div");
          pulse.style.position = "absolute";
          pulse.style.top = "0";
          pulse.style.right = "0";
          pulse.style.bottom = "0";
          pulse.style.left = "0";
          pulse.style.borderRadius = "0.5rem";
          pulse.style.pointerEvents = "none";
          pulse.style.border = "5px solid white";
          pulse.style.animation = `bpmPulse ${beatDuration}ms ease-out forwards`;
          pulse.style.animationDelay = `${i * 30}ms`;
          console.log("[BpmPulse] Appending pulse element", i);
          containerRef.current?.appendChild(pulse);
          setTimeout(() => {
            console.log("[BpmPulse] Removing pulse element", i);
            pulse.remove();
          }, beatDuration + 200);
        }, i * 30);
      }
    };

    // Subtle secondary pulses between beats
    const createSecondaryPulse = () => {
      const pulse = document.createElement("div");
      pulse.style.position = "absolute";
      pulse.style.top = "0";
      pulse.style.right = "0";
      pulse.style.bottom = "0";
      pulse.style.left = "0";
      pulse.style.borderRadius = "0.5rem";
      pulse.style.pointerEvents = "none";
      pulse.style.border = "4px solid white";
      pulse.style.animation = `bpmPulse ${beatDuration * 0.7}ms ease-out forwards`;
      containerRef.current?.appendChild(pulse);
      setTimeout(() => pulse.remove(), beatDuration * 0.7 + 100);
    };

    // Quick tertiary pulses for organic layering
    const createTertiaryPulse = () => {
      const pulse = document.createElement("div");
      pulse.style.position = "absolute";
      pulse.style.top = "0";
      pulse.style.right = "0";
      pulse.style.bottom = "0";
      pulse.style.left = "0";
      pulse.style.borderRadius = "0.5rem";
      pulse.style.pointerEvents = "none";
      pulse.style.border = "4px solid white";
      pulse.style.opacity = "0.7";
      pulse.style.animation = `bpmPulseVariant ${beatDuration * 1.3}ms ease-out forwards`;
      containerRef.current?.appendChild(pulse);
      setTimeout(() => pulse.remove(), beatDuration * 1.3 + 100);
    };

    // Start primary beat pulses
    createMainPulse();
    const mainInterval = setInterval(createMainPulse, beatDuration);
    intervalsRef.current.push(mainInterval);

    // Secondary pulses at mid-beat intervals
    createSecondaryPulse();
    const secondaryInterval = setInterval(createSecondaryPulse, beatDuration * 0.5);
    intervalsRef.current.push(secondaryInterval);

    // Tertiary pulses offset for visual complexity
    setTimeout(() => {
      createTertiaryPulse();
      const tertiaryInterval = setInterval(createTertiaryPulse, beatDuration * 0.65);
      intervalsRef.current.push(tertiaryInterval);
    }, beatDuration * 0.25);

    return () => {
      intervalsRef.current.forEach(clearInterval);
      intervalsRef.current = [];
    };
  }, [bpm, isPlaying]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 rounded-lg pointer-events-none"
      style={{ zIndex: 0, overflow: "hidden" }}
    />
  );
}
