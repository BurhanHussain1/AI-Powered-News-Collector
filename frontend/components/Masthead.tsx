"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { logout } from "@/lib/api"
import { getAvatarUrl } from "@/lib/avatars"

interface MastheadProps {
  date?: string
  lastUpdated?: string
  role?: "admin" | "user" | null
  username?: string | null
  name?: string | null
  avatar?: string | null
  articleCount?: number
  securityCount?: number
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

export default function Masthead({
  date,
  lastUpdated,
  role,
  username,
  name,
  avatar,
  articleCount,
  securityCount,
}: MastheadProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [dark, setDark]           = useState(false)
  const [mounted, setMounted]     = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const menuRef                   = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    setMounted(true)
    setDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggleDark() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle("dark", next)
    try { localStorage.setItem("ai-digest-theme", next ? "dark" : "light") } catch {}
  }

  async function handleLogout() {
    await logout()
    router.push("/login")
  }

  const navLinks = [
    { href: "/",        label: "Today" },
    { href: "/archive", label: "Archive" },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ]

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: "rgba(var(--bg-rgb), 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* ── Top bar: logo + meta ───────────────────────────────── */}
      <div
        className="border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="mx-auto px-6 flex items-center justify-between h-14"
          style={{ maxWidth: "var(--max-w)" }}
        >
          {/* Logo */}
          <a
            href="/"
            className="flex items-baseline gap-2 group"
            style={{ textDecoration: "none" }}
          >
            <span
              className="text-3xl leading-none select-none"
              style={{
                fontFamily: "var(--font-gothic)",
                color: "var(--text)",
                transition: "opacity 0.15s",
              }}
            >
              FeedDigest
            </span>
          </a>

          {/* Center: date + status */}
          <div className="hidden md:flex flex-col items-center gap-0.5">
            {date && (
              <span
                className="text-xs font-medium"
                style={{ color: "var(--text-3)", letterSpacing: "0.05em" }}
              >
                {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            {lastUpdated && (
              <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                Updated {lastUpdated}
              </span>
            )}
          </div>

          {/* Right: stats + actions */}
          <div className="flex items-center gap-2">
            {/* Security badge */}
            {typeof securityCount === "number" && securityCount > 0 && (
              <a
                href="#security"
                className="badge badge-red hidden sm:inline-flex gap-1"
                style={{ textDecoration: "none" }}
              >
                <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--red)" }} />
                {securityCount} Alert{securityCount !== 1 ? "s" : ""}
              </a>
            )}

            {/* Article count */}
            {typeof articleCount === "number" && articleCount > 0 && (
              <span
                className="hidden lg:inline-flex text-xs font-medium px-2.5 py-1 rounded-full"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-2)",
                  border: "1px solid var(--border)",
                }}
              >
                {articleCount} articles
              </span>
            )}

            {/* Dark mode toggle */}
            {mounted && (
              <button
                onClick={toggleDark}
                className="nav-link"
                aria-label="Toggle theme"
                style={{ padding: "0.4rem" }}
              >
                {dark ? <SunIcon /> : <MoonIcon />}
              </button>
            )}

            {/* Role badge */}
            {role === "admin" && (
              <span className="badge badge-accent hidden sm:inline-flex">
                Admin
              </span>
            )}

            {/* Profile dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="hidden sm:inline-flex items-center gap-2 rounded-full transition-all"
                style={{
                  padding:    "0.25rem 0.75rem 0.25rem 0.25rem",
                  background: menuOpen ? "var(--surface-raised)" : "var(--surface-raised)",
                  border:     `1px solid ${menuOpen ? "var(--accent-glow-md)" : "var(--border)"}`,
                  cursor:     "pointer",
                }}
              >
                <div style={{ width: "26px", height: "26px", borderRadius: "6px", overflow: "hidden", background: "var(--bg)", flexShrink: 0 }}>
                  <Image src={getAvatarUrl(avatar)} alt={name || username || "avatar"} width={26} height={26}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} unoptimized />
                </div>
                <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                  {name || username || "Profile"}
                </span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ color: "var(--text-3)", transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {/* Dropdown menu */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 fade-in"
                  style={{
                    background:   "var(--surface)",
                    border:       "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    boxShadow:    "var(--shadow-xl)",
                    minWidth:     "200px",
                    zIndex:       100,
                    overflow:     "hidden",
                  }}
                >
                  {/* User info header */}
                  <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: "32px", height: "32px", borderRadius: "var(--radius-sm)", overflow: "hidden", flexShrink: 0 }}>
                        <Image src={getAvatarUrl(avatar)} alt={name || username || "avatar"} width={32} height={32}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
                      </div>
                      <div>
                        <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{name || username}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{role}</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  {[
                    { href: "/favorites", icon: "♥", label: "Favourites", color: "#ef4444" },
                    { href: "/profile",   icon: "🎯", label: "Interests",  color: "var(--accent)" },
                  ].map(item => (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
                      style={{
                        color:          "var(--text)",
                        textDecoration: "none",
                        background:     "transparent",
                        display:        "flex",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-raised)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ fontSize: "0.9rem", width: "18px", textAlign: "center" }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </a>
                  ))}

                  <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

                  <button
                    onClick={() => { setMenuOpen(false); handleLogout() }}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm w-full transition-all"
                    style={{ color: "var(--red)", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--red-glow-md)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "0.9rem", width: "18px", textAlign: "center" }}>→</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav bar ────────────────────────────────────────────── */}
      <div style={{ background: "var(--surface)" }}>
        <nav
          className="mx-auto px-6 flex items-center gap-0.5 h-10"
          style={{ maxWidth: "var(--max-w)" }}
        >
          {navLinks.map(link => {
            const isActive = pathname === link.href
            return (
              <a
                key={link.href}
                href={link.href}
                className="nav-link"
                style={{
                  color: isActive ? "var(--accent)" : undefined,
                  background: isActive ? "var(--accent-glow)" : undefined,
                  fontWeight: isActive ? 600 : undefined,
                }}
              >
                {link.label}
              </a>
            )
          })}

          {/* Right-aligned greeting */}
          {username && (
            <a
              href="/profile"
              className="ml-auto hidden sm:flex items-center gap-1.5 nav-link"
              style={{ textDecoration: "none" }}
            >
              <div style={{ width: "18px", height: "18px", borderRadius: "4px", overflow: "hidden", background: "var(--surface-raised)", flexShrink: 0 }}>
                <Image
                  src={getAvatarUrl(avatar)}
                  alt={name || username}
                  width={18}
                  height={18}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  unoptimized
                />
              </div>
              <span className="text-xs" style={{ color: "var(--text-3)" }}>
                {name ? `Hi, ${name}` : username}
              </span>
            </a>
          )}
        </nav>
      </div>
    </header>
  )
}
