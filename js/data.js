/* ==========================================================================
   PORTFOLIO DATA — edit this file to update the site. No build step needed.
   ========================================================================== */
window.PORTFOLIO = {
  profile: {
    name: "Nitin Harishchandra Shukla",
    short: "Nitin Shukla",
    role: "Cybersecurity Researcher · Security Tooling Engineer",
    location: "Mumbai, India",
    email: "nitinshukla7944@gmail.com",
    github: "n0obcoders",
    resume: "assets/Nitin_Shukla_Resume.pdf",
    available: "Open to SOC, penetration-testing and cybersecurity analyst roles",
    tagline:
      "M.Sc. Cyber Security @ University of Mumbai. Published researcher building memory-safe security tooling — Rust network diagnostics, Android traffic analysis, private browsing and OSINT workbenches.",
    roles: ["SOC Analyst", "Penetration Tester", "Cybersecurity Analyst", "Security Tooling Engineer"],
    stats: [
      { n: 1, label: "Published paper" },
      { n: 9, label: "Certifications" },
      { n: 8, label: "Projects built" },
      { n: 8.93, label: "B.Sc. CGPA" }
    ]
  },

  /* ---------- Projects. status: "shipped" | "research" ---------- */
  projects: [
    {
      id: "networksentinel",
      title: "NetworkSentinel",
      kicker: "Published Research · JETIR 2026",
      status: "research",
      year: "2026",
      genre: ["Rust", "Packet Analysis", "QUIC"],
      art: { a: "#e50914", b: "#310205", icon: "radar" },
      match: 99,
      summary:
        "A memory-safe, cross-platform Rust framework that unifies Nmap-style host and service scanning, live packet capture, protocol decoding, bidirectional flow tracking and PCAP post-mortem analysis in one CLI toolkit.",
      bullets: [
        "Dedicated QUIC diagnostic subsystem implementing all five RFC 9000 security-relevant compliance tests — anti-amplification limit, Initial-packet padding, version negotiation, 0-RTT anti-replay and path validation — a capability absent from Nmap and Wireshark.",
        "One shared Rust core compiled for Windows (Npcap) and Android (Termux), producing identical diagnostic output on both platforms.",
        "Reaches an A+ (100/100) QUIC audit grade on reference targets on both platforms."
      ],
      tech: ["Rust", "Cargo workspaces", "Npcap", "libpcap", "QUIC / RFC 9000", "Windows", "Android (Termux)"],
      links: [
        { label: "Read the paper", href: "https://www.jetir.org/view?paper=JETIR2609221", primary: true },
        { label: "GitHub", href: "https://github.com/n0obcoders/NetworkSentinel" }
      ]
    },
    {
      id: "packetra",
      title: "Packetra",
      kicker: "Android · Network Visibility",
      status: "shipped",
      year: "2026",
      genre: ["Kotlin", "VpnService", "Security Assessment"],
      art: { a: "#0ea5e9", b: "#031c2b", icon: "phone" },
      match: 98,
      summary:
        "A defensive-first, non-root packet analyzer and web-assessment toolkit for Android. It captures the device's own traffic through VpnService, attributes every connection to an app, enriches it offline, and turns passive visibility into a clear, authorized security report.",
      high: [
        { t: "Root-free capture", d: "Local VpnService tunnel captures every app's traffic without root, mapping each connection to the UID that opened it." },
        { t: "Offline enrichment", d: "Bundled ASN and GeoIP data, DPI protocol classification, TLS-SNI and HTTP-host extraction keep intelligence on-device." },
        { t: "Firewall & export", d: "Per-app and per-domain blocking, plus PCAPng, PCAP-over-IP and HAR export for Wireshark and downstream tooling." },
        { t: "Authorized web checks", d: "Security headers, CSP, cookie flags, CORS, TLS telemetry, tech fingerprinting and secret scanning with CVSS 3.1 triage." },
        { t: "Reports that ship", d: "Findings export as JSON, SARIF 2.1.0 or Markdown — ready for a ticketing system or a client hand-off." },
        { t: "Passive OSINT", d: "Certificate Transparency, DoH, RDAP/WHOIS, SPF/DMARC/DKIM and subdomain-takeover checks in one workflow." },
        { t: "Scope guardrails", d: "Deny-by-default engagement scope, GET-only checks, SSRF-range blocking and bounded concurrency keep every test authorized." }
      ],
      tech: ["Kotlin", "Jetpack Compose", "Hilt", "Room", "VpnService", "OkHttp", "Rust (JNI)"],
      links: [
        { label: "Download APK", href: "https://github.com/n0obcoders/Packetra/releases/download/build/packetra-v1.19.0-debug.apk", icon: "download", primary: true },
        { label: "View on GitHub", href: "https://github.com/n0obcoders/Packetra" }
      ]
    },
    {
      id: "n3core",
      title: "N3 Core",
      kicker: "Android · Offline Workspace",
      status: "shipped",
      year: "2026",
      genre: ["Code Editor", "PCAP Reader", "Privacy"],
      art: { a: "#a855f7", b: "#18052b", icon: "code" },
      match: 97,
      summary:
        "One core, every workflow: a fully on-device Android workspace that pairs a VS Code-style multi-language code editor and syntax checker with an advanced PCAP/PCAPNG reader. No account, no cloud round-trip.",
      high: [
        { t: "VS Code-style editor", d: "Multi-language syntax highlighting, virtualized rendering and an incremental syntax checker built for very large files." },
        { t: "Deep PCAP reading", d: "Ethernet, IPv4/IPv6, TCP/UDP, DNS, HTTP, TLS SNI and QUIC decoding, with follow-stream, a combined IP/port/transport filter and text export." },
        { t: "Built for scale", d: "Virtualized packet list and editor stay responsive across hundreds of thousands of packets and 32 MB files." },
        { t: "Notes, locked", d: "Per-item AES-256-GCM encryption with keys held in the Android Keystore." }
      ],
      tech: ["Kotlin", "Jetpack Compose", "Room", "pure-Kotlin PCAP parser", "Android Keystore"],
      links: [
        { label: "Download APK", href: "https://github.com/n0obcoders/N3-EDITOR/releases/download/N3-CORE/N3-Core-1.4.0.apk", icon: "download", primary: true },
        { label: "View on GitHub", href: "https://github.com/n0obcoders/N3-EDITOR" },
        { label: "Try the PCAP reader", href: "#lab", icon: "terminal" }
      ]
    },
    {
      id: "injectra",
      title: "Injectra",
      kicker: "Android · Private Browser",
      status: "shipped",
      year: "2026",
      genre: ["WebView", "Privacy", "Web Testing"],
      art: { a: "#f97316", b: "#2b1103", icon: "shield" },
      match: 96,
      summary:
        "A hardened, privacy-focused Android browser that doubles as a Burp-style web-testing workbench — with a published capability matrix that is explicit about what is and is not in scope.",
      high: [
        { t: "Private by default", d: "Process-isolated private windows, a ~200-network ad and tracker blocklist, HTTPS upgrading and no tracking analytics." },
        { t: "Locked-down WebView", d: "No JavaScript bridges, blocked file/content/javascript navigation and sanitized intent handling reduce the browser's attack surface." },
        { t: "Rules engine", d: "Block, redirect and rewrite responses, or inject JS/CSS — the same workflow testers reach for Burp Suite to get." },
        { t: "Testing workbench", d: "Network inspector, request repeater, JWT and hashing encoders, passive scanner and scope control, limited to the browser's own traffic." }
      ],
      tech: ["Kotlin", "Android WebView (Chromium)", "OkHttp", "JavaScript bridges disabled"],
      links: [
        { label: "Download APK", href: "https://github.com/n0obcoders/Injectra/releases/download/v1.7/injectra-v1.7.apk", icon: "download", primary: true },
        { label: "View on GitHub", href: "https://github.com/n0obcoders/Injectra" }
      ]
    },
    {
      id: "sessiongram",
      title: "SessionGram",
      kicker: "Python · Multi-Account Telegram",
      status: "shipped",
      year: "2026",
      genre: ["Telethon", "Kotlin", "Scale"],
      art: { a: "#22c55e", b: "#03220f", icon: "mail" },
      match: 95,
      summary:
        "A multi-account Telegram client that keeps 150+ sessions connected behind one interface — with bulk session import, a unified inbox and secrets that never leave the device.",
      high: [
        { t: "150+ accounts", d: "Phone + OTP and 2FA login, bulk session import and a single unified inbox for every account." },
        { t: "Built for bursts", d: "Bounded connection pools and virtualized rendering cut worst-case UI frame time from ~230 ms to ~60 ms under a 600-message burst." },
        { t: "On-device privacy", d: "A SHA-256 passcode lock and all session secrets stay local. No server, no analytics, no tracking." }
      ],
      tech: ["Python", "Telethon", "aiohttp", "Kotlin / WebView", "Chaquopy"],
      links: [
        { label: "Download APK", href: "https://github.com/n0obcoders/SessionGram/releases/download/v2.0/SessionGram-v2.0-arm64-v8a.apk", icon: "download", primary: true },
        { label: "All 3 builds + source", href: "https://github.com/n0obcoders/SessionGram/releases/tag/v2.0", icon: "cloud" },
        { label: "View source", href: "https://github.com/n0obcoders/SessionGram" }
      ]
    },
    {
      id: "phishwebdetect",
      title: "PhishWebDetect",
      kicker: "Security Automation · Python",
      status: "shipped",
      year: "2025",
      genre: ["Threat Intel", "OSINT", "SMTP"],
      art: { a: "#eab308", b: "#2b1b03", icon: "hook" },
      match: 93,
      summary:
        "A phishing-detection and automated takedown system that analyses URL structure, IP-based domains and WHOIS registration metadata, then routes evidence-backed abuse reports to the right registrar and host.",
      bullets: [
        "Engineered detection features — URL length, IP-address presence and domain-registration age — to improve classification accuracy.",
        "DNS reconnaissance and WHOIS enrichment for every flagged indicator.",
        "Automated abuse-reporting pipeline sends evidence-backed takedown requests to hosting-provider and registrar abuse contacts over SMTP."
      ],
      tech: ["Python", "WHOIS", "DNS recon", "SMTP", "Feature engineering"],
      links: [
        { label: "View on GitHub", href: "https://github.com/n0obcoders/PhishWebDetect", primary: true }
      ]
    },
    {
      id: "dorkmaster",
      title: "DorkMaster",
      kicker: "Android · OSINT Utility",
      status: "shipped",
      year: "2025",
      genre: ["Kotlin", "OSINT", "Search"],
      art: { a: "#38bdf8", b: "#061d2b", icon: "compass" },
      match: 90,
      summary:
        "A Google-dork search-link generator across 20 categories, built for manual OSINT review. It generates queries only — no automated crawling and no scraping.",
      bullets: [
        "20 curated dork categories covering exposed files, login pages, directory listings and public documents.",
        "One-tap query construction with copy/share for a manual, auditable OSINT workflow."
      ],
      tech: ["Kotlin", "Android", "OSINT"],
      links: [
        { label: "View on GitHub", href: "https://github.com/n0obcoders/dorkmaster-android", primary: true }
      ]
    },
    {
      id: "internshipfinder",
      title: "Internship Finder",
      kicker: "Web App · Live",
      status: "shipped",
      year: "2025",
      genre: ["Python", "Streamlit", "Automation"],
      art: { a: "#14b8a6", b: "#032321", icon: "briefcase" },
      match: 88,
      summary:
        "An automated outreach web application that sends personalised cold emails at scale. Deployed live on Streamlit Cloud and used for real internship outreach.",
      bullets: [
        "Bulk, personalised email delivery using SMTP via smtplib and the Python email library.",
        "Deployed as a live Streamlit Cloud app for on-demand use."
      ],
      tech: ["Python", "smtplib", "Streamlit Cloud"],
      links: [
        { label: "View on GitHub", href: "https://github.com/n0obcoders/internship-cold-mailer", primary: true }
      ]
    }
  ],

  /* ---------- Learning tracks (replaces the old "Now Building" row) ---------- */
  learning: [
    {
      id: "web-exploitation",
      title: "Web Exploitation",
      source: "PortSwigger Web Security Academy · labs",
      stage: "Deep dive",
      focus: 78,
      desc: "Working through authentication, access-control, SSRF and deserialization labs, then rebuilding each finding as a clear report with impact and remediation.",
      tags: ["Burp Suite", "SSRF", "Access control"],
      icon: "hook",
      color: "#e50914"
    },
    {
      id: "rust-networking",
      title: "Rust Systems & Async I/O",
      source: "Self-directed · tokio + pnet",
      stage: "Practising",
      focus: 66,
      desc: "Moving beyond CLI tools into async packet pipelines: zero-copy parsing, bounded channels and back-pressure for high-throughput capture.",
      tags: ["Rust", "tokio", "pnet"],
      icon: "terminal",
      color: "#f59e0b"
    },
    {
      id: "android-security",
      title: "Android Security Engineering",
      source: "Self-directed · AOSP + OWASP MASTG",
      stage: "Deep dive",
      focus: 72,
      desc: "VpnService internals, JNI boundaries, Keystore-backed crypto and WebView hardening — tested against the OWASP Mobile Application Security Testing Guide.",
      tags: ["Kotlin", "VpnService", "MASTG"],
      icon: "phone",
      color: "#a855f7"
    },
    {
      id: "detection-engineering",
      title: "Detection Engineering",
      source: "Sigma · Splunk · Elastic",
      stage: "Practising",
      focus: 58,
      desc: "Turning attacker behaviour into durable detections: Sigma rules, ATT&CK mapping and tuning alert logic against realistic log sources.",
      tags: ["Sigma", "MITRE ATT&CK", "SIEM"],
      icon: "shield",
      color: "#22c55e"
    },
    {
      id: "cloud-security",
      title: "Cloud & Container Security",
      source: "AWS Skill Builder · Docker",
      stage: "Exploring",
      focus: 44,
      desc: "IAM least privilege, cloud audit logs and container image hygiene — the parts of cloud security that show up first in a SOC queue.",
      tags: ["AWS IAM", "CloudTrail", "Docker"],
      icon: "cloud",
      color: "#38bdf8"
    },
    {
      id: "malware-analysis",
      title: "Malware Analysis",
      source: "Self-directed · YARA + FLARE",
      stage: "Exploring",
      focus: 38,
      desc: "Static triage, YARA authoring and safe dynamic analysis in an isolated lab, with PCAP-to-IOC workflows built on top of NetworkSentinel.",
      tags: ["YARA", "Static triage", "IOC"],
      icon: "bug",
      color: "#fb7185"
    }
  ],

  research: {
    title: "NetworkSentinel: An Integrated Cross-Platform Framework for Network Reconnaissance, Packet Analysis, and QUIC Diagnostics",
    venue: "International Journal of Emerging Technologies and Innovative Research (JETIR)",
    details: "ISSN 2349-5162 · Vol. 13, Issue 9 · pp. c179–c183 · September 2026",
    id: "JETIR2609221",
    url: "https://www.jetir.org/view?paper=JETIR2609221",
    abstract:
      "Network diagnostics today are fragmented across separate scanners, packet analysers and protocol-specific tools, and none of them audits QUIC transport security. NetworkSentinel unifies active reconnaissance, live capture, protocol decoding, bidirectional flow tracking and PCAP post-mortem analysis in a single memory-safe Rust codebase. Its QUIC subsystem implements the five RFC 9000 security-relevant compliance tests and produces identical, graded results on Windows (Npcap) and Android (Termux).",
    checks: [
      ["Anti-amplification limit", "Server never sends more than 3× the bytes received before address validation."],
      ["Initial-packet padding", "Client Initial datagrams are padded to at least 1200 bytes."],
      ["Version negotiation", "Unknown versions trigger a correct Version Negotiation packet."],
      ["0-RTT anti-replay", "Early data is protected against replay."],
      ["Path validation", "PATH_CHALLENGE / PATH_RESPONSE behave correctly on migration."]
    ]
  },

  certificates: [
    { id: "paloalto", title: "Cybersecurity Virtual Internship", org: "Palo Alto Networks · AICTE EduSkills", date: "Jul – Sep 2025", file: "assets/certs/paloalto.pdf", thumb: "assets/thumbs/paloalto.webp", note: "10-week internship · National Internship Portal, Ministry of Education · Grade B", tag: "Internship" },
    { id: "aisect", title: "Cyber Security Internship (AICTE)", org: "AISECT Learn", date: "2025", file: "assets/certs/aisect.pdf", thumb: "assets/thumbs/aisect.webp", note: "4-credit AICTE internship", tag: "Internship" },
    { id: "aig", title: "Shields Up: Cybersecurity Job Simulation", org: "AIG · Forage", date: "Jun 2025", file: "assets/certs/aig.pdf", thumb: "assets/thumbs/aig.webp", note: "Responding to a zero-day vulnerability · bypassing ransomware (technical)", tag: "Simulation" },
    { id: "telstra", title: "Cybersecurity Job Simulation", org: "Telstra · Forage", date: "May 2025", file: "assets/certs/telstra.pdf", thumb: "assets/thumbs/telstra.webp", note: "Responding to and analysing a malware attack · mitigation (technical) · incident postmortem", tag: "Simulation" },
    { id: "mastercard", title: "Cybersecurity Job Simulation", org: "Mastercard · Forage", date: "May 2025", file: "assets/certs/mastercard.pdf", thumb: "assets/thumbs/mastercard.webp", note: "Designing a phishing email simulation · interpreting the results", tag: "Simulation" },
    { id: "deloitte", title: "Cyber Job Simulation", org: "Deloitte Australia · Forage", date: "May 2025", file: "assets/certs/deloitte.pdf", thumb: "assets/thumbs/deloitte.webp", note: "Practical cyber-security investigation tasks", tag: "Simulation" },
    { id: "eccouncil", title: "SQL Injection Attacks", org: "EC-Council", date: "Aug 2024", file: "assets/certs/eccouncil.webp", thumb: "assets/thumbs/eccouncil.webp", note: "Certificate of Achievement · No. 349620", tag: "Certification" },
    { id: "quantum", title: "Cyber Security & Ethical Hacking", org: "Quantum Learnings", date: "Feb 2024", file: "assets/certs/quantum.pdf", thumb: "assets/thumbs/quantum.webp", note: "30 hours of value-added training · QL-TR-CY-1003", tag: "Certification" },
    { id: "ccna", title: "CCNA Networking", org: "Self-trained · Udemy", date: "2025", file: "", thumb: "assets/thumbs/ccna.svg", note: "Self-trained CCNA networking fundamentals: routing, switching, subnetting and network services.", tag: "Course" }
  ],

  education: [
    { title: "M.Sc. Cyber Security", org: "University of Mumbai", date: "2025 – 2027 (expected)", score: "SGPA 8.0 / 10 (first year)" },
    { title: "B.Sc. Computer Science", org: "Thakur Ramnarayan College of Arts & Commerce · University of Mumbai", date: "2022 – 2025", score: "CGPA 8.93 / 10" }
  ],

  skills: [
    { name: "Packet Analysis", level: 94, group: "Domain" },
    { name: "Network Security", level: 92, group: "Domain" },
    { name: "QUIC / RFC 9000", level: 90, group: "Protocol" },
    { name: "Ethical Hacking", level: 88, group: "Domain" },
    { name: "OSINT", level: 88, group: "Domain" },
    { name: "Rust", level: 87, group: "Code" },
    { name: "Vulnerability Assessment", level: 86, group: "Domain" },
    { name: "Kotlin / Android", level: 84, group: "Code" },
    { name: "Python", level: 80, group: "Code" },
    { name: "Malware Analysis", level: 74, group: "Domain" }
  ],
  toolbox: [
    "Nmap", "Wireshark", "Burp Suite", "Metasploit", "Npcap / libpcap",
    "Shodan", "VirusTotal", "crt.sh", "DNSDumpster", "WHOIS / RDAP",
    "Rust", "Kotlin", "Jetpack Compose", "Python", "Telethon",
    "Hilt", "Room", "Android VpnService", "Cargo workspaces", "Git / GitHub",
    "CVSS 3.1", "SARIF 2.1.0", "JWT", "CI/CD", "Streamlit"
  ]
};
