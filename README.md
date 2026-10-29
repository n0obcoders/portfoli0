# Nitin Shukla · Cybersecurity Portfolio

A streaming-service-inspired portfolio with a profile picker, billboard hero, animated packet flow, detail modals, a client-side PCAP lab and a **live passive-recon console** for any public domain. Plain HTML, CSS and JavaScript — no build step, no framework, no trackers.

**Live:** <https://n0obcoders.github.io/portfoli0/>

## What's inside

| | |
|---|---|
| 🎬 **"Who's viewing?" profiles** | Recruiter, Security Lead, Developer and Explorer. Each profile reorders the sections, changes the featured title and is remembered between visits. |
| 🛰 **Live recon console** | Enter a domain or URL to collect DNS, RDAP/WHOIS, Certificate Transparency, IP/ASN, hosting and HTTP security headers from public APIs. It grades header hygiene, fingerprints the stack, checks `robots.txt` / `security.txt` / `sitemap.xml`, and exports JSON or Markdown. |
| 🧪 **PCAP Lab** | Drop a `.pcap` or `.pcapng` file to get a packet list, protocol tree, hex dump and display filters. Decodes Ethernet, SLL, IPv4/IPv6, ARP, TCP, UDP, ICMP, DNS, HTTP, TLS SNI and QUIC. Runs entirely in the browser. |
| 📄 **Published research** | JETIR 2026 paper on NetworkSentinel, with an animated RFC 9000 QUIC audit and one-click citation copy. |
| 🏅 **Certificates** | Thumbnail grid, keyboard-navigable lightbox and links to the original PDFs. |
| 📚 **Currently Learning** | Six active learning tracks — web exploitation, Rust async I/O, Android security, detection engineering, cloud/container security and malware analysis. |
| 🐙 **Live GitHub row** | Pulls the latest public repositories from the GitHub API and caches them for an hour. |
| ⌨️ **Command palette** | `Ctrl+K` or `/` searches everything. The terminal understands `help`, `whoami`, `nmap nitin`, `scan <domain>` and `sudo hire nitin`. |
| 🔗 **Deep links** | `#/project/packetra` and `#/cert/paloalto` open the matching detail view directly. |
| ♿ **Responsive & accessible** | Keyboard focus management, skip link, reduced-motion support and layouts from 320 px phones to 4K displays. |

## Recon console

The scanner is intentionally **passive OSINT**. It reads public records and a site's own public homepage response; it does not port-scan, fuzz, brute-force or send exploit traffic.

- **Input:** bare domains, full URLs and paths are accepted. Query strings are ignored; the path is preserved so per-page checks are possible.
- **Blocked:** localhost, private, link-local, multicast and reserved addresses.
- **Sources (all CORS-friendly):** Google DNS-over-HTTPS, RDAP, Cert Spotter with a crt.sh fallback, ipinfo.io / ip.sb / ipwho.is, HackerTarget, Jina Reader with a Microlink fallback.
- **Rate limits:** public APIs can throttle or time out. CT lookups for very large domains are the slowest part and may take 10–20 seconds. A result is cached for 10 minutes; recent scans are kept in `localStorage`.
- **Exports:** the report can be copied as Markdown or downloaded as JSON.

No API keys are required. No visitor data is sent anywhere except the public lookup services listed above.

## Deploy to GitHub Pages

The site deploys from the root of the existing **`portfoli0`** repository:

<https://github.com/n0obcoders/portfoli0>

1. Copy this folder's contents into the repository root (keep `.nojekyll`, `assets/`, `css/` and `js/`).
2. Commit and push to `main`.
3. In **Settings → Pages**, use **Deploy from a branch → `main` / root**.
4. Open <https://n0obcoders.github.io/portfoli0/>.

All paths are relative, so the same build also works at a custom domain or under any repository name.

### Windows Git Bash commands

```bash
cd /c/Users/nitin/OneDrive/Desktop
cp -r portfolio-v2/. /c/Users/nitin/portfoli0/
cd /c/Users/nitin/portfoli0
git status
git add -A
git commit -m "Rebuild portfolio with live recon console and current resume"
git push origin main
```

Then check **Actions / Pages** in the repository and hard-refresh the live URL.

## Editing content

Everything data-driven lives in **`js/data.js`**:

- **Profile / stats / résumé:** `profile`.
- **Projects:** `projects`. Use `status: "shipped"` or `"research"`; project links and detail bullets are rendered automatically.
- **Learning tracks:** `learning`. These replace the old "Now Building" row.
- **Research, certificates, education, skills:** the matching arrays at the bottom of the file.
- **Résumé:** overwrite `assets/Nitin_Shukla_Resume.pdf`.
- **Social preview:** replace `assets/og.png` (1200×630).

UI behaviour lives in `js/main.js`. The recon scanner is `js/recon.js`; the PCAP parser is `js/pcap.js`.

## Structure

```
index.html          page markup and recon console shell
404.html            custom not-found page
css/style.css       all styles
js/data.js          ← content: profile, projects, learning, certs, skills
js/main.js          profiles, rows, modals, palette, GitHub feed
js/recon.js         passive reconnaissance engine and report UI
js/pcap.js          pcap/pcapng parser, dissectors and sample capture
assets/             résumé, certificates, thumbnails, favicon, OG image
.nojekyll           serve files as-is on GitHub Pages
```

The contact section opens the visitor's email client with `mailto:`; there is no backend and no form data is stored.
