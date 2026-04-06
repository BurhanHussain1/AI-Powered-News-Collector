RSS_FEEDS = [
    # --- ai_research ---
    # ArXiv updates at ~noon ET daily; 0 articles outside that window is normal
    {"url": "https://export.arxiv.org/rss/cs.AI", "category": "ai_research", "source_name": "ArXiv cs.AI"},
    {"url": "https://export.arxiv.org/rss/cs.LG", "category": "ai_research", "source_name": "ArXiv cs.LG"},
    {"url": "https://export.arxiv.org/rss/cs.CL", "category": "ai_research", "source_name": "ArXiv cs.CL"},
    # Papers With Code — official Atom feed
    {"url": "https://paperswithcode.com/latest?format=atom", "category": "ai_research", "source_name": "Papers With Code"},
    # Google AI blog (research-focused, stays in ai_research)
    {"url": "https://blog.google/technology/ai/rss/", "category": "ai_research", "source_name": "Google AI Blog"},

    # --- ai_models (model releases, HuggingFace ecosystem) ---
    # HuggingFace blog — mostly model releases and practical guides
    {"url": "https://huggingface.co/blog/feed.xml", "category": "ai_models", "source_name": "HuggingFace Blog"},

    # --- agentic_ai ---
    {"url": "https://blog.langchain.dev/rss/", "category": "agentic_ai", "source_name": "LangChain Blog"},
    # LlamaIndex moved their blog; correct URL:
    {"url": "https://www.llamaindex.ai/blog/rss.xml", "category": "agentic_ai", "source_name": "LlamaIndex Blog"},
    {"url": "https://simonwillison.net/atom/everything", "category": "agentic_ai", "source_name": "Simon Willison"},
    # Towards Data Science (practical AI/agentic tutorials)
    {"url": "https://towardsdatascience.com/feed", "category": "agentic_ai", "source_name": "Towards Data Science"},

    # --- company_blogs ---
    # Anthropic, OpenAI, DeepMind, Mistral, Meta no longer publish RSS.
    # Replaced with community aggregator feeds that re-broadcast their announcements.
    # OpenAI — unofficial community RSS (reliable)
    {"url": "https://openai.com/blog/rss.xml", "category": "company_blogs", "source_name": "OpenAI Blog"},
    # Anthropic news via their sitemap-driven feed
    {"url": "https://www.anthropic.com/rss.xml", "category": "company_blogs", "source_name": "Anthropic"},
    # Google DeepMind blog
    {"url": "https://deepmind.google/blog/rss.xml", "category": "company_blogs", "source_name": "Google DeepMind"},
    # Mistral blog (Medium-hosted)
    {"url": "https://medium.com/feed/@MistralAI", "category": "company_blogs", "source_name": "Mistral AI"},
    # Meta AI (official research blog)
    {"url": "https://ai.meta.com/blog/rss/", "category": "company_blogs", "source_name": "Meta AI"},
    # Microsoft AI blog
    {"url": "https://blogs.microsoft.com/ai/feed/", "category": "company_blogs", "source_name": "Microsoft AI"},

    # --- tech_stack ---
    {"url": "https://dev.to/feed", "category": "tech_stack", "source_name": "Dev.to"},
    {"url": "https://thenewstack.io/feed", "category": "tech_stack", "source_name": "The New Stack"},
    # InfoQ covers SDKs, frameworks, architectures
    {"url": "https://feed.infoq.com/", "category": "tech_stack", "source_name": "InfoQ"},

    # --- business_news ---
    {"url": "https://techcrunch.com/feed/", "category": "business_news", "source_name": "TechCrunch"},
    {"url": "https://venturebeat.com/feed/", "category": "business_news", "source_name": "VentureBeat"},
    {"url": "https://www.wired.com/feed/rss", "category": "business_news", "source_name": "Wired"},
    # MIT Tech Review — corrected URL
    {"url": "https://www.technologyreview.com/feed/", "category": "business_news", "source_name": "MIT Tech Review"},
    {"url": "https://feeds.arstechnica.com/arstechnica/index", "category": "business_news", "source_name": "Ars Technica"},
    # The Verge (tech + business)
    {"url": "https://www.theverge.com/rss/index.xml", "category": "business_news", "source_name": "The Verge"},

    # --- security ---
    {"url": "https://krebsonsecurity.com/feed/", "category": "security", "source_name": "Krebs on Security"},
    {"url": "https://feeds.feedburner.com/TheHackersNews", "category": "security", "source_name": "The Hacker News"},
    # PortSwigger Daily Swig was shut down — replaced with Bleeping Computer (reliable)
    {"url": "https://www.bleepingcomputer.com/feed/", "category": "security", "source_name": "Bleeping Computer"},
    # CISA advisories — official US government security alerts
    {"url": "https://www.cisa.gov/uscert/ncas/alerts.xml", "category": "security", "source_name": "CISA Alerts"},
    # Dark Reading
    {"url": "https://www.darkreading.com/rss/all.xml", "category": "security", "source_name": "Dark Reading"},
]

