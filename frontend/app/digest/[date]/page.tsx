import { getDigest, getDomains, getMe } from "@/lib/api"
import Masthead from "@/components/Masthead"
import DomainNav from "@/components/DomainNav"
import SecurityAlerts from "@/components/SecurityAlerts"
import HeroStory from "@/components/HeroStory"
import ArticleCard from "@/components/ArticleCard"
import SectionBlock from "@/components/SectionBlock"

export default async function DigestPage({ params }: { params: { date: string } }) {
  let data
  let domains: Awaited<ReturnType<typeof getDomains>> = []
  let role: "admin" | "user" | null = null
  let username: string | null = null

  try {
    const [digest, domainList, auth] = await Promise.all([
      getDigest(params.date),
      getDomains(),
      getMe(),
    ])
    data = digest
    domains = domainList
    role = auth.role ?? null
    username = auth.username
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
      <Masthead date={data.date} lastUpdated={data.last_updated} role={role} username={username} />
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
            {/* Security alerts */}
            <SecurityAlerts alerts={data.security_alerts} />

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

            {/* Top stories */}
            {data.top_stories.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-3 mb-4">
                  <div style={{ width: "3px", height: "1.25rem", background: "var(--accent)", borderRadius: "2px" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>Front Page</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <HeroStory article={data.top_stories[0]} />
                  </div>
                  {data.top_stories.length > 1 && (
                    <div className="flex flex-col gap-4">
                      {data.top_stories.slice(1, 4).map(article => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          sectionColor="var(--accent)"
                          featured
                        />
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Section blocks */}
            {data.sections.map(section => (
              <SectionBlock key={section.id} section={section} />
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
