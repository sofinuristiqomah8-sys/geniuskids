"use client";

import { useEffect } from "react";

/**
 * Last-resort error boundary that also catches failures in the root layout
 * (which the normal error.tsx cannot). It must render its own <html>/<body>.
 * We keep it dependency-free and show the digest so production errors are
 * diagnosable instead of a blank 500.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#1e2a52",
          background: "#f6f9ff",
        }}
      >
        <div style={{ fontSize: "3.5rem" }}>🙈</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>Ada kendala teknis</h1>
        <p style={{ maxWidth: "22rem", fontSize: "0.875rem", color: "#55607d" }}>
          Maaf, terjadi kesalahan. Coba lagi sebentar ya.
        </p>
        {error?.message && (
          <p
            style={{
              maxWidth: "26rem",
              wordBreak: "break-word",
              borderRadius: "0.75rem",
              background: "#edf2fc",
              padding: "0.5rem 0.75rem",
              fontSize: "0.75rem",
              color: "#9aa3bc",
            }}
          >
            {error.message}
          </p>
        )}
        {error?.digest && (
          <p style={{ fontSize: "11px", fontWeight: 600, color: "#9aa3bc" }}>
            Kode error: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: "0.75rem",
            borderRadius: "9999px",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            padding: "0.625rem 1.25rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Coba Lagi
        </button>
      </body>
    </html>
  );
}
