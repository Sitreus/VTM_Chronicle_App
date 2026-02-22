/**
 * AudioControl — Minimal mute/volume toggle for the audio engine.
 * Renders a small icon button that toggles mute on click.
 */
export default function AudioControl({ audio }) {
  if (!audio) return null;

  return (
    <button
      onClick={() => audio.toggleMute()}
      title={audio.muted ? "Unmute audio" : "Mute audio"}
      style={{
        background: "none",
        border: "1px solid rgba(255,255,255,0.1)",
        color: audio.muted ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)",
        padding: "6px 10px",
        borderRadius: 16,
        cursor: "pointer",
        fontSize: 14,
        transition: "all 0.3s ease",
        lineHeight: 1,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
        e.currentTarget.style.color = "rgba(255,255,255,0.7)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        e.currentTarget.style.color = audio.muted ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.5)";
      }}
    >
      {audio.muted ? "\u{1F507}" : "\u{1F50A}"}
    </button>
  );
}
