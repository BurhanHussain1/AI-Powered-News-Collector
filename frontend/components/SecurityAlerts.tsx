"use client"
import { useState } from "react"
import type { Article } from "@/lib/types"
import { addFavorite, removeFavorite } from "@/lib/api"

function HeartButton({ article, isFavorited }: { article: Article; isFavorited: boolean }) {
  const [fav, setFav]         = useState(isFavorited)
  const [pending, setPending] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      if (fav) { await removeFavorite(article.id); setFav(false) }
      else      { await addFavorite(article.id);    setFav(true)  }
    } catch { /* silent */ } finally { setPending(false) }
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={fav ? "Remove from favorites" : "Save to favorites"}
      style={{
        background: "none",
        border:     "none",
        cursor:     pending ? "wait" : "pointer",
        color:      fav ? "#ef4444" : "rgba(255,255,255,0.5)",
        padding:    "2px",
        display:    "flex",
        alignItems: "center",
        opacity:    pending ? 0.5 : 1,
        transition: "color 0.15s, opacity 0.15s",
        flexShrink: 0,
      }}
    >
      {fav ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      )}
    </button>
  )
}

export default function SecurityAlerts({
  alerts,
  favoritedIds = new Set(),
}: {
  alerts:        Article[]
  favoritedIds?: Set<number>
}) {
  if (!alerts.length) return null

  return (
    <section
      id="security"
      className="mb-6 fade-in overflow-hidden"
      style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--red-glow-md)" }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--red)", color: "#fff" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="pulse-dot inline-block w-2 h-2 rounded-full" style={{ background: "#fff" }} />
          <span className="text-sm font-bold uppercase tracking-widest">Security Alerts</span>
        </div>
        <span className="text-xs font-semibold opacity-80">
          {alerts.length} {alerts.length === 1 ? "Alert" : "Alerts"} — Act Immediately
        </span>
      </div>

      {/* Alert cards grid */}
      <div
        className="grid"
        style={{ background: "transparent", gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))`, gap: "15px", padding: "15px" }}
      >
        {alerts.map(article => {
          const tags = article.tags
            ? article.tags.split(",").map(t => t.trim()).filter(Boolean)
            : []
          return (
            <div
              key={article.id}
              className="security-alert-card p-4 flex flex-col gap-2"
              style={{ background: "var(--surface)", border: "1px solid transparent", transition: "background 0.15s, border-color 0.15s" }}
            >
              {/* Source + heart */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--red)" }}>
                  {article.source_name}
                </span>
                <HeartButton article={article} isFavorited={favoritedIds.has(article.id)} />
              </div>

              {/* Title */}
              <h3 className="font-display font-bold text-sm leading-snug" style={{ color: "var(--text)" }}>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "inherit", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}
                >
                  {article.title}
                </a>
              </h3>

              {/* Summary */}
              {article.summary && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {article.summary.slice(0, 200)}{article.summary.length > 200 ? "…" : ""}
                </p>
              )}

              {/* Tags + link */}
              <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                {tags.slice(0, 2).map(tag => (
                  <span key={tag} className="tag-pill" style={{ color: "var(--red-light)", borderColor: "var(--red-glow-md)" }}>
                    {tag}
                  </span>
                ))}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--red)", textDecoration: "none" }}
                >
                  View →
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
