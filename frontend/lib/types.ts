export interface Article {
  id: number
  title: string
  url: string
  summary: string
  source_name: string
  category: string
  tags: string
  importance_score: number
  published_at: string
  is_security_alert: number
}

export interface DomainSection {
  id: string
  label: string
  color: string
  border: string
  bg: string
  icon: string
  articles?: Article[]
}

export interface Domain {
  id: string
  label: string
  color: string
  icon: string
  sections?: DomainSection[]
}

export interface SectionData {
  section: DomainSection
  domain: { id: string; label: string }
  articles: Article[]
  total: number
}

export interface DigestData {
  date: string
  last_updated: string
  total_count: number
  security_alerts: Article[]
  top_stories: Article[]
  sections: (DomainSection & { articles: Article[] })[]
  has_content: boolean
}

export interface DigestRecord {
  id: number
  date: string
  filepath: string
  created_at: string
  is_deleted: number
}

export interface AuthState {
  authenticated: boolean
  id: number | null
  role: "admin" | "user" | null
  username: string | null
  name: string
  email: string
  avatar: string      // emoji e.g. "🦊"
  interests: string   // comma-separated category ids e.g. "ai_research,security"
}

export interface UserProfile {
  id: number
  username: string
  email: string
  name: string
  role: "admin" | "user"
  avatar: string
  interests: string
  created_at: string
}
