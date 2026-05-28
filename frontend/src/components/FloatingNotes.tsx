const NOTES = [
  { char: "♪", x: "5%",  y: "14%", size: 22, opacity: 0.07, duration: 8,  delay: 0   },
  { char: "♫", x: "93%", y: "7%",  size: 18, opacity: 0.06, duration: 11, delay: 2.5 },
  { char: "♩", x: "88%", y: "71%", size: 20, opacity: 0.07, duration: 9,  delay: 4   },
  { char: "♬", x: "3%",  y: "79%", size: 24, opacity: 0.08, duration: 13, delay: 1.5 },
  { char: "♪", x: "47%", y: "3%",  size: 14, opacity: 0.05, duration: 10, delay: 6   },
  { char: "♫", x: "13%", y: "52%", size: 16, opacity: 0.06, duration: 12, delay: 3   },
  { char: "♩", x: "75%", y: "41%", size: 18, opacity: 0.05, duration: 15, delay: 7   },
  { char: "♬", x: "39%", y: "92%", size: 20, opacity: 0.07, duration: 9,  delay: 5   },
  { char: "♪", x: "21%", y: "88%", size: 16, opacity: 0.06, duration: 11, delay: 8   },
  { char: "♫", x: "67%", y: "91%", size: 14, opacity: 0.05, duration: 14, delay: 2   },
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
            animation: `note-float ${n.duration}s ease-in-out ${n.delay}s infinite, note-wiggle 0.8s ease-in-out infinite`,
            animationPlayState: isPlaying ? 'running' : 'paused',
            transformOrigin: 'center center',
          }}
        >
          {n.char}
        </span>
      ))}
    </div>
  );
}
