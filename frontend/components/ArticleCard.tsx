"use client"
import { useState } from "react"
import type { Article } from "@/lib/types"
import { addFavorite, removeFavorite } from "@/lib/api"

interface ArticleCardProps {
  article:       Article
  sectionColor?: string
  sectionBorder?: string
  featured?:     boolean
  isFavorited?:  boolean
  onUnfavorite?: (id: number) => void   // called when removed from favorites page
}

function Stars({ score }: { score: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < score ? "var(--gold)" : "var(--border-bright)", fontSize: "0.65rem" }}>★</span>
      ))}
    </span>
  )
}

function Tags({ tags, color }: { tags: string; color?: string }) {
  const list = tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 3)
  if (!list.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-auto pt-2">
      {list.map(tag => <span key={tag} className="tag-pill">{tag}</span>)}
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

export default function ArticleCard({
  article, sectionColor, sectionBorder, featured, isFavorited = false, onUnfavorite,
}: ArticleCardProps) {
  const color      = sectionColor || "var(--accent)"
  const [fav, setFav]       = useState(isFavorited)
  const [pending, setPending] = useState(false)

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending(true)
    try {
      if (fav) {
        await removeFavorite(article.id)
        setFav(false)
        onUnfavorite?.(article.id)
      } else {
        await addFavorite(article.id)
        setFav(true)
      }
    } catch { /* silent */ } finally {
      setPending(false)
    }
  }

  return (
    <article className="article-card p-4 gap-2.5" style={{ display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Colored accent top border */}
      <div style={{ height: "3px", background: color, margin: "-1rem -1rem 0", borderRadius: "var(--radius-md) var(--radius-md) 0 0", opacity: 0.7 }} />

      {/* Source + date + favorite */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
          {article.source_name}
        </span>
        <div className="flex items-center gap-2">
          {article.published_at && (
            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
              {article.published_at.slice(0, 10)}
            </span>
          )}
          {/* ❤ Favorite button */}
          <button
            onClick={toggleFavorite}
            disabled={pending}
            title={fav ? "Remove from favorites" : "Save to favorites"}
            className="transition-all"
            style={{
              background: "none",
              border:     "none",
              cursor:     pending ? "wait" : "pointer",
              color:      fav ? "#ef4444" : "var(--text-3)",
              padding:    "2px",
              display:    "flex",
              alignItems: "center",
              opacity:    pending ? 0.5 : 1,
              transform:  pending ? "scale(0.9)" : "scale(1)",
            }}
          >
            <HeartIcon filled={fav} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display font-bold leading-snug" style={{ color: "var(--text)", fontSize: featured ? "1.0625rem" : "0.9375rem", lineHeight: 1.35 }}>
        <a href={article.url} target="_blank" rel="noopener noreferrer"
          style={{ color: "inherit", textDecoration: "none", transition: "color 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--text)")}
        >
          {article.title}
        </a>
      </h3>

      {/* Summary */}
      {article.summary && (
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: featured ? 10 : 8, overflow: "hidden", fontFamily: "var(--font-serif)" }}>
          {article.summary}
        </p>
      )}

      {/* Tags */}
      {article.tags && <Tags tags={article.tags} color={color} />}

      {/* Footer row */}
      <div className="flex justify-between items-center pt-2 mt-auto" style={{ borderTop: "1px solid var(--border)" }}>
        <Stars score={article.importance_score} />
        <a href={article.url} target="_blank" rel="noopener noreferrer"
          className="text-xs font-semibold"
          style={{ color, textDecoration: "none", transition: "opacity 0.15s" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Read →
        </a>
      </div>
    </article>
  )
}
