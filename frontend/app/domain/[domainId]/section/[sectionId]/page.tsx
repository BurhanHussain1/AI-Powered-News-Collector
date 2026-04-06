import { getDomain, getDomains, getSection, getMe } from "@/lib/api"
import Masthead from "@/components/Masthead"
import DomainNav from "@/components/DomainNav"
import SectionSidebar from "@/components/SectionSidebar"
import ArticleCard from "@/components/ArticleCard"

export default async function SectionPage({
  params,
}: {
  params: { domainId: string; sectionId: string }
}) {
  let sectionData: Awaited<ReturnType<typeof getSection>> | null = null
  let domain: Awaited<ReturnType<typeof getDomain>> | null = null
  let domains: Awaited<ReturnType<typeof getDomains>> = []
  let role: "admin" | "user" | null = null
  let username: string | null = null

  try {
    const [sd, d, dl, auth] = await Promise.all([
      getSection(params.domainId, params.sectionId),
      getDomain(params.domainId),
      getDomains(),
      getMe(),
    ])
    sectionData = sd
    domain = d
    domains = dl
    role = auth.role ?? null
    username = auth.username
  } catch {
    // fallback below
  }

  if (!sectionData || !domain) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <p className="text-sm italic" style={{ color: "var(--text-2)" }}>
          Could not load section data.
        </p>
      </div>
    )
  }

  const { section, articles } = sectionData
  const domainSections = domain.sections || []

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <Masthead role={role} username={username} />
      <DomainNav domains={domains} activeDomainId={params.domainId} />

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex gap-8 w-full flex-1">
        <SectionSidebar
          domainId={params.domainId}
          domainLabel={domain.label}
          domainColor={domain.color}
          sections={domainSections}
          activeSectionId={params.sectionId}
        />

        <div className="flex-1 min-w-0">
          {/* Section header */}
          <div
            className="flex items-center gap-3 mb-6 pb-4 border-b-2"
            style={{ borderColor: section.color }}
          >
            <span className="text-2xl">{section.icon}</span>
            <div>
              <p
                className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
                style={{ color: "var(--text-3)" }}
              >
                {sectionData.domain.label}
              </p>
              <h1
                className="font-display font-bold text-xl"
                style={{ color: "var(--text)" }}
              >
                {section.label}
              </h1>
            </div>
            <span className="text-sm ml-auto" style={{ color: "var(--text-2)" }}>
              {articles.length} article{articles.length !== 1 ? "s" : ""}
            </span>
          </div>

          {articles.length === 0 ? (
            <div
              className="text-center py-20 border border-dashed rounded-lg"
              style={{ borderColor: "var(--border-bright)" }}
            >
              <p className="text-sm italic" style={{ color: "var(--text-2)" }}>
                No articles in this section today.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {articles.map(article => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  sectionColor={section.color}
                  sectionBorder={section.border}
                />
              ))}
            </div>
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
