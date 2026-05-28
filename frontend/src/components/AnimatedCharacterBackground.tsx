import { useEffect, useRef, useState } from "react";
import { ListeningCharacter } from "./ListeningCharacter";

interface CharacterState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function AnimatedCharacterBackground({ isPlaying }: { isPlaying: boolean }) {
  const [characters, setCharacters] = useState<CharacterState[]>([]);
  const charactersRef = useRef<CharacterState[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize characters
  useEffect(() => {
    if (charactersRef.current.length === 0) {
      const newCharacters: CharacterState[] = [];
      for (let i = 0; i < 20; i++) {
        newCharacters.push({
          id: i,
          x: Math.random() * (window.innerWidth - 100),
          y: Math.random() * (window.innerHeight - 100),
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
        });
      }
      charactersRef.current = newCharacters;
      setCharacters([...newCharacters]);
    }
  }, []);

  // Animation loop
  useEffect(() => {
    let rafId: number;

    const animate = () => {
      const container = containerRef.current;
      if (!container) {
        rafId = requestAnimationFrame(animate);
        return;
      }

      const width = window.innerWidth;
      const height = window.innerHeight;
      const charSize = 35;

      charactersRef.current.forEach((char) => {
        // Update position
        char.x += char.vx;
        char.y += char.vy;

        // Bounce off walls
        if (char.x <= 0 || char.x + charSize >= width) {
          char.vx *= -1;
          char.x = Math.max(0, Math.min(width - charSize, char.x));
        }
        if (char.y <= 0 || char.y + charSize >= height) {
          char.vy *= -1;
          char.y = Math.max(0, Math.min(height - charSize, char.y));
        }
      });

      setCharacters([...charactersRef.current]);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {characters.map((char) => (
        <div
          key={char.id}
          style={{
            position: "absolute",
            left: char.x,
            top: char.y,
            opacity: 0.08,
            transition: "none",
          }}
        >
          <ListeningCharacter isNodding={isPlaying} />
        </div>
      ))}
    </div>
  );
}
