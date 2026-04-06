"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { getProfile, updateProfile } from "@/lib/api"
import type { UserProfile } from "@/lib/types"
import { AVATARS, getAvatarUrl, DEFAULT_AVATAR_ID, type Avatar } from "@/lib/avatars"

const INTEREST_OPTIONS = [
  { id: "ai_models",     label: "New Models",          icon: "🚀", desc: "Model releases, HuggingFace" },
  { id: "ai_research",   label: "Research Papers",     icon: "🔬", desc: "ArXiv, Papers With Code" },
  { id: "agentic_ai",    label: "AI Agents",           icon: "🤖", desc: "LangChain, LlamaIndex, AutoGen" },
  { id: "company_blogs", label: "Company News",        icon: "🏢", desc: "Anthropic, OpenAI, Google" },
  { id: "tech_stack",    label: "Tech & Tools",        icon: "🛠", desc: "Dev.to, The New Stack" },
  { id: "business_news", label: "Business & Industry", icon: "📈", desc: "TechCrunch, VentureBeat" },
  { id: "security",      label: "Security",            icon: "🔒", desc: "CVEs, breaches, advisories" },
]

function AvatarImg({ id, size = 64, ring = false }: { id: string; size?: number; ring?: boolean }) {
  const av  = AVATARS.find(a => a.id === id) as Avatar | undefined
  const url = av ? av.url : getAvatarUrl(id)
  return (
    <div
      style={{
        width:        size,
        height:       size,
        borderRadius: "var(--radius-lg)",   // rounded square — matches bot aesthetic
        overflow:     "hidden",
        border:       ring ? "3px solid var(--accent)" : "1px solid var(--border)",
        boxShadow:    ring ? "0 4px 20px rgba(0,0,0,0.2), 0 0 0 4px var(--accent-glow)" : "0 2px 10px rgba(0,0,0,0.12)",
        background:   "var(--surface-raised)",
        flexShrink:   0,
      }}
    >
      <Image
        src={url}
        alt={av?.label ?? id}
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        unoptimized
        priority={size > 50}
      />
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [name, setName] = useState("")
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID)
  const [showPicker, setShowPicker] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)

  const selectedAv = AVATARS.find(a => a.id === avatarId) as Avatar | undefined
  const selectedAvLabel   = selectedAv?.label   ?? avatarId
  const selectedAvCaption = selectedAv?.caption ?? "AI Agent"

  useEffect(() => {
    getProfile()
      .then(p => {
        setProfile(p)
        setName(p.name || "")
        setAvatarId(p.avatar || DEFAULT_AVATAR_ID)
        const saved = (p.interests || "").split(",").map(s => s.trim()).filter(Boolean)
        setSelected(new Set(saved))
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false))
  }, [])

  function toggleInterest(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile({ name, interests: [...selected].join(","), avatar: avatarId })
      setToast({ text: "Profile saved!", ok: true })
      setTimeout(() => router.push("/"), 800)
    } catch {
      setToast({ text: "Failed to save. Try again.", ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3500)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="spinner spinner-dark" style={{ width: "32px", height: "32px" }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* Sticky header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mx-auto px-6 h-14 flex items-center justify-between" style={{ maxWidth: "var(--max-w)" }}>
          <div className="flex items-center gap-3">
            <a href="/" style={{ fontFamily: "var(--font-gothic)", fontSize: "1.25rem", color: "var(--text)", textDecoration: "none" }}>
              FeedDigest
            </a>
            <span className="badge badge-accent">Profile</span>
          </div>
          <a href="/" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Back to Digest</a>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full px-4 sm:px-6 py-10" style={{ maxWidth: "680px" }}>

        {/* Toast */}
        {toast && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-sm font-medium fade-in"
            style={{
              background: toast.ok ? "var(--green-glow)" : "var(--red-glow-md)",
              color:      toast.ok ? "var(--green)"      : "var(--red)",
              border:     `1px solid ${toast.ok ? "var(--green-glow)" : "var(--red-glow-md)"}`,
            }}
          >
            {toast.text}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* ── Avatar + account info ──────────────────────── */}
          <div className="card p-6">
            {/* Hero row */}
            <div className="flex items-center gap-5 pb-5 mb-5" style={{ borderBottom: "1px solid var(--border)" }}>
              {/* Avatar with edit button */}
              <div className="relative flex-shrink-0">
                <AvatarImg id={avatarId} size={80} ring />
                <button
                  type="button"
                  onClick={() => setShowPicker(v => !v)}
                  title="Change avatar"
                  className="absolute -bottom-1 -right-1 flex items-center justify-center transition-all"
                  style={{
                    width:        "26px",
                    height:       "26px",
                    borderRadius: "50%",
                    background:   "var(--accent)",
                    border:       "2px solid var(--surface)",
                    cursor:       "pointer",
                    color:        "#fff",
                    fontSize:     "11px",
                    fontWeight:   700,
                  }}
                >
                  ✎
                </button>
              </div>
              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate" style={{ color: "var(--text)" }}>
                  {name || profile?.username}
                </p>
                <p className="text-sm truncate" style={{ color: "var(--text-2)" }}>{profile?.email}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`badge ${profile?.role === "admin" ? "badge-accent" : "badge-green"}`}>
                    {profile?.role}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    {selectedAvLabel} · {selectedAvCaption} · since {profile?.created_at?.slice(0, 10)}
                  </span>
                </div>
              </div>
            </div>

            {/* Inline avatar picker (expands on ✎ click) */}
            {showPicker && (
              <div className="mb-5 fade-in">
                <p className="section-eyebrow mb-3">Choose Your AI Agent</p>
                <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem" }}>
                  {AVATARS.map(av => {
                    const isActive = avatarId === av.id
                    return (
                      <button
                        key={av.id}
                        type="button"
                        title={`${av.label} — ${av.caption}`}
                        onClick={() => { setAvatarId(av.id); setShowPicker(false) }}
                        className="relative flex flex-col items-center gap-1 transition-all"
                        style={{
                          borderRadius: "var(--radius-md)",
                          padding:      "0.4rem 0.25rem 0.25rem",
                          border:       isActive ? "2px solid var(--accent)" : "2px solid transparent",
                          cursor:       "pointer",
                          boxShadow:    isActive ? "0 0 0 2px var(--accent-glow-md)" : "none",
                          background:   isActive ? "var(--accent-glow)" : "var(--surface-raised)",
                          outline:      "none",
                        }}
                      >
                        <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
                          <Image
                            src={av.url}
                            alt={av.label}
                            width={48}
                            height={48}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            unoptimized
                          />
                        </div>
                        <span className="text-[10px] font-semibold leading-tight" style={{ color: isActive ? "var(--accent)" : "var(--text-2)" }}>
                          {av.label}
                        </span>
                        {isActive && (
                          <div
                            className="absolute top-1 right-1 flex items-center justify-center"
                            style={{ width: "14px", height: "14px", borderRadius: "50%", background: "var(--accent)", color: "#fff", fontSize: "8px", fontWeight: 700 }}
                          >
                            ✓
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Display name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-2)" }}>
                Display Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="How should we greet you?"
                className="input"
                style={{ maxWidth: "320px" }}
              />
            </div>
          </div>

          {/* ── Interests ─────────────────────────────────── */}
          <div className="card p-6">
            <h2 className="font-display font-bold text-lg mb-1" style={{ color: "var(--text)" }}>
              My Interests
            </h2>
            <p className="text-sm mb-5" style={{ color: "var(--text-2)" }}>
              Your feed will highlight articles from selected topics.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INTEREST_OPTIONS.map(opt => {
                const active = selected.has(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleInterest(opt.id)}
                    className="flex items-start gap-3 p-3.5 rounded-lg text-left transition-all"
                    style={{
                      background: active ? "var(--accent-glow)"    : "var(--surface-raised)",
                      border:     `1px solid ${active ? "var(--accent-glow-md)" : "var(--border)"}`,
                      cursor:     "pointer",
                    }}
                  >
                    <div
                      className="flex-shrink-0 mt-0.5 flex items-center justify-center"
                      style={{
                        width:        "16px",
                        height:       "16px",
                        borderRadius: "4px",
                        border:       `2px solid ${active ? "var(--accent)" : "var(--border-bright)"}`,
                        background:   active ? "var(--accent)" : "transparent",
                        transition:   "all 0.15s",
                      }}
                    >
                      {active && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span style={{ fontSize: "0.875em" }}>{opt.icon}</span>
                        <span className="text-sm font-semibold" style={{ color: active ? "var(--accent)" : "var(--text)" }}>
                          {opt.label}
                        </span>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {selected.size === 0 && (
              <p className="text-xs mt-3" style={{ color: "var(--text-3)" }}>
                No interests selected — all sections shown equally.
              </p>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ minWidth: "140px", padding: "0.65rem 1.5rem" }}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" style={{ width: "14px", height: "14px" }} />
                  Saving…
                </span>
              ) : "Save Changes"}
            </button>
            <a href="/" className="text-sm" style={{ color: "var(--text-3)", textDecoration: "none" }}>Cancel</a>
          </div>
        </form>
      </main>
    </div>
  )
}
