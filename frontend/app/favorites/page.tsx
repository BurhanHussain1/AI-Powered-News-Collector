"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getFavorites, downloadFavoritesPdf } from "@/lib/api"
import ArticleCard from "@/components/ArticleCard"
import type { Article } from "@/lib/types"

export default function FavoritesPage() {
  const router = useRouter()
  const [articles, setArticles]       = useState<Article[]>([])
  const [loading, setLoading]         = useState(true)
  const [pdfLoading, setPdfLoading]   = useState(false)
  const [pdfError, setPdfError]       = useState<string | null>(null)

  useEffect(() => {
    getFavorites()
      .then(res => setArticles(res.articles ?? []))
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false))
  }, [])

  async function handleDownloadPdf() {
    if (articles.length === 0) return
    setPdfLoading(true)
    setPdfError(null)
    const err = await downloadFavoritesPdf()
    if (err) setPdfError(err)
    setPdfLoading(false)
  }

  function handleUnfavorite(id: number) {
    setArticles(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div className="mx-auto px-6 h-14 flex items-center justify-between" style={{ maxWidth: "var(--max-w)" }}>
          <div className="flex items-center gap-3">
            <a href="/" style={{ fontFamily: "var(--font-gothic)", fontSize: "1.25rem", color: "var(--text)", textDecoration: "none" }}>
              FeedDigest
            </a>
            <span className="badge" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
              ♥ Favourites
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!loading && articles.length > 0 && (
              <button
                onClick={handleDownloadPdf}
                disabled={pdfLoading}
                className="btn btn-secondary"
                style={{ fontSize: "0.8125rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {pdfLoading
                  ? <><span className="spinner" style={{ width: "12px", height: "12px" }} /> Generating…</>
                  : "⬇ Download PDF"}
              </button>
            )}
            <a href="/" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>← Back to Digest</a>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full px-4 sm:px-6 py-10" style={{ maxWidth: "var(--max-w)" }}>

        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div style={{ width: "3px", height: "1.25rem", background: "#ef4444", borderRadius: "2px" }} />
            <h1 className="font-display font-bold text-2xl" style={{ color: "var(--text)" }}>
              Your Favourites
            </h1>
          </div>
          <p className="text-sm ml-6" style={{ color: "var(--text-2)" }}>
            {loading ? "Loading…" : articles.length > 0
              ? `${articles.length} saved article${articles.length !== 1 ? "s" : ""} — click ♥ on any card to remove`
              : "No favourites yet"}
          </p>
          {pdfError && (
            <p className="text-sm ml-6 mt-1" style={{ color: "#ef4444" }}>
              PDF error: {pdfError}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="spinner spinner-dark" style={{ width: "32px", height: "32px" }} />
          </div>
        )}

        {/* Articles grid */}
        {!loading && articles.length > 0 && (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
            {articles.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                isFavorited
                onUnfavorite={handleUnfavorite}
                sectionColor="#ef4444"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && articles.length === 0 && (
          <div
            className="text-center py-24"
            style={{ background: "var(--surface)", border: "1px dashed var(--border-bright)", borderRadius: "var(--radius-lg)" }}
          >
            <div className="text-5xl mb-4">♡</div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: "var(--text)" }}>
              No favourites yet
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-2)" }}>
              Click the ♥ icon on any article card to save it here.
            </p>
            <a href="/" className="btn btn-primary" style={{ display: "inline-flex" }}>
              Browse Articles →
            </a>
          </div>
        )}
      </main>
    </div>
  )
}
