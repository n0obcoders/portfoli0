# Nitin Shukla · Cybersecurity Portfolio

A streaming-style portfolio site with a profile picker, billboard hero, title rows, detail modals and a working in-browser **PCAP analyzer**. It's plain HTML, CSS and JavaScript, with no build step and no dependencies.

**Live:** `https://n0obcoders.github.io/` once deployed (see below)

## Features

| | |
|---|---|
| 🎬 **"Who's viewing?" profiles** | Recruiter, Security Lead, Developer and Explorer. Each profile reorders the rows and changes the featured title. The site remembers the choice. |
| 🛰 **Live packet-flow hero** | A canvas animation of packets moving between nodes. It pauses when off-screen and respects reduced-motion settings. |
| 📄 **Published research** | The JETIR paper, with an animated RFC 9000 QUIC audit (five checks leading to an A+ grade) and a one-click citation copy. |
| 🏅 **Certificates** | Thumbnails of every certificate, a lightbox with ← → navigation, and a link to open each original PDF. |
| 🔨 **Now Building** | SentinelCap (Android packet analyzer) and SentinelPad (editor + PCAP reader), with each roadmap shown as "episodes". |
| 🧪 **PCAP Lab** | Drop a `.pcap` or `.pcapng` file to get a packet list, protocol tree, hex dump and display filters. It decodes Ethernet, SLL, IPv4/IPv6, ARP, TCP, UDP, ICMP, DNS, HTTP, TLS SNI and QUIC, and runs 100% client-side. |
| 🐙 **Live GitHub row** | Pulls your latest public repos from the GitHub API and caches them for an hour. |
| ⌨️ **Command palette** | `Ctrl+K` or `/` opens search across everything. Try the terminal commands `help`, `whoami`, `nmap nitin` and `sudo hire nitin`. |
| 🔗 **Deep links** | `#/project/sentinelcap` and `#/cert/paloalto` open the matching modal directly, and a Share button is built in. |
| ♿ **Accessible & responsive** | Keyboard navigation, focus trap, skip link, reduced-motion support. It works from 320 px phones up to 4K. |
| 🔎 **SEO** | Open Graph image, JSON-LD `Person` schema and a custom 404 page. |

