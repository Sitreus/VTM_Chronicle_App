import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught:", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleClearAndReload = () => {
    try { localStorage.clear(); } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #08080d 0%, #0d0d14 40%, #0a0a12 100%)",
        color: "#efe5d2",
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 40,
      }}>
        <div style={{
          maxWidth: 520, textAlign: "center",
          background: "rgba(14,14,22,0.92)", border: "1px solid #2a2a35",
          borderRadius: 8, padding: 36,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
          <h2 style={{
            fontFamily: "'Cinzel', serif", fontSize: 24, fontWeight: 700,
            letterSpacing: 3, color: "#c41e3a", marginBottom: 12,
          }}>
            Something Went Wrong
          </h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#a09888", marginBottom: 8 }}>
            The chronicle keeper encountered an unexpected error.
          </p>
          <details style={{
            textAlign: "left", marginBottom: 24, padding: 12,
            background: "rgba(0,0,0,0.3)", borderRadius: 4, fontSize: 14,
            color: "#7a7068", cursor: "pointer",
          }}>
            <summary style={{ color: "#a09888" }}>Error details</summary>
            <pre style={{
              marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word",
              fontFamily: "monospace", fontSize: 13, color: "#e88080",
            }}>
              {this.state.error?.message || "Unknown error"}
            </pre>
          </details>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={this.handleReset} style={{
              background: "rgba(196,30,58,0.15)", border: "1px solid rgba(196,30,58,0.4)",
              color: "#e8dcc6", padding: "10px 24px", borderRadius: 4, cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 2,
              textTransform: "uppercase",
            }}>
              Try Again
            </button>
            <button onClick={this.handleClearAndReload} style={{
              background: "transparent", border: "1px solid #3a3a45",
              color: "#a09888", padding: "10px 24px", borderRadius: 4, cursor: "pointer",
              fontFamily: "'Cinzel', serif", fontSize: 14, letterSpacing: 2,
              textTransform: "uppercase",
            }}>
              Reset App Data
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#5a5450", marginTop: 16 }}>
            "Try Again" attempts to recover. "Reset App Data" clears all saved data and reloads.
          </p>
        </div>
      </div>
    );
  }
}
