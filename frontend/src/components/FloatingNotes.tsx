const NOTES = [
  { char: "♪", x: "5%",  y: "14%", size: 22, opacity: 0.07, duration: 8,  delay: 0,   nx: [ 22, -14,  28], ny: [-28, -48, -16] },
  { char: "♫", x: "93%", y: "7%",  size: 18, opacity: 0.06, duration: 11, delay: 2.5, nx: [-20,  12, -30], ny: [-18, -42, -28] },
  { char: "♩", x: "88%", y: "71%", size: 20, opacity: 0.07, duration: 9,  delay: 4,   nx: [-25,  18, -10], ny: [-35, -18, -50] },
  { char: "♬", x: "3%",  y: "79%", size: 24, opacity: 0.08, duration: 13, delay: 1.5, nx: [ 30, -20,  15], ny: [-22, -44, -10] },
  { char: "♪", x: "47%", y: "3%",  size: 14, opacity: 0.05, duration: 10, delay: 6,   nx: [-15,  24,  -8], ny: [-38, -20, -52] },
  { char: "♫", x: "13%", y: "52%", size: 16, opacity: 0.06, duration: 12, delay: 3,   nx: [ 18, -26,  22], ny: [-30, -50, -14] },
  { char: "♩", x: "75%", y: "41%", size: 18, opacity: 0.05, duration: 15, delay: 7,   nx: [-22,  16, -28], ny: [-24, -46, -32] },
  { char: "♬", x: "39%", y: "92%", size: 20, opacity: 0.07, duration: 9,  delay: 5,   nx: [ 25, -12,  20], ny: [-40, -20, -55] },
  { char: "♪", x: "21%", y: "88%", size: 16, opacity: 0.06, duration: 11, delay: 8,   nx: [-18,  28, -10], ny: [-32, -52, -18] },
  { char: "♫", x: "67%", y: "91%", size: 14, opacity: 0.05, duration: 14, delay: 2,   nx: [ 20, -16,  26], ny: [-26, -44, -38] },
];

export function FloatingNotes({ isPlaying = false }: { isPlaying?: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 10 }}>
      {NOTES.map((n, i) => (
        <span
          key={i}
          className="absolute select-none"
          style={{
            left: n.x,
            top: n.y,
            fontSize: n.size,
            opacity: n.opacity,
            animation: `note-drift ${n.duration}s ease-in-out ${n.delay}s infinite, note-wiggle 0.8s ease-in-out infinite`,
            animationPlayState: `running, ${isPlaying ? 'running' : 'paused'}`,
            transformOrigin: 'center center',
            '--nx1': `${n.nx[0]}px`,
            '--ny1': `${n.ny[0]}px`,
            '--nx2': `${n.nx[1]}px`,
            '--ny2': `${n.ny[1]}px`,
            '--nx3': `${n.nx[2]}px`,
            '--ny3': `${n.ny[2]}px`,
          } as React.CSSProperties}
        >
          {n.char}
        </span>
      ))}
    </div>
  );
}
