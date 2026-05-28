import { useEffect, useRef } from "react";

interface Character {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export function BouncingCharacters({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const charactersRef = useRef<Character[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Initialize characters
    if (charactersRef.current.length === 0) {
      for (let i = 0; i < 20; i++) {
        charactersRef.current.push({
          id: i,
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: 30,
        });
      }
    }

    function update() {
      charactersRef.current.forEach((char) => {
        char.x += char.vx;
        char.y += char.vy;

        // Bounce off walls
        if (char.x - char.size < 0 || char.x + char.size > width) {
          char.vx *= -1;
          char.x = Math.max(char.size, Math.min(width - char.size, char.x));
        }
        if (char.y - char.size < 0 || char.y + char.size > height) {
          char.vy *= -1;
          char.y = Math.max(char.size, Math.min(height - char.size, char.y));
        }
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      if (isPlaying) {
        charactersRef.current.forEach((char) => {
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#999999";
          ctx.beginPath();
          ctx.arc(char.x, char.y, char.size, 0, Math.PI * 2);
          ctx.fill();

          // Draw a simple face
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = "#333333";
          ctx.beginPath();
          ctx.arc(char.x - 8, char.y - 5, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(char.x + 8, char.y - 5, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1;
    }

    function loop() {
      update();
      render();
      requestAnimationFrame(loop);
    }

    loop();
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={typeof window !== "undefined" ? window.innerWidth : 1200}
      height={typeof window !== "undefined" ? window.innerHeight : 800}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
