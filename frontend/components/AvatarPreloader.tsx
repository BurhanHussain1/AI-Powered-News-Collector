"use client"
/**
 * AvatarPreloader — runs once at app boot (mounted inside layout.tsx).
 * Creates browser Image objects for every avatar URL so they land in the
 * browser's HTTP cache before the user opens the avatar picker.
 * Renders nothing visible.
 */
import { useEffect } from "react"
import { AVATARS } from "@/lib/avatars"

export default function AvatarPreloader() {
  useEffect(() => {
    AVATARS.forEach(avatar => {
      const img = new window.Image()
      img.src = avatar.url
    })
  }, [])

  return null
}
