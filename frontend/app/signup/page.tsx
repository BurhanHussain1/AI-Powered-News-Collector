"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { sendOtp, verifyOtp, resendOtp } from "@/lib/api"
import { AVATARS, DEFAULT_AVATAR_ID } from "@/lib/avatars"

// ── OTP input: 6 individual boxes ─────────────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const digits  = Array.from({ length: 6 }, (_, i) => value[i] ?? "")

  function focus(i: number) {
    inputs.current[Math.max(0, Math.min(5, i))]?.focus()
  }

  function handleChange(i: number, raw: string) {
    // Accept only digits
    const digit = raw.replace(/\D/g, "").slice(-1)
    const next  = digits.slice()
    next[i]     = digit
    onChange(next.join("").replace(/\s/g, ""))
    if (digit) focus(i + 1)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = digits.slice()
        next[i]    = ""
        onChange(next.join(""))
      } else {
        focus(i - 1)
      }
    } else if (e.key === "ArrowLeft")  { e.preventDefault(); focus(i - 1) }
    else if (e.key === "ArrowRight")   { e.preventDefault(); focus(i + 1) }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    onChange(pasted)
    focus(Math.min(pasted.length, 5))
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onFocus={e => e.target.select()}
          className="text-center font-mono font-bold transition-all"
          style={{
            width:        "48px",
            height:       "56px",
            fontSize:     "1.5rem",
            borderRadius: "var(--radius-md)",
            border:       `2px solid ${d ? "var(--accent)" : "var(--border-bright)"}`,
            background:   d ? "var(--accent-glow)" : "var(--surface-raised)",
            color:        "var(--text)",
            outline:      "none",
            caretColor:   "var(--accent)",
          }}
        />
      ))}
    </div>
  )
}

