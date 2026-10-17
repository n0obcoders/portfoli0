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

## Deploy to GitHub Pages (about 2 minutes)

1. Create a new repository named exactly **`n0obcoders.github.io`**. Using that name puts the site at the root URL.
2. Upload **everything inside this folder** to the repo root, keeping the `assets/`, `css/` and `js/` folders. *Add file → Upload files* and drag-and-drop works.
3. Open **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, choose **Branch: `main` / root**, then **Save**.
4. Wait about a minute, then open `https://n0obcoders.github.io/`.

> If you use a different repo name (for example `portfolio`), the site will be served at `https://n0obcoders.github.io/portfolio/`. All paths are relative, so it works either way.

## Editing content

Everything lives in **`js/data.js`**: profile, projects, research, certificates, education and skills.

- **Add a project:** copy one object in `projects` and change it. Set `status` to `"shipped"`, `"building"` or `"research"`. Projects with `"building"` status show up in the *Now Building* row, and their `episodes` list is the roadmap.
- **Add a certificate:** put the PDF in `assets/certs/` and a preview image in `assets/thumbs/`, then add an entry to `certificates`.
- **Change the GitHub username:** edit `profile.github`.
- **Replace the résumé:** overwrite `assets/Nitin_Shukla_Resume.pdf`.

## Structure

```
index.html          markup
404.html            custom not-found page
css/style.css       all styles
js/data.js          ← your content
js/main.js          UI: profiles, rows, modals, palette, GitHub feed
js/pcap.js          pcap/pcapng parser + dissectors + sample capture
assets/             résumé, certificates, thumbnails, favicon, social image
.nojekyll           tells GitHub Pages to serve files as-is
```

The contact form opens the visitor's email app (`mailto:`), so it needs no backend.
