import { getDomain, getDomains, getToday, getMe } from "@/lib/api"
import Masthead from "@/components/Masthead"
import DomainNav from "@/components/DomainNav"
import SectionSidebar from "@/components/SectionSidebar"
import SectionBlock from "@/components/SectionBlock"
import SecurityAlerts from "@/components/SecurityAlerts"

export default async function DomainPage({ params }: { params: { domainId: string } }) {
  let domain: Awaited<ReturnType<typeof getDomain>> | null = null
  let domains: Awaited<ReturnType<typeof getDomains>> = []
  let digest: Awaited<ReturnType<typeof getToday>> | null = null
  let role: "admin" | "user" | null = null
  let username: string | null = null

  try {
    const [d, dl, dig, auth] = await Promise.all([
      getDomain(params.domainId),
      getDomains(),
      getToday(),
      getMe(),
    ])
    domain = d
    domains = dl
    digest = dig
    role = auth.role ?? null
    username = auth.username
  } catch {
    // fallback handled below
  }

  if (!domain) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm italic" style={{ color: "var(--text-2)" }}>
          Could not load domain data.
        </p>
      </div>
    )
  }

  const domainSections = domain.sections || []
  const domainSectionIds = new Set(domainSections.map(s => s.id))
  const filteredSections = (digest?.sections ?? []).filter(s => domainSectionIds.has(s.id))
  const hasSecuritySection = domainSections.some(s => s.id === "ai-security")
  const securityAlerts = hasSecuritySection ? (digest?.security_alerts ?? []) : []

  // Merge articles into domain sections
  const mergedSections = domainSections.map(s => {
    const live = filteredSections.find(fs => fs.id === s.id)
    return { ...s, articles: live?.articles ?? [] }
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Masthead date={digest?.date} lastUpdated={digest?.last_updated} role={role} username={username} />
      <DomainNav domains={domains} activeDomainId={params.domainId} />

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex gap-8 w-full flex-1">
        <SectionSidebar
          domainId={params.domainId}
          domainLabel={domain.label}
          domainColor={domain.color}
          sections={domainSections}
        />

        <div className="flex-1 min-w-0">
          {/* Domain header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">{domain.icon}</span>
            <h1
              className="font-display font-bold text-xl"
              style={{ color: "var(--text)" }}
            >
              {domain.label}
            </h1>
            {digest && (
              <span className="text-sm ml-auto" style={{ color: "var(--text-2)" }}>
                {filteredSections.reduce((acc, s) => acc + s.articles.length, 0)} articles
              </span>
            )}
          </div>

          {securityAlerts.length > 0 && <SecurityAlerts alerts={securityAlerts} />}

          {mergedSections.every(s => s.articles.length === 0) ? (
            <div
              className="text-center py-20 border border-dashed rounded-lg"
              style={{ borderColor: "var(--border-bright)" }}
            >
              <p className="text-sm italic" style={{ color: "var(--text-2)" }}>
                No articles yet for this domain today.
              </p>
            </div>
          ) : (
            mergedSections.map(section => (
              <SectionBlock key={section.id} section={section} />
            ))
          )}
        </div>
      </div>

      <footer
        className="border-t py-4 px-6 mt-auto"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div
          className="max-w-[1400px] mx-auto text-xs"
          style={{ color: "var(--text-3)" }}
        >
          FeedDigest &mdash; Powered by Claude
        </div>
      </footer>
    </div>
  )
}
