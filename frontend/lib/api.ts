import type { DigestData, DigestRecord, Domain, SectionData, AuthState } from "./types"

// Server-side: must use absolute URL (Node.js has no proxy)
// Client-side: use relative URL so Next.js proxy rewrites to FastAPI
const isServer = typeof window === "undefined"
const BASE = isServer
  ? (process.env.BACKEND_URL ?? "http://localhost:5000")
  : ""

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  }

  // Forward cookies (access_token + digest_auth) on server-side renders
  if (isServer) {
    try {
      const { cookies } = await import("next/headers")
      const cookieStore = cookies()
      const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")
      if (cookieHeader) headers["Cookie"] = cookieHeader
    } catch {
      // not in a request context — skip
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
    headers,
  })

  if (res.status === 401) throw new Error("unauthorized")
  if (res.status === 403) throw new Error("forbidden")
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

// ── Auth ────────────────────────────────────────────────────────
export async function getMe(): Promise<AuthState> {
  return apiFetch("/api/auth/me")
}

export async function login(username: string, password: string) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

/** Step 1 of signup — validate fields and send OTP email. */
export async function sendOtp(data: {
  username: string
  email: string
  password: string
  name: string
  avatar?: string
}) {
  const res = await fetch("/api/auth/send-otp", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

/** Step 2 of signup — verify OTP, create account, get JWT cookie. */
export async function verifyOtp(email: string, otp: string) {
  const res = await fetch("/api/auth/verify-otp", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  })
  return res.json()
}

/** Resend OTP for an existing pending signup. */
export async function resendOtp(email: string) {
  const res = await fetch("/api/auth/resend-otp", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  })
  return res.json()
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
}

// ── Favorites ─────────────────────────────────────────────────────────────────
export async function getFavoriteIds(): Promise<number[]> {
  const res = await apiFetch<{ ids: number[] }>("/api/favorites/ids")
  return res.ids ?? []
}

export async function getFavorites() {
  return apiFetch<{ articles: import("./types").Article[]; ids: number[] }>("/api/favorites")
}

export async function addFavorite(articleId: number) {
  return apiFetch<{ ok: boolean }>(`/api/favorites/${articleId}`, { method: "POST" })
}

export async function removeFavorite(articleId: number) {
  return apiFetch<{ ok: boolean }>(`/api/favorites/${articleId}`, { method: "DELETE" })
}

/**
 * Fetch /api/favorites/pdf with auth cookies and trigger a browser download.
 * Returns an error string on failure, or null on success.
 */
export async function downloadFavoritesPdf(): Promise<string | null> {
  try {
    const res = await fetch("/api/favorites/pdf", { credentials: "include" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return (body as { detail?: string }).detail ?? `HTTP ${res.status}`
    }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = "my-favourites.pdf"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return null
  } catch (err) {
    return String(err)
  }
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function getProfile() {
  return apiFetch<import("./types").UserProfile>("/api/profile")
}

export async function updateProfile(data: { name: string; interests: string; avatar?: string }) {
  return apiFetch<{ ok: boolean }>("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
}

// ── Domains ─────────────────────────────────────────────────────
export async function getDomains(): Promise<Domain[]> {
  return apiFetch("/api/domains")
}

export async function getDomain(domainId: string): Promise<Domain> {
  return apiFetch(`/api/domain/${domainId}`)
}

export async function getSection(domainId: string, sectionId: string): Promise<SectionData> {
  return apiFetch(`/api/domain/${domainId}/section/${sectionId}`)
}

// ── Digest ──────────────────────────────────────────────────────
export async function getToday(): Promise<DigestData> {
  return apiFetch("/api/digest/today")
}

export async function getDigest(date: string): Promise<DigestData> {
  return apiFetch(`/api/digest/${date}`)
}

export async function getArchive(): Promise<DigestRecord[]> {
  return apiFetch("/api/digests")
}

export function getPdfUrl(date: string): string {
  return `/api/digest/${date}/pdf`
}

export function getSectionPdfUrl(sectionId: string): string {
  return `/api/section/${sectionId}/pdf`
}

// ── Refresh ─────────────────────────────────────────────────────
export async function triggerRefresh() {
  return apiFetch("/api/refresh", { method: "POST" })
}

// ── Admin ───────────────────────────────────────────────────────
export async function getAdminDigests(): Promise<DigestRecord[]> {
  return apiFetch("/api/admin/digests")
}

export async function deleteDigest(id: number) {
  return apiFetch(`/api/admin/digest/${id}`, { method: "DELETE" })
}