// ── Resend countdown timer ─────────────────────────────────────────────────────
function ResendTimer({
  onResend,
  maskedEmail,
}: {
  onResend: () => Promise<void>
  maskedEmail: string
}) {
  const [seconds, setSeconds]   = useState(60)
  const [resending, setResending] = useState(false)
  const [message, setMessage]   = useState("")

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  async function handleResend() {
    setResending(true)
    setMessage("")
    try {
      await onResend()
      setSeconds(60)
      setMessage("New code sent!")
    } catch {
      setMessage("Failed to resend. Try again.")
    } finally {
      setResending(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  return (
    <div className="text-center">
      {message && (
        <p className="text-xs mb-2 font-medium" style={{ color: "var(--accent)" }}>{message}</p>
      )}
      <p className="text-sm" style={{ color: "var(--text-3)" }}>
        Code sent to <span style={{ color: "var(--text-2)" }}>{maskedEmail}</span>
      </p>
      <div className="mt-2">
        {seconds > 0 ? (
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            Resend available in{" "}
            <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
              0:{String(seconds).padStart(2, "0")}
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-xs font-semibold transition-all"
            style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main signup page ───────────────────────────────────────────────────────────
type Step = "avatar" | "details" | "verify"

export default function SignupPage() {
  const router = useRouter()

  const [step, setStep]         = useState<Step>("avatar")
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID)
  const [form, setForm]         = useState({ name: "", username: "", email: "", password: "", confirm: "" })
  const [otp, setOtp]           = useState("")
  const [maskedEmail, setMaskedEmail] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [verifying, setVerifying] = useState(false)

  const selectedAvatar = AVATARS.find(a => a.id === avatarId) ?? AVATARS[0]

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError("")
  }

  // ── Step 2 submit: send OTP ──────────────────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (form.password !== form.confirm) { setError("Passwords do not match."); return }
    if (form.password.length < 8)       { setError("Password must be at least 8 characters."); return }

    setLoading(true)
    try {
      const res = await sendOtp({
        name:     form.name.trim(),
        username: form.username.trim(),
        email:    form.email.trim(),
        password: form.password,
        avatar:   avatarId,
      })
      if (res.ok) {
        setMaskedEmail(res.masked_email || form.email)
        setStep("verify")
      } else {
        setError(res.detail || "Could not send verification email.")
      }
    } catch {
      setError("Could not connect to server.")
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3 submit: verify OTP ────────────────────────────────────────────
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (otp.length < 6) { setError("Please enter all 6 digits."); return }
    setError("")
    setVerifying(true)
    try {
      const res = await verifyOtp(form.email.trim(), otp)
      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        setError(res.detail || "Invalid code.")
      }
    } catch {
      setError("Could not connect to server.")
    } finally {
      setVerifying(false)
    }
  }

  // ── Resend handler ───────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    const res = await resendOtp(form.email.trim())
    if (!res.ok) throw new Error(res.detail)
  }, [form.email])

  // ── Step indicator ───────────────────────────────────────────────────────
  const STEPS: { id: Step; label: string }[] = [
    { id: "avatar",  label: "Avatar"  },
    { id: "details", label: "Details" },
    { id: "verify",  label: "Verify"  },
  ]
  const currentIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{ background: "var(--bg)" }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 40%, var(--accent-glow) 0%, transparent 70%)" }}
      />

      <div
        className="relative z-10 w-full fade-in"
        style={{
          maxWidth:     step === "avatar" ? "560px" : "460px",
          background:   "var(--surface)",
          border:       "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding:      "2.5rem 2rem",
          boxShadow:    "var(--shadow-xl)",
          transition:   "max-width 0.3s ease",
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <a href="/" style={{ fontFamily: "var(--font-gothic)", fontSize: "1.75rem", color: "var(--text)", textDecoration: "none" }}>
            FeedDigest
          </a>
          <p className="text-xs uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-3)" }}>
            {step === "avatar" ? "Choose Your Agent" : step === "details" ? "Create Account" : "Verify Email"}
          </p>
          <div className="mt-3 mx-auto" style={{ width: "48px", height: "2px", background: "var(--accent)", borderRadius: "1px" }} />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1 justify-center mb-7">
          {STEPS.map((s, i) => {
            const done   = i < currentIdx
            const active = i === currentIdx
            return (
              <div key={s.id} className="flex items-center gap-1">
                <div
                  className="flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    width:        "26px",
                    height:       "26px",
                    borderRadius: "50%",
                    background:   done ? "var(--green)" : active ? "var(--accent)" : "var(--surface-raised)",
                    color:        done || active ? "#fff" : "var(--text-3)",
                    border:       `2px solid ${done ? "var(--green)" : active ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className="text-[10px] font-semibold hidden sm:block" style={{ color: active ? "var(--text)" : "var(--text-3)" }}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div style={{ width: "20px", height: "2px", background: done ? "var(--green)" : "var(--border)", borderRadius: "1px", margin: "0 2px" }} />
                )}
              </div>
            )
          })}
        </div>

        {/* ══ Step 1: Avatar ═══════════════════════════════════════════ */}
        {step === "avatar" && (
          <div>
            <div className="flex flex-col items-center mb-6">
              <div style={{ width: "96px", height: "96px", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "3px solid var(--accent)", boxShadow: "0 4px 24px rgba(0,0,0,0.2), 0 0 0 4px var(--accent-glow)", background: "var(--surface-raised)", marginBottom: "0.6rem" }}>
                <Image src={selectedAvatar.url} alt={selectedAvatar.label} width={96} height={96}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} priority unoptimized />
              </div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{selectedAvatar.label}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{selectedAvatar.caption}</p>
            </div>

            <div className="grid mb-6" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
              {AVATARS.map(av => {
                const isActive = avatarId === av.id
                return (
                  <button key={av.id} type="button" title={`${av.label} — ${av.caption}`}
                    onClick={() => setAvatarId(av.id)}
                    className="relative flex flex-col items-center gap-1 transition-all"
                    style={{ borderRadius: "var(--radius-md)", padding: "0.45rem 0.25rem 0.3rem", border: `2px solid ${isActive ? "var(--accent)" : "transparent"}`, cursor: "pointer", background: isActive ? "var(--accent-glow)" : "var(--surface-raised)", outline: "none", boxShadow: isActive ? "0 0 0 2px var(--accent-glow-md)" : "none" }}
                  >
                    <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
                      <Image src={av.url} alt={av.label} width={48} height={48} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} unoptimized />
                    </div>
                    <span className="text-[10px] font-semibold leading-tight" style={{ color: isActive ? "var(--accent)" : "var(--text-2)" }}>{av.label}</span>
                    {isActive && (
                      <div className="absolute top-1 right-1 flex items-center justify-center"
                        style={{ width: "14px", height: "14px", borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: "8px", fontWeight: 700 }}>✓</div>
                    )}
                  </button>
                )
              })}
            </div>

            <button type="button" className="btn btn-primary w-full" style={{ padding: "0.75rem" }} onClick={() => setStep("details")}>
              Continue as {selectedAvatar.label} — {selectedAvatar.caption} →
            </button>
          </div>
        )}

        {/* ══ Step 2: Account details ═══════════════════════════════════ */}
        {step === "details" && (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
            {/* Avatar pill */}
            <button type="button" onClick={() => setStep("avatar")}
              className="flex items-center gap-3 px-3 py-2 rounded-lg self-start transition-all"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", cursor: "pointer" }}
            >
              <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", border: "2px solid var(--accent)", flexShrink: 0 }}>
                <Image src={selectedAvatar.url} alt={selectedAvatar.label} width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{selectedAvatar.label}</p>
                <p className="text-[10px]" style={{ color: "var(--text-3)" }}>tap to change</p>
              </div>
            </button>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>Full Name</label>
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" autoComplete="name" className="input" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>Username <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="text" value={form.username} onChange={e => set("username", e.target.value)} required placeholder="Choose a username" autoComplete="username" className="input" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>Email <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)} required placeholder="you@example.com" autoComplete="email" className="input" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>Password <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required placeholder="Min. 8 characters" autoComplete="new-password" className="input" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>Confirm Password <span style={{ color: "var(--red)" }}>*</span></label>
              <input type="password" value={form.confirm} onChange={e => set("confirm", e.target.value)} required placeholder="Repeat your password" autoComplete="new-password" className="input" />
            </div>

            {error && (
              <div className="text-xs px-3 py-2.5 rounded-lg" style={{ color: "var(--red)", background: "var(--red-glow-md)", border: "1px solid var(--red-glow-md)" }}>{error}</div>
            )}

            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setStep("avatar")} className="btn btn-secondary" style={{ padding: "0.75rem 1rem" }}>← Back</button>
              <button type="submit" disabled={loading} className="btn btn-primary flex-1" style={{ padding: "0.75rem" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner" style={{ width: "16px", height: "16px" }} />
                    Sending code…
                  </span>
                ) : "Send Verification Code →"}
              </button>
            </div>
          </form>
        )}

        {/* ══ Step 3: OTP verification ══════════════════════════════════ */}
        {step === "verify" && (
          <form onSubmit={handleVerify} className="flex flex-col gap-6">
            {/* Icon */}
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex items-center justify-center"
                style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--accent-glow)", border: "2px solid var(--accent-glow-md)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Check your inbox</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  We sent a 6-digit code to <span style={{ color: "var(--text-2)" }}>{maskedEmail}</span>
                </p>
              </div>
            </div>

            {/* OTP boxes */}
            <div className="flex flex-col gap-3">
              <OtpInput value={otp} onChange={v => { setOtp(v); setError("") }} disabled={verifying} />
              {error && (
                <p className="text-xs text-center" style={{ color: "var(--red)" }}>{error}</p>
              )}
            </div>

            {/* Verify button */}
            <button
              type="submit"
              disabled={verifying || otp.length < 6}
              className="btn btn-primary w-full"
              style={{ padding: "0.75rem", opacity: otp.length < 6 ? 0.6 : 1 }}
            >
              {verifying ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="spinner" style={{ width: "16px", height: "16px" }} />
                  Verifying…
                </span>
              ) : "Verify & Create Account"}
            </button>

            {/* Resend + timer */}
            <ResendTimer maskedEmail={maskedEmail} onResend={handleResend} />

            {/* Back link */}
            <p className="text-center text-xs" style={{ color: "var(--text-3)" }}>
              Wrong email?{" "}
              <button type="button" onClick={() => { setStep("details"); setOtp(""); setError("") }}
                style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}>
                Go back
              </button>
            </p>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-3)" }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "var(--accent)", textDecoration: "none" }}>Sign in</a>
        </p>
      </div>
    </div>
  )
}
