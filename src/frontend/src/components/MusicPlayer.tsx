import { useCallback, useEffect, useRef, useState } from "react";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const tryPlay = useCallback((audio: HTMLAudioElement) => {
    audio.volume = 0.5;
    return audio.play().then(() => {
      setPlaying(true);
      setBlocked(false);
    });
  }, []);

  // Try to autoplay on mount once audio is ready
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onCanPlay = () => {
      tryPlay(audio).catch(() => {
        setBlocked(true);
      });
    };

    audio.addEventListener("canplaythrough", onCanPlay, { once: true });
    // Trigger load
    audio.load();

    return () => {
      audio.removeEventListener("canplaythrough", onCanPlay);
    };
  }, [tryPlay]);

  // If autoplay was blocked, start music on first click anywhere
  useEffect(() => {
    if (!blocked) return;

    const unlock = () => {
      const audio = audioRef.current;
      if (!audio) return;
      tryPlay(audio).catch(() => {});
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [blocked, tryPlay]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      tryPlay(audio).catch(() => setPlaying(false));
    }
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: background ambient music, no speech content */}
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src="/assets/Ladki Kyon Na Jane Kyon Hum Tum 128 Kbps.mp3"
      />

      {/* Tap-to-start hint shown when autoplay is blocked */}
      {blocked && (
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 999,
            background: "oklch(0.1 0.04 300 / 0.92)",
            border: "1px solid oklch(0.62 0.22 350 / 0.7)",
            borderRadius: "1rem",
            padding: "1.25rem 2rem",
            color: "oklch(0.9 0.18 55)",
            fontFamily: "Georgia, serif",
            fontSize: "1.1rem",
            textAlign: "center",
            backdropFilter: "blur(20px)",
            boxShadow: "0 0 60px oklch(0.62 0.25 20 / 0.6)",
            pointerEvents: "none",
            animation: "pulse 1.8s ease-in-out infinite",
          }}
        >
          ♪ Tap anywhere to start music ♪
        </div>
      )}

      {/* Floating pill button */}
      <button
        type="button"
        data-ocid="music.toggle"
        onClick={toggle}
        aria-label={
          playing ? "Pause background music" : "Play background music"
        }
        style={{
          position: "fixed",
          bottom: "2.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 35,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 18px",
          borderRadius: "999px",
          border: "1px solid oklch(0.55 0.22 350 / 0.35)",
          background: "oklch(0.1 0.04 300 / 0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          boxShadow:
            "0 0 18px oklch(0.62 0.25 20 / 0.25), inset 0 1px 0 oklch(0.8 0.1 350 / 0.12)",
          cursor: "pointer",
          color: playing
            ? "oklch(0.82 0.14 75)"
            : blocked
              ? "oklch(0.75 0.14 350)"
              : "oklch(0.65 0.08 290)",
          fontSize: "0.75rem",
          letterSpacing: "0.12em",
          fontFamily: "Georgia, serif",
          transition: "all 0.25s ease",
          pointerEvents: "auto",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "oklch(0.72 0.22 350 / 0.65)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 30px oklch(0.62 0.25 20 / 0.45), inset 0 1px 0 oklch(0.8 0.1 350 / 0.2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "oklch(0.55 0.22 350 / 0.35)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 0 18px oklch(0.62 0.25 20 / 0.25), inset 0 1px 0 oklch(0.8 0.1 350 / 0.12)";
        }}
      >
        <span style={{ fontSize: "1rem" }}>
          {playing ? "♪" : blocked ? "♪" : "🔇"}
        </span>
        <span>
          {playing ? "Music ON" : blocked ? "Tap to Play" : "Music OFF"}
        </span>
      </button>
    </>
  );
}
