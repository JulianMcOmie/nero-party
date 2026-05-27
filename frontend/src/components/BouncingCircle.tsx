import { useEffect, useRef } from "react";

export function BouncingCircle({ width = 240, height = 50 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ball = {
      x: width / 2,
      y: height / 2,
      r: 12,
      spd: 13,
      show: function (alpha: number = 1) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      },
      update: function () {
        if (this.x > width / 2 + 60 || this.x < width / 2 - 60) {
          this.spd *= -1;
        }
        this.x += this.spd;
      },
    };

    const trail: Array<{ x: number; y: number }> = [];
    const maxTrailLength = 5;

    function update() {
      ball.update();
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > maxTrailLength) {
        trail.shift();
      }
    }

    function render() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < trail.length; i++) {
        const pos = trail[i];
        const alpha = (i + 1) / trail.length * 0.25;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.fillStyle = "white";
        ctx.arc(pos.x, pos.y, ball.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ball.show(1);
    }

    function loop() {
      update();
      render();
      setTimeout(loop, 100);
    }

    loop();
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ display: "block", margin: "0 auto" }} />;
}
