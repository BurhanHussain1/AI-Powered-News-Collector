"use client"
import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[FeedDigest] Page error:", error)
  }, [error])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <h2
          className="font-display font-bold text-xl mb-2"
          style={{ color: "var(--text)" }}
        >
          Something went wrong
        </h2>
        <p className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
          {error.message?.includes("unauthorized")
            ? "Your session has expired. Please sign in again."
            : "An unexpected error occurred. Try refreshing the page."}
        </p>
        <div className="flex gap-3 justify-center">
          {error.message?.includes("unauthorized") ? (
            <a href="/login" className="btn btn-primary">Sign In</a>
          ) : (
            <>
              <button onClick={() => reset()} className="btn btn-primary">Try Again</button>
              <a href="/" className="btn btn-secondary">Go Home</a>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
