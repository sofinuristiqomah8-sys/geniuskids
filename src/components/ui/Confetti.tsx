"use client";

import { useMemo } from "react";

const PIECES = ["🎉", "⭐", "✨", "🌟", "🎊", "💫", "🥳"];

/**
 * A one-shot confetti burst rendered with pure CSS (kf-confetti keyframe).
 * Mounts, rains down once, then the pieces fade out. No dependency.
 */
export default function Confetti({ count = 40 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.4 + Math.random() * 2.2,
        size: 14 + Math.random() * 16,
        emoji: PIECES[i % PIECES.length],
      })),
    [count]
  );

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-6vh",
            fontSize: `${p.size}px`,
            animation: `kf-confetti ${p.duration}s linear ${p.delay}s forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
