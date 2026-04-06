"use client"
import type { DomainSection } from "@/lib/types"

interface SectionSidebarProps {
  domainId: string
  domainLabel: string
  domainColor: string
  sections: DomainSection[]
  activeSectionId?: string
}

export default function SectionSidebar({
  domainId,
  domainLabel,
  domainColor,
  sections,
  activeSectionId,
}: SectionSidebarProps) {
  return (
    <aside className="w-52 flex-shrink-0 hidden lg:block">
      <div className="sticky" style={{ top: "calc(var(--nav-h) + 20px)" }}>
        {/* Domain label */}
        <p className="section-eyebrow mb-3 px-1">{domainLabel}</p>

        {/* Nav card */}
        <nav
          className="overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {/* All Sections */}
          <a
            href={`/domain/${domainId}`}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
            style={{
              background: !activeSectionId ? "var(--surface-raised)" : "transparent",
              color: !activeSectionId ? "var(--text)" : "var(--text-2)",
              borderLeft: !activeSectionId ? `3px solid ${domainColor}` : "3px solid transparent",
              borderBottom: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            <span>📰</span>
            <span className="font-medium">All Sections</span>
          </a>

          {sections.map((section, i) => {
            const isActive = activeSectionId === section.id
            const isLast = i === sections.length - 1
            return (
              <a
                key={section.id}
                href={`/domain/${domainId}/section/${section.id}`}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors"
                style={{
                  background: isActive ? "var(--surface-raised)" : "transparent",
                  color: isActive ? "var(--text)" : "var(--text-2)",
                  borderLeft: isActive ? `3px solid ${section.color}` : "3px solid transparent",
                  borderBottom: isLast ? "none" : "1px solid var(--border)",
                  textDecoration: "none",
                }}
              >
                {section.icon && <span style={{ fontSize: "0.9em" }}>{section.icon}</span>}
                <span className={isActive ? "font-semibold" : "font-medium"}>{section.label}</span>
              </a>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
