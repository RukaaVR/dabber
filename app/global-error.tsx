"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#121318", color: "#ededf3", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", height: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center" }}>
          <h1>Something broke</h1>
          <p>Dabber hit a snag. Your messages are safe.</p>
          <button onClick={reset} style={{ background: "#7b61ff", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
