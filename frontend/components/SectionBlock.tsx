import type { DomainSection, Article } from "@/lib/types"
import { getSectionPdfUrl } from "@/lib/api"
import ArticleCard from "./ArticleCard"

type SectionWithArticles = DomainSection & { articles: Article[] }

export default function SectionBlock({ section, favoritedIds = new Set() }: { section: SectionWithArticles; favoritedIds?: Set<number> }) {
  if (section.articles.length === 0) return null

  return (
    <section id={section.id} className="mb-10 scroll-mt-20">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          style={{
            width: "3px",
            height: "1.25rem",
            background: section.color,
            borderRadius: "2px",
            flexShrink: 0,
          }}
        />
        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
          {section.icon && <span className="mr-1.5">{section.icon}</span>}
          {section.label}
        </span>
        <span
          className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-3)",
            border: "1px solid var(--border)",
          }}
        >
          {section.articles.length}
        </span>
        <a
          href={getSectionPdfUrl(section.id)}
          title={`Download ${section.label} as PDF`}
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{
            color: "var(--text-3)",
            border: "1px solid var(--border)",
            background: "var(--surface-raised)",
            textDecoration: "none",
            whiteSpace: "nowrap",
            lineHeight: "1.6",
          }}
        >
          ⬇ PDF
        </a>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Article grid */}
      <div
        className="grid overflow-hidden"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "15px",
          background: "transparent",
          borderRadius: "var(--radius-md)",
        }}
      >
        {section.articles.map(article => (
          <ArticleCard
            key={article.id}
            article={article}
            sectionColor={section.color}
            sectionBorder={section.border}
            isFavorited={favoritedIds.has(article.id)}
          />
        ))}
      </div>
    </section>
  )
}
