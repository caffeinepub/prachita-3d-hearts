import { useEffect, useRef, useState } from "react";

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!hasInteracted) {
      setHasInteracted(true);
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  return (
    <>
      {/* Hidden audio element */}
      {/* biome-ignore lint/a11y/useMediaCaption: background ambient music, no speech content */}
      <audio
        ref={audioRef}
        loop
        preload="auto"
        src="https://cdn.pixabay.com/audio/2022/10/30/audio_8ead710b97.mp3"
      />

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
          color: playing ? "oklch(0.82 0.14 75)" : "oklch(0.65 0.08 290)",
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
        <span style={{ fontSize: "1rem" }}>{playing ? "♪" : "🔇"}</span>
        <span>{playing ? "Music ON" : "Music OFF"}</span>
      </button>
    </>
  );
}
