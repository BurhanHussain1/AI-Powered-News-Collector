"use client"
import ArticleCard from "./ArticleCard"
import type { Article } from "@/lib/types"

export default function FrontPageCarousel({
  stories,
  favoritedIds = new Set(),
}: {
  stories:       Article[]
  favoritedIds?: Set<number>
}) {
  /* Triple the list so the seamless loop always has enough content */
  const looped   = [...stories, ...stories, ...stories]
  const duration = Math.max(12, stories.length * 4)

  return (
    <section className="mb-10">
      {/* Section label */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ width: "3px", height: "1.25rem", background: "var(--accent)", borderRadius: "2px" }} />
        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>Front Page</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Carousel viewport */}
      <div
        style={{
          position:    "relative",
          marginLeft:  "-1rem",
          marginRight: "-1rem",
          overflow:    "hidden",
          padding:     "4px 0 12px",
        }}
      >
        {/* Left fade */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "60px",
          background: "linear-gradient(to right, var(--bg), transparent)",
          zIndex: 10, pointerEvents: "none",
        }} />
        {/* Right fade */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: "60px",
          background: "linear-gradient(to left, var(--bg), transparent)",
          zIndex: 10, pointerEvents: "none",
        }} />

        {/* Scrolling track — never pauses as a whole */}
        <div
          className="marquee-track"
          style={{
            animationDuration: `${duration}s`,
            alignItems:        "stretch",
          }}
        >
          {looped.map((article, idx) => (
            /* Each card pauses ONLY its own animation on hover */
            <div
              key={`${article.id}-${idx}`}
              style={{ width: "300px", flexShrink: 0, margin: "8px 8px" }}
              onMouseEnter={e => (e.currentTarget.closest<HTMLElement>(".marquee-track")!.style.animationPlayState = "paused")}
              onMouseLeave={e => (e.currentTarget.closest<HTMLElement>(".marquee-track")!.style.animationPlayState = "running")}
            >
              <ArticleCard
                article={article}
                sectionColor="var(--accent)"
                featured
                isFavorited={favoritedIds.has(article.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-center mt-1" style={{ color: "var(--text-3)" }}>
        Hover a card to pause · {stories.length} top stories
      </p>
    </section>
  )
}
