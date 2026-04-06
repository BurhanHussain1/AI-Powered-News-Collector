import type { Metadata, Viewport } from "next"
import "./globals.css"
import AvatarPreloader from "@/components/AvatarPreloader"

export const metadata: Metadata = {
  title: {
    default: "FeedDigest",
    template: "%s — FeedDigest",
  },
  description: "Your daily briefing on artificial intelligence, technology & security. Curated by AI, delivered daily.",
  keywords: ["AI", "artificial intelligence", "machine learning", "tech news", "security", "digest"],
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b0b0e"  },
  ],
  width: "device-width",
  initialScale: 1,
}

/* Anti-flash: apply stored theme before React hydrates */
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('ai-digest-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (t === 'dark' || (!t && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
  } catch(e){}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <AvatarPreloader />
        {children}
      </body>
    </html>
  )
}
