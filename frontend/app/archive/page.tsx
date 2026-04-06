import { getArchive, getDomains, getPdfUrl, getMe } from "@/lib/api"
import Masthead from "@/components/Masthead"
import DomainNav from "@/components/DomainNav"
import type { DigestRecord } from "@/lib/types"

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]

function groupByMonth(digests: DigestRecord[]) {
  return digests.reduce((acc, d) => {
    const month = d.date.slice(0, 7)
    if (!acc[month]) acc[month] = []
    acc[month].push(d)
    return acc
  }, {} as Record<string, DigestRecord[]>)
}

function formatMonth(ym: string) {
  const [year, m] = ym.split("-")
  return `${MONTHS[parseInt(m, 10) - 1]} ${year}`
}

export default async function ArchivePage() {
  const [digests, domains, auth] = await Promise.all([
    getArchive().catch(() => [] as DigestRecord[]),
    getDomains().catch(() => []),
    getMe().catch(() => ({ authenticated: false, role: null as "admin" | "user" | null, username: null as string | null })),
  ])

  const role = auth.role
  const grouped = groupByMonth(digests)
  const months = Object.keys(grouped).sort((a, b) => (a > b ? -1 : 1))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Masthead role={role} username={auth.username ?? null} />
      <DomainNav domains={domains} />

      <main
        className="flex-1 mx-auto w-full px-4 sm:px-6 py-8"
        style={{ maxWidth: "var(--max-w)" }}
      >
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-baseline gap-4 mb-1">
            <h1
              className="font-display font-bold text-3xl"
              style={{ color: "var(--text)" }}
            >
              Archive
            </h1>
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              {digests.length} edition{digests.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            Every digest edition, organised by month. Download any edition as PDF.
          </p>
        </div>

        {/* Empty state */}
        {digests.length === 0 ? (
          <div
            className="text-center py-24"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div className="text-5xl mb-4">📁</div>
            <h2
              className="font-display font-bold text-xl mb-2"
              style={{ color: "var(--text)" }}
            >
              No editions yet
            </h2>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Run the pipeline to generate your first digest.
            </p>
            {role === "admin" && (
              <a href="/admin" className="btn btn-primary mt-5" style={{ display: "inline-flex" }}>
                Go to Admin →
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-10">
            {months.map(month => (
              <div key={month}>
                {/* Month heading */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="section-eyebrow">{formatMonth(month)}</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    {grouped[month].length} edition{grouped[month].length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {grouped[month].map(digest => {
                    const d = new Date(digest.date + "T00:00:00")
                    const day = d.getDate()
                    const monthName = MONTHS[d.getMonth()]
                    const year = d.getFullYear()
                    const weekday = d.toLocaleDateString("en-US", { weekday: "long" })

                    return (
                      <div
                        key={digest.id}
                        className="card card-lift flex flex-col gap-4 p-5"
                      >
                        {/* Date display */}
                        <div>
                          <div
                            className="font-display font-bold leading-none mb-1"
                            style={{ fontSize: "3rem", color: "var(--text)" }}
                          >
                            {day}
                          </div>
                          <div className="text-sm font-medium" style={{ color: "var(--text-2)" }}>
                            {weekday}
                          </div>
                          <div className="text-xs" style={{ color: "var(--text-3)" }}>
                            {monthName} {year}
                          </div>
                        </div>

                        {/* Created time */}
                        {digest.created_at && (
                          <div className="text-xs" style={{ color: "var(--text-3)" }}>
                            Generated at {digest.created_at.slice(11, 16)} UTC
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-auto">
                          <a
                            href={`/digest/${digest.date}`}
                            className="btn btn-primary flex-1 text-center"
                            style={{ fontSize: "0.8125rem" }}
                          >
                            Read
                          </a>
                          <a
                            href={getPdfUrl(digest.date)}
                            className="btn btn-secondary"
                            style={{ fontSize: "0.8125rem" }}
                            title="Download PDF"
                          >
                            PDF
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className="mt-auto"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          className="mx-auto px-6 py-5 flex justify-between items-center text-xs"
          style={{ maxWidth: "var(--max-w)", color: "var(--text-3)" }}
        >
          <span>FeedDigest — Archive</span>
          <a href="/" style={{ color: "var(--text-3)", textDecoration: "none" }}>
            ← Today's Digest
          </a>
        </div>
      </footer>
    </div>
  )
}