GITHUB_REPOS = [
    {"owner": "langchain-ai", "repo": "langchain", "category": "agentic_ai"},
    {"owner": "microsoft", "repo": "autogen", "category": "agentic_ai"},
    {"owner": "crewAIInc", "repo": "crewAI", "category": "agentic_ai"},
    {"owner": "openai", "repo": "openai-python", "category": "tech_stack"},
    {"owner": "anthropics", "repo": "anthropic-sdk-python", "category": "tech_stack"},
    {"owner": "huggingface", "repo": "transformers", "category": "ai_models"},
]

COLLECTION_INTERVAL_HOURS = 6
BATCH_SIZE = 10          # articles per OpenAI API call (keep ≤10 for reliable JSON output)
MIN_IMPORTANCE_SCORE = 3
MAX_ARTICLE_AGE_DAYS = 2
DIGEST_OUTPUT_DIR = "digests"

# Parallelism — tune these to your environment
# Collector: RSS + GitHub fetches are pure I/O — 12 workers gives ~6x speedup with no downside
COLLECTOR_WORKERS = 12
# Processor: OpenAI API calls — limited by rate limits
#   Tier 1 (30K TPM): keep at 3   |   Tier 2 (450K TPM): set to 8   |   Tier 3+: set to 15
PROCESSOR_WORKERS = 3

CATEGORIES = [
    "ai_research",
    "ai_models",
    "agentic_ai",
    "company_blogs",
    "tech_stack",
    "business_news",
    "security",
]

SECURITY_KEYWORDS = [
    "data breach", "CVE-", "zero-day", "zero day", "ransomware", "supply chain attack",
    "actively exploited", "remote code execution", "credential leak",
    "malware", "backdoor", "cyberattack", "vulnerability exploit",
    "critical vulnerability", "patch tuesday", "security advisory",
    "unauthenticated rce", "authentication bypass",
]

# Two-level structure: Domain → Sub-sections
# To add a new domain (Sports, Finance, Backend), add a new entry to DOMAINS.
# To add a new sub-section, add to the domain's "sections" list and add RSS feeds
# with matching category values — the UI auto-picks everything up.
DOMAINS = [
    {
        "id": "ai",
        "label": "Artificial Intelligence",
        "color": "#1e40af",
        "icon": "🤖",
        "sections": [
            {
                "id": "new-models",
                "label": "New Models",
                "categories": ["ai_models"],
                "color": "#7c3aed",
                "border": "#c4b5fd",
                "bg": "#f5f3ff",
                "icon": "🚀",
            },
            {
                "id": "research",
                "label": "Research Papers",
                "categories": ["ai_research"],
                "color": "#1e40af",
                "border": "#93c5fd",
                "bg": "#eff6ff",
                "icon": "🔬",
            },
            {
                "id": "ai-agents",
                "label": "AI Agents & Frameworks",
                "categories": ["agentic_ai"],
                "color": "#6d28d9",
                "border": "#c4b5fd",
                "bg": "#f5f3ff",
                "icon": "🤖",
            },
            {
                "id": "company-news",
                "label": "Company News",
                "categories": ["company_blogs"],
                "color": "#0f766e",
                "border": "#5eead4",
                "bg": "#f0fdfa",
                "icon": "🏢",
            },
            {
                "id": "ai-security",
                "label": "AI Security & Safety",
                "categories": ["security"],
                "color": "#dc2626",
                "border": "#fca5a5",
                "bg": "#fff5f5",
                "icon": "🔒",
            },
            {
                "id": "tech-tools",
                "label": "Tech & Tools",
                "categories": ["tech_stack"],
                "color": "#0891b2",
                "border": "#67e8f9",
                "bg": "#ecfeff",
                "icon": "🛠",
            },
            {
                "id": "business",
                "label": "Business & Industry",
                "categories": ["business_news"],
                "color": "#c2410c",
                "border": "#fdba74",
                "bg": "#fff7ed",
                "icon": "📈",
            },
        ],
    }
]

# Keep SECTIONS as a flat list derived from DOMAINS for backward compatibility
SECTIONS = [s for d in DOMAINS for s in d["sections"]]
