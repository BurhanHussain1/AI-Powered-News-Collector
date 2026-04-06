"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { login } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await login(username, password)
      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        setError(res.error || "Invalid username or password.")
      }
    } catch {
      setError("Could not connect to server. Is the FastAPI server running?")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: "var(--bg)" }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, var(--accent-glow) 0%, transparent 70%)",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-sm fade-in"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding: "2.5rem 2rem",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="text-4xl mb-2 leading-none"
            style={{ fontFamily: "var(--font-gothic)", color: "var(--text)" }}
          >
            FeedDigest
          </div>
          <p
            className="text-xs uppercase tracking-widest font-semibold"
            style={{ color: "var(--text-3)" }}
          >
            Members Only
          </p>
          <div
            className="mt-4 mx-auto"
            style={{
              width: "48px",
              height: "2px",
              background: "var(--accent)",
              borderRadius: "1px",
            }}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Username */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--text-2)" }}
            >
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Enter your username"
              className="input"
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-xs font-bold uppercase tracking-widest mb-2"
              style={{ color: "var(--text-2)" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="input"
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-xs px-3 py-2.5 rounded-lg"
              style={{
                color: "var(--red)",
                background: "var(--red-glow-md)",
                border: "1px solid var(--red-glow-md)",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full mt-2"
            style={{ padding: "0.75rem" }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" style={{ width: "16px", height: "16px" }} />
                Signing in…
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Footer note */}
        <p
          className="text-center text-xs mt-6"
          style={{ color: "var(--text-3)" }}
        >
          Don&apos;t have an account?{" "}
          <a href="/signup" style={{ color: "var(--accent)", textDecoration: "none" }}>
            Sign up free
          </a>
        </p>
      </div>

    </div>
  )
}
