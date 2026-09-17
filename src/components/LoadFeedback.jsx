export default function LoadFeedback({ error, loading, label, onRetry, themeTokens }) {
  if (!error && !loading) return null;
  return (
    <div role={error ? "alert" : "status"} style={{ padding: "12px 16px", color: themeTokens.text, fontSize: 13, overflowWrap: "anywhere" }}>
      <span>{error || `Loading ${label.toLowerCase()}...`}</span>
      {error && (
        <button type="button" onClick={onRetry} disabled={loading}
          aria-label={`Retry ${label.toLowerCase()}`}
          style={{ marginLeft: 8, color: themeTokens.accent, background: "transparent", border: "none", cursor: "pointer", font: "inherit" }}>
          {loading ? "Retrying..." : "Retry"}
        </button>
      )}
    </div>
  );
}