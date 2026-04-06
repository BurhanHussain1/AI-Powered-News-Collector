"use client"
import { usePathname } from "next/navigation"
import type { Domain } from "@/lib/types"

interface DomainNavProps {
  domains: Domain[]
  activeDomainId?: string
}

export default function DomainNav({ domains, activeDomainId }: DomainNavProps) {
  const pathname = usePathname()
  const isHome = pathname === "/"

  return (
    <div
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="mx-auto px-6 flex items-center gap-0 overflow-x-auto"
        style={{ maxWidth: "var(--max-w)" }}
      >
        <a
          href="/"
          className="py-2.5 px-4 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors"
          style={{
            color: isHome ? "var(--accent)" : "var(--text-2)",
            borderBottom: isHome ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: "-1px",
            textDecoration: "none",
          }}
        >
          All Topics
        </a>

        {domains.map(domain => {
          const isActive = activeDomainId === domain.id
          return (
            <a
              key={domain.id}
              href={`/domain/${domain.id}`}
              className="py-2.5 px-4 text-sm font-medium whitespace-nowrap flex-shrink-0 flex items-center gap-1.5 transition-colors"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-2)",
                borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                marginBottom: "-1px",
                textDecoration: "none",
              }}
            >
              {domain.icon && <span style={{ fontSize: "0.9em" }}>{domain.icon}</span>}
              <span>{domain.label}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
