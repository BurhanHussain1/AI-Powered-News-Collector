import { getToday, getDomains, getMe, getFavoriteIds } from "@/lib/api"
import Masthead from "@/components/Masthead"
import SecurityAlerts from "@/components/SecurityAlerts"
import FrontPageCarousel from "@/components/FrontPageCarousel"
import DomainNav from "@/components/DomainNav"
import SectionBlock from "@/components/SectionBlock"
import type { Article, DomainSection, DigestData, Domain, AuthState } from "@/lib/types"

export default async function HomePage() {
  let data: DigestData | null = null
  let domains: Domain[] = []
  let auth: AuthState = { authenticated: false, id: null, role: null, username: null, name: "", email: "", avatar: "🤖", interests: "" }
  let favoritedIds: Set<number> = new Set()

  try {
    const [digest, domainList, authState, favIds] = await Promise.all([
      getToday(), getDomains(), getMe(), getFavoriteIds(),
    ])
    data = digest
    domains = domainList
    auth = authState
    favoritedIds = new Set(favIds)
  } catch {
    // backend offline — render shell
  }

  const allSections: (DomainSection & { articles: Article[] })[] = domains.flatMap(d =>
    (d.sections ?? []).map(s => {
      const live = data?.sections.find(ds => ds.id === s.id)
      return { ...s, articles: live?.articles ?? [] }
    })
  )

  // Filter by user interests — if none set, show everything
  const userInterests = new Set(
    (auth.interests || "").split(",").map(s => s.trim()).filter(Boolean)
  )
  const hasInterestFilter = userInterests.size > 0
  const visibleSections   = hasInterestFilter
    ? allSections.filter(s => userInterests.has(s.id))
    : allSections

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Masthead
        date={data?.date}
        lastUpdated={data?.last_updated}
        role={auth.role}
        username={auth.username}
        name={auth.name}
        avatar={auth.avatar}
        articleCount={data?.total_count}
        securityCount={data?.security_alerts?.length}
      />
      <DomainNav domains={domains} />

      <main className="flex-1 w-full mx-auto px-4 sm:px-6 py-8" style={{ maxWidth: "var(--max-w)" }}>

        {/* ── Offline banner ───────────────────────────────────── */}
        {!data && (
          <div
            className="text-center py-16 mb-8 fade-in"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div className="text-3xl mb-3">⚡</div>
            <h2 className="font-display font-bold text-lg mb-2" style={{ color: "var(--text)" }}>
              Backend Offline
            </h2>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Start the FastAPI server on port 5000 to see your digest.
            </p>
            <code
              className="inline-block mt-3 text-xs px-3 py-1.5 rounded"
              style={{ background: "var(--surface-raised)", color: "var(--text-3)" }}
            >
              python run.py --web
            </code>
          </div>
        )}

        {/* ── Edition bar ──────────────────────────────────────── */}
        {data && (
          <div
            className="flex flex-wrap justify-between items-baseline gap-2 pb-3 mb-6"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-baseline gap-3">
              <span className="section-eyebrow">Today's Edition</span>
              <span
                className="font-display font-bold text-xl"
                style={{ color: "var(--text)" }}
              >
                {today}
              </span>
            </div>
            <span className="text-sm" style={{ color: "var(--text-2)" }}>
              {data.has_content
                ? `${data.total_count} article${data.total_count !== 1 ? "s" : ""} collected`
                : "No digest published yet — run the pipeline"}
            </span>
          </div>
        )}

        {/* ── Front page / Top stories — horizontal auto-scroll ── */}
        {data && data.top_stories.length > 0 && (
          <FrontPageCarousel
            stories={data.top_stories}
            favoritedIds={favoritedIds}
          />
        )}

        {/* ── Security alerts ──────────────────────────────────── */}
        {data && <SecurityAlerts alerts={data.security_alerts} favoritedIds={favoritedIds} />}

        {/* ── Interest filter banner ───────────────────────────── */}
        {hasInterestFilter && data && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg mb-6"
            style={{
              background:  "var(--accent-glow)",
              border:      "1px solid var(--accent-glow-md)",
            }}
          >
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-2)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Showing <strong style={{ color: "var(--text)" }}>{visibleSections.length} topic{visibleSections.length !== 1 ? "s" : ""}</strong> based on your interests
              {visibleSections.length === 0 && " — no matching sections found"}
            </div>
            <a
              href="/profile"
              className="text-xs font-semibold flex-shrink-0"
              style={{ color: "var(--accent)", textDecoration: "none" }}
            >
              Edit interests →
            </a>
          </div>
        )}

        {/* ── Section blocks ───────────────────────────────────── */}
        {visibleSections.map(section => (
          <SectionBlock key={section.id} section={section} favoritedIds={favoritedIds} />
        ))}

        {/* ── No matching sections ──────────────────────────────── */}
        {hasInterestFilter && visibleSections.length === 0 && data?.has_content && (
          <div
            className="text-center py-16"
            style={{ background: "var(--surface)", border: "1px dashed var(--border-bright)", borderRadius: "var(--radius-lg)" }}
          >
            <div className="text-3xl mb-3">🎯</div>
            <h2 className="font-display font-bold text-lg mb-2" style={{ color: "var(--text)" }}>
              No articles match your interests
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>
              Your selected topics don&apos;t have articles in today&apos;s digest yet.
            </p>
            <a href="/profile" className="btn btn-primary" style={{ display: "inline-flex" }}>
              Update Interests →
            </a>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────── */}
        {data && !data.has_content && (
          <div
            className="text-center py-20"
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <div className="text-4xl mb-4">📰</div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: "var(--text)" }}>
              No digest yet today
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }}>
              Run the pipeline to collect and process today&apos;s articles.
            </p>
            {auth.role === "admin" && (
              <a href="/admin" className="btn btn-primary" style={{ display: "inline-flex" }}>
                Go to Admin Panel →
              </a>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          marginTop: "auto",
        }}
      >
        <div
          className="mx-auto px-6 py-10"
          style={{ maxWidth: "var(--max-w)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div
                className="text-2xl mb-2"
                style={{ fontFamily: "var(--font-gothic)", color: "var(--text)" }}
              >
                FeedDigest
              </div>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-2)" }}>
                Your daily briefing on artificial intelligence, agentic systems, technology, and security — curated by AI and delivered every 6 hours.
              </p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                {data?.last_updated ? `Last updated: ${data.last_updated}` : today}
              </p>
            </div>

            {/* Navigate */}
            <div>
              <p className="section-eyebrow mb-3">Navigate</p>
              <div className="flex flex-col gap-2">
                {[
                  { href: "/",        label: "Today's Digest" },
                  { href: "/archive", label: "Archive"         },
                  { href: "/admin",   label: "Admin Panel"     },
                ].map(l => (
                  <a key={l.href} href={l.href} className="link-muted text-sm">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>

            {/* System */}
            <div>
              <p className="section-eyebrow mb-3">System</p>
              <div className="flex flex-col gap-2 text-sm" style={{ color: "var(--text-2)" }}>
                <span>24 news sources</span>
                <span>6-hour update cycle</span>
                <span>Powered by OpenAI</span>
                <span>SQLite · FastAPI · Next.js</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-wrap justify-between items-center pt-6 gap-3 text-xs"
            style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            <span>© {new Date().getFullYear()} FeedDigest. All rights reserved.</span>
            <span>Updates every 6 hours · {data?.total_count ?? 0} articles indexed</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
