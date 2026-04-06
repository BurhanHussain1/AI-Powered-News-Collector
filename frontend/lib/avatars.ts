/**
 * Avatar configuration — uses DiceBear v9 `bottts-neutral` style.
 *
 * bottts-neutral generates clean, professional robot/bot illustrations.
 * Seeds are named after AI models and computing concepts — directly on-brand
 * for an AI news digest.
 *
 * All 20 avatars are pre-fetched at boot (AvatarPreloader.tsx) so the picker
 * loads instantly without any delay.
 *
 * To change the visual style, swap AVATAR_STYLE to another DiceBear style:
 *   "bottts"        — colourful chunky robots
 *   "micah"         — illustrated human faces
 *   "avataaars"     — classic cartoon people
 *   "pixel-art"     — retro pixel-art characters
 *   "identicon"     — geometric tech patterns
 */

export const AVATAR_STYLE = "bottts-neutral"
export const AVATAR_SIZE  = 120    // px used when fetching; CSS controls display size

/** Build a DiceBear SVG URL from a seed string. */
export function avatarUrl(seed: string, size = AVATAR_SIZE): string {
  const params = new URLSearchParams({
    seed,
    size:           String(size),
    radius:         "12",            // slight rounding — keeps that "robot panel" look
    backgroundType: "gradientLinear",
  })
  return `https://api.dicebear.com/9.x/${AVATAR_STYLE}/svg?${params}`
}

/** The 20 pre-defined avatars shown in the picker. */
export interface Avatar {
  id:      string   // also used as DiceBear seed
  label:   string
  caption: string   // short descriptor shown below the avatar
  url:     string
}

const SEEDS: { id: string; label: string; caption: string }[] = [
  { id: "Claude",   label: "Claude",   caption: "Anthropic"        },
  { id: "GPT",      label: "GPT",      caption: "OpenAI"           },
  { id: "Gemini",   label: "Gemini",   caption: "Google DeepMind"  },
  { id: "Llama",    label: "Llama",    caption: "Meta AI"          },
  { id: "Mistral",  label: "Mistral",  caption: "Mistral AI"       },
  { id: "Falcon",   label: "Falcon",   caption: "TII"              },
  { id: "Grok",     label: "Grok",     caption: "xAI"              },
  { id: "Phi",      label: "Phi",      caption: "Microsoft"        },
  { id: "Neural",   label: "Neural",   caption: "Deep Learning"    },
  { id: "Quantum",  label: "Quantum",  caption: "Computing"        },
  { id: "Tensor",   label: "Tensor",   caption: "ML Core"          },
  { id: "Vector",   label: "Vector",   caption: "Embeddings"       },
  { id: "Synapse",  label: "Synapse",  caption: "Neural Net"       },
  { id: "Cipher",   label: "Cipher",   caption: "Security"         },
  { id: "Lambda",   label: "Lambda",   caption: "Serverless"       },
  { id: "Kernel",   label: "Kernel",   caption: "OS & ML"          },
  { id: "Vertex",   label: "Vertex",   caption: "Graph & ML"       },
  { id: "Matrix",   label: "Matrix",   caption: "Linear Algebra"   },
  { id: "Nexus",    label: "Nexus",    caption: "AI Hub"           },
  { id: "Sage",     label: "Sage",     caption: "Knowledge"        },
]

export const AVATARS: Avatar[] = SEEDS.map(s => ({
  ...s,
  url: avatarUrl(s.id),
}))

/** Default avatar id and URL for new users / fallback. */
export const DEFAULT_AVATAR_ID  = "Neural"
export const DEFAULT_AVATAR_URL = avatarUrl(DEFAULT_AVATAR_ID)

/** Resolve an avatar URL by its id string; falls back to default. */
export function getAvatarUrl(id: string | null | undefined): string {
  if (!id) return DEFAULT_AVATAR_URL
  const found = AVATARS.find(a => a.id === id)
  return found ? found.url : avatarUrl(id)
}
