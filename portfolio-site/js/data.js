/* ==========================================================================
   PORTFOLIO DATA — edit this file to update the site. No build step needed.
   ========================================================================== */
window.PORTFOLIO = {
  profile: {
    name: "Nitin Harishchandra Shukla",
    short: "Nitin Shukla",
    role: "Cybersecurity Researcher · Network Security Engineer",
    location: "Mumbai, India",
    email: "nitinshukla7944@gmail.com",
    github: "n0obcoders", // GitHub username (used for live repo feed + links)
    resume: "assets/Nitin_Shukla_Resume.pdf",
    tagline:
      "M.Sc. Cyber Security @ University of Mumbai. Published researcher building memory-safe network tooling in Rust — from packet capture and protocol decoding to RFC 9000 QUIC compliance audits — and now taking it mobile.",
    roles: ["SOC Analyst", "Penetration Tester", "Cybersecurity Analyst", "Network Security Engineer"],
    stats: [
      { n: 1, label: "Published paper" },
      { n: 8, label: "Certifications" },
      { n: 5, label: "RFC 9000 checks" },
      { n: 8.93, label: "B.Sc. CGPA" }
    ]
  },

  /* ---------- Projects. status: "shipped" | "building" | "research" ---------- */
  projects: [
    {
      id: "networksentinel",
      title: "NetworkSentinel",
      kicker: "Published Research",
      status: "research",
      year: "2026",
      genre: ["Rust", "Packet Analysis", "QUIC"],
      art: { a: "#e50914", b: "#3a0306", icon: "radar" },
      match: 99,
      summary:
        "A memory-safe, cross-platform Rust framework that unifies Nmap-style host/service scanning, live packet capture, protocol decoding, bidirectional flow tracking and PCAP post-mortem analysis in one CLI toolkit.",
      bullets: [
        "Dedicated QUIC diagnostic subsystem implementing all five RFC 9000 security-relevant compliance tests — anti-amplification limit, Initial-packet padding, version negotiation, 0-RTT anti-replay and path validation — a capability absent from Nmap and Wireshark.",
        "A single shared Rust core compiled for Windows (Npcap) and Android (Termux), producing identical diagnostic output on both platforms.",
        "Reaches an A+ (100/100) QUIC audit grade on reference targets, on both platforms."
      ],
      tech: ["Rust", "Cargo workspaces", "Npcap", "libpcap", "QUIC / RFC 9000", "Windows", "Android (Termux)"],
      links: [
        { label: "Read the paper", href: "https://www.jetir.org/view?paper=JETIR2609221", primary: true },
        { label: "GitHub", href: "https://github.com/n0obcoders" }
      ]
    },
    {
      id: "sentinelcap",
      title: "SentinelCap",
      kicker: "Now Building · Android",
      status: "building",
      year: "2026",
      genre: ["Android", "VpnService", "Wireshark-class"],
      art: { a: "#0ea5e9", b: "#05202e", icon: "phone" },
      match: 97,
      summary:
        "A Wireshark-class packet analyzer for Android that captures without root through VpnService. It covers what PCAPdroid does, including the features PCAPdroid keeps behind its paid tier, and adds deep protocol dissection powered by the NetworkSentinel Rust core.",
      episodes: [
        { t: "Root-free capture", d: "Local VpnService tunnel with a userspace TCP/IP stack — every app's traffic, no root required. Optional root mode via libpcap for raw interface capture." },
        { t: "Per-app attribution", d: "Each connection mapped to the app (UID) that opened it, with icons, live byte counters and per-app timelines." },
        { t: "TLS decryption", d: "Optional on-device MITM with a user-installed CA to inspect HTTPS payloads of debuggable or test apps, with SSLKEYLOG export for Wireshark." },
        { t: "Firewall & blocklists", d: "Block apps, domains, IPs or countries per network; malware detection backed by curated IP/domain blocklists with alerts." },
        { t: "Wireshark-style display filters", d: "Filter expressions such as tcp.port == 443 && ip.dst == 1.1.1.1, plus saved filter presets and colour rules." },
        { t: "Deep dissectors", d: "DNS, HTTP/1.1, HTTP/2, TLS (SNI, JA3/JA4 fingerprints), QUIC and DHCP, with a packet-detail tree and hex pane." },
        { t: "QUIC compliance audit", d: "Runs NetworkSentinel's five RFC 9000 checks from your phone through a Rust JNI bridge and grades the target from A+ to F." },
        { t: "Stream & export", d: "PCAP/PCAPNG export, live streaming to Wireshark over HTTP or UDP, follow-TCP-stream, GeoIP/ASN enrichment and flow graphs." }
      ],
      tech: ["Kotlin", "Jetpack Compose", "VpnService", "Rust (JNI)", "libpcap", "Room"],
      links: [{ label: "Follow on GitHub", href: "https://github.com/n0obcoders", primary: true }]
    },
    {
      id: "sentinelpad",
      title: "SentinelPad",
      kicker: "Now Building · Android",
      status: "building",
      year: "2026",
      genre: ["Editor", "Syntax Checker", "PCAP Reader"],
      art: { a: "#a855f7", b: "#1d0830", icon: "code" },
      match: 96,
      summary:
        "A notepad that grew up. It keeps the simplicity of Windows Notepad, adds VS Code-grade editing and a built-in syntax checker that stays lag-free on large files, and includes a full PCAP reader so you can open a capture and study every packet in detail.",
      episodes: [
        { t: "Notepad simplicity", d: "Tabs, find and replace (regex), word wrap, zoom, go-to-line, encoding and line-ending switches (UTF-8/16, LF/CRLF), session restore and autosave." },
        { t: "VS Code-level editing", d: "Syntax highlighting for 40+ languages, multi-cursor, bracket matching, code folding, minimap, command palette and snippets." },
        { t: "Built-in syntax checker", d: "Incremental Tree-sitter parsing flags errors as you type, with squiggles, a problems panel and quick-jump." },
        { t: "Zero-lag engine", d: "Piece-table text buffer and virtualized line rendering keep scrolling at 60 fps even on 100 MB logs." },
        { t: "PCAP reader", d: "Open .pcap and .pcapng files and get a packet list, protocol-detail tree, hex and ASCII pane, display filters, follow-stream and conversation stats." },
        { t: "Security-analyst extras", d: "Hex editor mode, Base64/URL/JWT decoders, hash calculator, and IOC extraction (IPs, domains, hashes) from any open file." }
      ],
      tech: ["Kotlin", "Tree-sitter", "Piece table", "Rust (pcap parser)", "Jetpack Compose"],
      links: [
        { label: "Try the PCAP reader demo", href: "#lab", primary: true },
        { label: "Follow on GitHub", href: "https://github.com/n0obcoders" }
      ]
    },
    {
      id: "phishguard",
      title: "Phishing Detection & Takedown",
      kicker: "Security Automation",
      status: "shipped",
      year: "2025",
      genre: ["Python", "Threat Intel", "OSINT"],
      art: { a: "#f59e0b", b: "#2b1803", icon: "hook" },
      match: 94,
      summary:
        "Phishing-detection system that analyses URL structure, IP-based domains, special characters and WHOIS registration metadata to flag malicious sites, then automates evidence-backed takedown requests.",
      bullets: [
        "Engineered detection features (URL length, IP-address presence, domain-registration age) to improve classification accuracy.",
        "Automated abuse-reporting pipeline routes evidence-backed takedown requests to hosting-provider and registrar abuse contacts via SMTP.",
        "DNS reconnaissance and WHOIS enrichment for every flagged indicator."
      ],
      tech: ["Python", "WHOIS", "DNS recon", "SMTP", "Feature engineering"],
      links: [{ label: "GitHub", href: "https://github.com/n0obcoders", primary: true }]
    },
    {
      id: "internshipfinder",
      title: "Internship Finder",
      kicker: "Web App · Live",
      status: "shipped",
      year: "2025",
      genre: ["Python", "Streamlit", "Automation"],
      art: { a: "#22c55e", b: "#04220f", icon: "mail" },
      match: 91,
      summary:
        "Automated outreach web application that sends personalised cold emails at scale, deployed live on Streamlit Cloud.",
      bullets: [
        "Bulk, personalised email delivery using SMTP via smtplib and the email library.",
        "Deployed as a live web application on Streamlit Cloud for on-demand use."
      ],
      tech: ["Python", "smtplib", "Streamlit Cloud"],
      links: [{ label: "GitHub", href: "https://github.com/n0obcoders", primary: true }]
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
    { id: "quantum", title: "Cyber Security & Ethical Hacking", org: "Quantum Learnings", date: "Feb 2024", file: "assets/certs/quantum.pdf", thumb: "assets/thumbs/quantum.webp", note: "30 hours of value-added training · QL-TR-CY-1003", tag: "Certification" }
  ],

  education: [
    { title: "M.Sc. Cyber Security", org: "University of Mumbai", date: "2025 – 2027 (expected)", score: "SGPA 8.0 / 10 (first year)" },
    { title: "B.Sc. Computer Science", org: "Thakur Ramnarayan College of Arts & Commerce · University of Mumbai", date: "2022 – 2025", score: "CGPA 8.93 / 10" }
  ],

  skills: [
    { name: "Network Security", level: 92, group: "Domain" },
    { name: "Packet Analysis", level: 92, group: "Domain" },
    { name: "Ethical Hacking", level: 88, group: "Domain" },
    { name: "Rust", level: 85, group: "Code" },
    { name: "Vuln. Assessment", level: 85, group: "Domain" },
    { name: "OSINT", level: 84, group: "Domain" },
    { name: "Wireshark / Nmap", level: 90, group: "Tools" },
    { name: "Python", level: 78, group: "Code" },
    { name: "Burp Suite / Metasploit", level: 78, group: "Tools" },
    { name: "Malware Analysis", level: 72, group: "Domain" }
  ],
  toolbox: ["Nmap", "Wireshark", "Burp Suite", "Metasploit", "Npcap / libpcap", "Shodan", "VirusTotal", "crt.sh", "DNSDumpster", "WHOIS", "Rust", "Python", "Kotlin", "Cargo", "Git / GitHub", "Streamlit", "CCNA networking", "QUIC / RFC 9000"]
};
