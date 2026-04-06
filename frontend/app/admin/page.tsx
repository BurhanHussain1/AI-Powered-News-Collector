"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getMe, getAdminDigests, deleteDigest, triggerRefresh } from "@/lib/api"
import type { DigestRecord } from "@/lib/types"

export default function AdminPage() {
  const router = useRouter()
  const [username, setUsername] = useState<string | null>(null)
  const [digests, setDigests] = useState<DigestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: "ok" | "err" } | null>(null)

  useEffect(() => {
    getMe().then(auth => {
      if (!auth.authenticated || auth.role !== "admin") {
        router.push("/")
        return
      }
      setUsername(auth.username)
      loadDigests()
    })
  }, [])

  function showToast(text: string, type: "ok" | "err") {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function loadDigests() {
    setLoading(true)
    try {
      const data = await getAdminDigests()
      setDigests(data)
    } catch {
      showToast("Failed to load digests.", "err")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number, date: string) {
    if (!confirm(`Permanently delete digest for ${date}?\n\nThis cannot be undone.`)) return
    try {
      const res = await deleteDigest(id)
      if (res.ok) {
        showToast(`Digest ${date} deleted.`, "ok")
        loadDigests()
      } else {
        showToast(`Failed to delete digest ${date}.`, "err")
      }
    } catch {
      showToast("Error deleting digest.", "err")
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setToast(null)
    try {
      await triggerRefresh()
      showToast("Pipeline complete — digest generated.", "ok")
      loadDigests()
    } catch {
      showToast("Pipeline failed. Check the server logs.", "err")
    } finally {
      setRefreshing(false)
    }
  }

  const latest = digests[0]?.date ?? null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Admin header ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="mx-auto px-6 h-14 flex items-center justify-between"
          style={{ maxWidth: "var(--max-w)" }}
        >
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="font-gothic text-xl"
              style={{
                fontFamily: "var(--font-gothic)",
                color: "var(--text)",
                textDecoration: "none",
              }}
            >
              FeedDigest
            </a>
            <span className="badge badge-accent">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            {username && (
              <span className="text-xs hidden sm:block" style={{ color: "var(--text-3)" }}>
                {username}
              </span>
            )}
            <a href="/" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>
              ← View Site
            </a>
          </div>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main
        className="flex-1 mx-auto w-full px-4 sm:px-6 py-8"
        style={{ maxWidth: "var(--max-w)" }}
      >
        {/* Toast */}
        {toast && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-sm font-medium fade-in"
            style={{
              background: toast.type === "err" ? "var(--red-glow-md)" : "var(--green-glow)",
              color: toast.type === "err" ? "var(--red)" : "var(--green)",
              border: `1px solid ${toast.type === "err" ? "var(--red-glow-md)" : "var(--green-glow)"}`,
            }}
          >
            {toast.text}
          </div>
        )}

        {/* ── Page title ──────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: "var(--text)" }}>
            Admin Panel
          </h1>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Manage the pipeline, view digest history, and control the system.
          </p>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="stat-card">
            <span className="stat-label">Total Editions</span>
            <span className="stat-value">{loading ? "—" : digests.length}</span>
            <span className="stat-sub">All time</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Latest</span>
            <span className="stat-value" style={{ fontSize: "1.125rem" }}>
              {loading ? "—" : (latest ?? "None")}
            </span>
            <span className="stat-sub">Most recent date</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Pipeline</span>
            <span className="stat-value" style={{ fontSize: "1.125rem", color: refreshing ? "var(--gold)" : "var(--green)" }}>
              {refreshing ? "Running" : "Idle"}
            </span>
            <span className="stat-sub">Current status</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Sources</span>
            <span className="stat-value">24</span>
            <span className="stat-sub">RSS + GitHub + HF</span>
          </div>
        </div>

        {/* ── Pipeline card ───────────────────────────────────────── */}
        <div
          className="card p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
        >
          <div>
            <h2 className="font-display font-bold text-lg mb-1" style={{ color: "var(--text)" }}>
              Run Pipeline
            </h2>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              Collect from all 24 sources, process with OpenAI, and build today&apos;s digest. This may take 1–3 minutes.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-primary flex-shrink-0"
            style={{ minWidth: "180px" }}
          >
            {refreshing ? (
              <>
                <span className="spinner w-3.5 h-3.5" style={{ width: "14px", height: "14px" }} />
                Running…
              </>
            ) : (
              "▶ Run Pipeline & Make Digest"
            )}
          </button>
        </div>

        {/* ── Digest table ────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display font-semibold text-base" style={{ color: "var(--text)" }}>
            All Editions
          </h2>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {digests.length} total
          </span>
        </div>

        <div
          className="overflow-hidden"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {loading ? (
            <div className="py-16 text-center">
              <div
                className="spinner spinner-dark inline-block mx-auto mb-3"
                style={{ width: "24px", height: "24px" }}
              />
              <p className="text-sm" style={{ color: "var(--text-2)" }}>Loading…</p>
            </div>
          ) : digests.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm italic" style={{ color: "var(--text-3)" }}>
                No digests yet. Run the pipeline above.
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="hidden sm:table-cell">Generated</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {digests.map(digest => (
                  <tr key={digest.id}>
                    <td>
                      <span className="font-display font-bold" style={{ color: "var(--text)" }}>
                        {digest.date}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell" style={{ color: "var(--text-3)" }}>
                      {digest.created_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td>
                      <span className="badge badge-green">Active</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/digest/${digest.date}`}
                          className="btn btn-secondary"
                          style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                        >
                          View
                        </a>
                        <a
                          href={`/api/digest/${digest.date}/pdf`}
                          className="btn btn-secondary"
                          style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                        >
                          PDF
                        </a>
                        <button
                          onClick={() => handleDelete(digest.id, digest.date)}
                          className="btn btn-danger"
                          style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        className="mt-auto"
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
      >
        <div
          className="mx-auto px-6 py-4 flex justify-between items-center text-xs"
          style={{ maxWidth: "var(--max-w)", color: "var(--text-3)" }}
        >
          <span>FeedDigest — Admin</span>
          <span>FastAPI · SQLite · Next.js</span>
        </div>
      </footer>

    </div>
  )
}
