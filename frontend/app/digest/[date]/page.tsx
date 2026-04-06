import { getDigest, getDomains, getMe, getFavoriteIds } from "@/lib/api"
import Masthead from "@/components/Masthead"
import DomainNav from "@/components/DomainNav"
import SecurityAlerts from "@/components/SecurityAlerts"
import FrontPageCarousel from "@/components/FrontPageCarousel"
import SectionBlock from "@/components/SectionBlock"

export default async function DigestPage({ params }: { params: { date: string } }) {
  let data
  let domains: Awaited<ReturnType<typeof getDomains>> = []
  let role: "admin" | "user" | null = null
  let username: string | null = null
  let name: string = ""
  let avatar: string = "Neural"
  let favoritedIds: Set<number> = new Set()

  try {
    const [digest, domainList, auth, favIds] = await Promise.all([
      getDigest(params.date),
      getDomains(),
      getMe(),
      getFavoriteIds(),
    ])
    data = digest
    domains = domainList
    role = auth.role ?? null
    username = auth.username
    name = auth.name ?? ""
    avatar = auth.avatar ?? "Neural"
    favoritedIds = new Set(favIds)
  } catch {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-5xl">📰</div>
        <h1 className="font-display font-bold text-xl" style={{ color: "var(--text)" }}>
          Digest not found
        </h1>
        <p className="text-sm" style={{ color: "var(--text-2)" }}>
          Could not load digest for <strong>{params.date}</strong>.
        </p>
        <a href="/archive" className="btn btn-secondary">← Back to Archive</a>
      </div>
    )
  }

  const dateDisplay = new Date(params.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Masthead date={data.date} lastUpdated={data.last_updated} role={role} username={username} name={name} avatar={avatar} />
      <DomainNav domains={domains} />

      <main
        className="flex-1 mx-auto w-full px-4 sm:px-6 py-8"
        style={{ maxWidth: "var(--max-w)" }}
      >
        {/* Back + breadcrumb */}
        <div className="mb-6 flex items-center gap-2">
          <a href="/archive" className="link-dim text-sm">
            Archive
          </a>
          <span style={{ color: "var(--border-bright)" }}>›</span>
          <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>
            {params.date}
          </span>
          <a
            href={`/api/digest/${params.date}/pdf`}
            className="ml-auto btn btn-secondary"
            style={{ fontSize: "0.8125rem" }}
          >
            Download PDF
          </a>
        </div>

        {/* Empty state */}
        {!data.has_content ? (
          <div
            className="text-center py-24"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div className="text-5xl mb-4">🗓</div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: "var(--text)" }}>
              No digest for {params.date}
            </h2>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              No articles were collected and processed on this date.
            </p>
          </div>
        ) : (
          <>
            {/* Edition bar */}
            <div
              className="flex flex-wrap items-baseline justify-between gap-2 pb-3 mb-6"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-baseline gap-3">
                <span className="section-eyebrow">Edition</span>
                <span className="font-display font-bold text-xl" style={{ color: "var(--text)" }}>
                  {dateDisplay}
                </span>
              </div>
              <span className="text-sm" style={{ color: "var(--text-2)" }}>
                {data.total_count} article{data.total_count !== 1 ? "s" : ""} in this edition
              </span>
            </div>

            {/* Top stories — same horizontal carousel as today page */}
            {data.top_stories.length > 0 && (
              <FrontPageCarousel stories={data.top_stories} favoritedIds={favoritedIds} />
            )}

            {/* Security alerts — after carousel, same order as today page */}
            <SecurityAlerts alerts={data.security_alerts} favoritedIds={favoritedIds} />

            {/* Section blocks */}
            {data.sections.map(section => (
              <SectionBlock key={section.id} section={section} favoritedIds={favoritedIds} />
            ))}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="mt-auto"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        <div
          className="mx-auto px-6 py-5 flex justify-between items-center text-xs"
          style={{ maxWidth: "var(--max-w)", color: "var(--text-3)" }}
        >
          <span>FeedDigest — {params.date}</span>
          <a href="/archive" className="link-dim">← Back to Archive</a>
        </div>
      </footer>
    </div>
  )
}
