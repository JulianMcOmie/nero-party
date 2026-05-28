import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  opacity: number;
  size: number;
  brightness: number;
}

export function WaveParticles({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    // Clear particles when play starts (transition from false to true)
    if (isPlaying && !wasPlayingRef.current) {
      particlesRef.current = [];
    }
    wasPlayingRef.current = isPlaying;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    function createParticle(): Particle {
      // Left and right with 10-25 degree variance
      const isLeft = Math.random() > 0.5;
      const direction = isLeft ? Math.PI : 0;
      const angle = direction + (Math.random() - 0.5) * 0.4;
      const speed = 2.0;

      // Start at edges of song cover (±128 from center) with random y
      const startX = isLeft ? centerX - 128 : centerX + 128;
      const startY = centerY + (Math.random() - 0.5) * 256;

      return {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15,
        opacity: Math.random() * 0.5 + 0.3,
        size: Math.random() * 2 + 1,
        brightness: Math.random() * 80 + 100,
      };
    }

    function update() {
      if (isPlaying) {
        for (let i = 0; i < 5; i++) {
          particlesRef.current.push(createParticle());
        }
      }

      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.01;
        p.opacity = p.opacity * 0.97;
        return p.life > 0 && p.opacity > 0.01;
      });
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      if (isPlaying) {
        particlesRef.current.forEach((p) => {
          ctx.globalAlpha = p.opacity;
          ctx.fillStyle = `rgb(${p.brightness}, ${p.brightness}, ${p.brightness})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1;
    }

    let rafId: number;
    function loop() {
      update();
      render();
      rafId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
