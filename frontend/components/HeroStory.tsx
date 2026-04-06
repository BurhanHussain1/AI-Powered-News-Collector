"use client"
import { useState } from "react"
import type { Article } from "@/lib/types"
import { addFavorite, removeFavorite } from "@/lib/api"

const CATEGORY_LABELS: Record<string, string> = {
  ai_research:    "AI Research",
  agentic_ai:     "Agentic AI",
  company_blogs:  "Company News",
  tech_stack:     "Tech Stack",
  business_news:  "Business",
  security:       "Security",
}

export default function HeroStory({ article, isFavorited = false }: { article: Article; isFavorited?: boolean }) {
  const [fav, setFav]         = useState(isFavorited)
  const [pending, setPending] = useState(false)

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    if (pending) return
    setPending(true)
    try {
      if (fav) { await removeFavorite(article.id); setFav(false) }
      else      { await addFavorite(article.id);    setFav(true)  }
    } catch { /* silent */ } finally { setPending(false) }
  }
  const tags = article.tags
    ? article.tags.split(",").map(t => t.trim()).filter(Boolean)
    : []

  const categoryLabel = CATEGORY_LABELS[article.category] ?? article.category.replace(/_/g, " ")
  const isTopStory = article.importance_score === 5

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      style={{ textDecoration: "none" }}
    >
      <div
        className="card card-lift hero-card p-6 md:p-8"
        style={{
          borderLeft: "4px solid var(--accent)",
          background: "var(--surface)",
        }}
      >
        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="badge badge-accent">{categoryLabel}</span>
          {isTopStory && <span className="badge badge-gold">Top Story</span>}
          <span className="text-sm font-semibold ml-1" style={{ color: "var(--text-2)" }}>
            {article.source_name}
          </span>
          {/* Favorite button */}
          <button
            onClick={toggleFavorite}
            disabled={pending}
            title={fav ? "Remove from favorites" : "Save to favorites"}
            className="ml-auto transition-all flex items-center gap-1 text-xs font-semibold"
            style={{
              background: fav ? "rgba(239,68,68,0.1)" : "var(--surface-raised)",
              border:     `1px solid ${fav ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)",
              color:      fav ? "#ef4444" : "var(--text-3)",
              cursor:     pending ? "wait" : "pointer",
              padding:    "0.25rem 0.6rem",
              opacity:    pending ? 0.6 : 1,
            }}
          >
            {fav ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            )}
            {fav ? "Saved" : "Save"}
          </button>
          {article.published_at && (
            <span
              className="text-xs ml-auto hidden sm:block"
              style={{ color: "var(--text-3)" }}
            >
              {article.published_at.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          className="font-display font-bold leading-tight mb-4"
          style={{
            color: "var(--text)",
            fontSize: "clamp(1.375rem, 3vw, 1.875rem)",
            lineHeight: 1.25,
            transition: "color 0.15s",
          }}
        >
          {article.title}
        </h2>

        {/* Summary */}
        {article.summary && (
          <p
            className="leading-relaxed mb-5"
            style={{
              color: "var(--text-2)",
              fontSize: "1.0rem",
              maxWidth: "72ch",
              fontFamily: "var(--font-serif)",
              whiteSpace: "pre-line",
            }}
          >
            {article.summary}
          </p>
        )}

        {/* Tags + CTA */}
        <div className="flex flex-wrap items-center gap-2">
          {tags.map(tag => (
            <span key={tag} className="tag-pill">{tag}</span>
          ))}
          <span
            className="ml-auto text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Read full story →
          </span>
        </div>
      </div>
    </a>
  )
}
