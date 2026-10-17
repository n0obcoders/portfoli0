/* ==========================================================================
   Main UI — profiles, billboard, rows, modals, GitHub feed, command palette
   ========================================================================== */
(function () {
  "use strict";
  const D = window.PORTFOLIO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GH = `https://github.com/${D.profile.github}`;

  /* ---------------- icons ---------------- */
  const ICON = {
    radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12 19 5"/><circle cx="12" cy="12" r="1"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/><path d="M9 7l2 2-2 2M13 11h2"/>',
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    hook: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/><path d="m16 16 5 5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    doc: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    github: '<path d="M9 19c-4 1.5-4-2-6-2.5M15 22v-3.9a3.4 3.4 0 0 0-.9-2.6c3.1-.3 6.4-1.5 6.4-7a5.4 5.4 0 0 0-1.5-3.8 5 5 0 0 0-.1-3.7s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0C6.3 .6 5.1 1 5.1 1A5 5 0 0 0 5 4.7a5.4 5.4 0 0 0-1.5 3.8c0 5.5 3.3 6.7 6.4 7a3.4 3.4 0 0 0-.9 2.6V22"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'
  };
  const svg = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ""}</svg>`;

  /* ---------------- toast ---------------- */
  let toastTimer;
  window.toast = function (msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  /* ---------------- profiles ---------------- */
  const PROFILES = {
    recruiter: { label: "Recruiter", sub: "Résumé first", color: "linear-gradient(135deg,#e50914,#7a0309)", icon: "briefcase", order: ["projects", "certs", "research", "skills", "education", "building", "github", "lab", "contact"], hero: "me" },
    security: { label: "Security Lead", sub: "Show me the research", color: "linear-gradient(135deg,#16a34a,#064e1d)", icon: "shield", order: ["research", "projects", "certs", "lab", "skills", "building", "education", "github", "contact"], hero: "networksentinel" },
    developer: { label: "Developer", sub: "Show me the code", color: "linear-gradient(135deg,#2563eb,#0b2566)", icon: "code", order: ["building", "projects", "github", "lab", "skills", "research", "certs", "education", "contact"], hero: "sentinelpad" },
    explorer: { label: "Explorer", sub: "Let me play", color: "linear-gradient(135deg,#eab308,#6b4a03)", icon: "compass", order: ["lab", "building", "projects", "research", "certs", "skills", "github", "education", "contact"], hero: "sentinelcap" }
  };
  let current = null;

  function buildGate() {
    $("#profiles").innerHTML = Object.entries(PROFILES).map(([k, p]) =>
      `<button class="profile" data-profile="${k}"><span class="pic" style="background:${p.color}">${svg(p.icon)}</span><span>${p.label}<small>${p.sub}</small></span></button>`).join("");
    $("#gate").addEventListener("click", (e) => {
      const b = e.target.closest("[data-profile]"); if (!b) return;
      choose(b.dataset.profile);
    });
  }

  function choose(key) {
    current = PROFILES[key] ? key : "recruiter";
    store.set("ns-profile", current);
    const p = PROFILES[current];
    const gate = $("#gate"); gate.classList.add("done"); document.body.classList.remove("locked");
    const av = $("#avatarBtn"); av.style.background = p.color; av.innerHTML = svg(p.icon); av.title = `Viewing as ${p.label}. Click to switch.`;
    // reorder rows
    const rows = $("#rows");
    p.order.forEach((id) => { const el = rows.querySelector(`[data-row="${id}"]`); if (el) rows.appendChild(el); });
    setHero(p.hero);
    window.scrollTo({ top: 0 });
  }

  function openGate() {
    const g = $("#gate"); g.classList.remove("done");
    $(".gate-logo", g).style.display = "none"; $(".gate-pick", g).style.animationDelay = "0s";
    document.body.classList.add("locked");
  }

  /* ---------------- hero ---------------- */
  function setHero(which) {
    const pr = D.profile;
    if (which === "me") {
      $("#heroKicker").textContent = "PORTFOLIO · ORIGINAL SERIES";
      $("#heroTitle").textContent = pr.short;
      $("#heroMatch").textContent = "99% Match";
      $("#heroDesc").textContent = pr.tagline;
      const play = $("#heroPlay"); play.href = "#projects"; play.removeAttribute("target"); $("span", play).textContent = "Play";
      $("#heroInfo").onclick = () => openProject("networksentinel");
      return;
    }
    const p = D.projects.find((x) => x.id === which); if (!p) return setHero("me");
    $("#heroKicker").textContent = p.status === "building" ? "NOW BUILDING · " + p.genre[0].toUpperCase() : p.kicker.toUpperCase();
    $("#heroTitle").textContent = p.title;
    $("#heroMatch").textContent = p.match + "% Match";
    $("#heroDesc").textContent = p.summary;
    const play = $("#heroPlay");
    const l = p.links[0];
    play.href = l.href; $("span", play).textContent = p.status === "research" ? "Read paper" : p.id === "sentinelpad" ? "Try demo" : "Play";
    if (/^https?:/.test(l.href)) { play.target = "_blank"; play.rel = "noopener"; } else play.removeAttribute("target");
    $("#heroInfo").onclick = () => openProject(p.id);
  }

  function typeRoles() {
    const el = $("#typed"), roles = D.profile.roles;
    if (reduced) { el.textContent = "> " + roles.join(" · "); return; }
    let i = 0, j = 0, del = false;
    (function tick() {
      const w = roles[i];
      el.textContent = "> " + w.slice(0, j);
      if (!del && j === w.length) { del = true; return setTimeout(tick, 1600); }
      if (del && j === 0) { del = false; i = (i + 1) % roles.length; }
      j += del ? -1 : 1;
      setTimeout(tick, del ? 35 : 70);
    })();
  }

  function heroStats() {
    $("#heroStats").innerHTML = D.profile.stats.map((s) => `<div><b data-n="${s.n}">0</b><span>${s.label}</span></div>`).join("");
    $$("#heroStats b").forEach((b) => {
      const n = parseFloat(b.dataset.n), dec = String(n).includes(".") ? 2 : 0;
      if (reduced) { b.textContent = n.toFixed(dec); return; }
      const t0 = performance.now();
      (function step(t) { const k = Math.min(1, (t - t0) / 1600); b.textContent = (n * (1 - Math.pow(1 - k, 3))).toFixed(dec); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }

  /* packet-flow canvas */
  function packetCanvas() {
    const c = $("#packets"), ctx = c.getContext("2d");
    let W, H, nodes = [], pkts = [], raf;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const colors = ["#e50914", "#ff4d57", "#ffffff", "#46d369", "#3b82f6"];
    const labels = ["TCP", "UDP", "DNS", "TLS", "QUIC", "ICMP", "ARP", "HTTP"];
    function resize() {
      W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(46, (W * H) / 26000));
      nodes = Array.from({ length: n }, () => ({ x: W * (0.3 + Math.random() * 0.7), y: Math.random() * H, r: 1.5 + Math.random() * 2.5, vx: (Math.random() - .5) * .15, vy: (Math.random() - .5) * .15 }));
    }
    function spawn() {
      if (nodes.length < 2) return;
      const a = nodes[(Math.random() * nodes.length) | 0];
      let b = null, best = 1e9;
      nodes.forEach((n) => { const d = Math.hypot(n.x - a.x, n.y - a.y); if (n !== a && d < best && Math.random() > .3) { best = d; b = n; } });
      if (b) pkts.push({ a, b, t: 0, s: .006 + Math.random() * .012, c: colors[(Math.random() * colors.length) | 0], l: labels[(Math.random() * labels.length) | 0] });
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach((n) => { n.x += n.vx; n.y += n.vy; if (n.x < W * .25 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; });
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 170) { ctx.strokeStyle = `rgba(229,9,20,${(1 - d / 170) * .28})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      nodes.forEach((n) => { ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 7); ctx.fill(); });
      if (Math.random() < .25 && pkts.length < 40) spawn();
      ctx.font = "600 10px JetBrains Mono, monospace";
      pkts = pkts.filter((p) => {
        p.t += p.s; const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        if (p.l && p.t < .5) { ctx.globalAlpha = .55; ctx.fillText(p.l, x + 6, y - 6); ctx.globalAlpha = 1; }
        return p.t < 1;
      });
      raf = requestAnimationFrame(frame);
    }
    resize(); window.addEventListener("resize", resize);
    if (reduced) { frame(); cancelAnimationFrame(raf); return; }
    // pause when off-screen
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf); }).observe(c);
  }

  /* ---------------- tiles ---------------- */
  function art(p, big) {
    const ribbon = p.status === "building" ? '<span class="ribbon">IN DEVELOPMENT</span>' : p.status === "research" ? '<span class="ribbon pub">PUBLISHED</span>' : "";
    return `<span class="tile-art" style="background:radial-gradient(120% 120% at 0% 100%, ${p.art.a} 0%, ${p.art.b} 70%)">
      ${svg(p.art.icon, "glyph")}<span class="tkick"><span class="n-badge" style="font-size:16px">NS</span>${esc(p.kicker)}</span>${ribbon}<span class="tname">${esc(p.title)}</span></span>`;
  }

  function projectTile(p, wide) {
    return `<button class="tile ${wide ? "build-tile" : ""}" data-project="${p.id}" aria-label="${esc(p.title)}: more info">
      ${art(p)}
      <span class="tile-body" style="display:block">
        <span class="tile-actions"><span class="circ fill">${svg("play")}</span><span class="circ">${svg("plus")}</span><span class="circ">${svg("chev")}</span></span>
        <span class="tile-meta"><span class="match">${p.match}% Match</span><span class="rating">${esc(p.year)}</span>${p.episodes ? `<span>${p.episodes.length} Episodes</span>` : ""}</span>
        <span class="tile-genre" style="display:block">${p.genre.map((g) => `<span>${esc(g)}</span>`).join("")}</span>
        ${wide ? `<span class="tile-summary" style="display:-webkit-box">${esc(p.summary)}</span>` : ""}
        ${p.status === "building" ? `<span class="tile-prog" style="display:block"><i style="width:${p.id === "sentinelcap" ? 45 : 35}%"></i></span>` : ""}
      </span></button>`;
  }

  function certTile(c) {
    return `<button class="tile" data-cert="${c.id}" aria-label="${esc(c.title)} certificate">
      <span class="tile-art"><img src="${c.thumb}" alt="${esc(c.title)}, ${esc(c.org)}" loading="lazy" /><span class="ribbon">${esc(c.tag.toUpperCase())}</span></span>
      <span class="tile-body" style="display:block"><span class="tile-title" style="display:block">${esc(c.title)}</span><span class="tile-org" style="display:block">${esc(c.org)} · ${esc(c.date)}</span></span></button>`;
  }

  function renderRows() {
    $("#rowProjects").innerHTML = D.projects.filter((p) => p.status !== "building").map((p) => projectTile(p)).join("") +
      `<a class="gh-tile more" href="${GH}" target="_blank" rel="noopener"><span style="font-size:13px;letter-spacing:.14em;font-weight:800">MORE TITLES</span><h5>See every project on GitHub ›</h5><p style="color:#ffd7d9">github.com/${esc(D.profile.github)}</p></a>`;
    $("#rowBuilding").innerHTML = D.projects.filter((p) => p.status === "building").map((p) => projectTile(p, true)).join("");
    $("#rowCerts").innerHTML = D.certificates.map(certTile).join("");
    $("#rowSkills").innerHTML = D.skills.map((s, i) => {
      const hue = [0, 355, 10, 20, 340, 350, 5, 15, 345, 0][i];
      return `<div class="t10" role="img" aria-label="#${i + 1} ${esc(s.name)}, ${s.level}%"><span class="num">${i + 1}</span><div class="card" style="background:linear-gradient(160deg,hsl(${hue} 85% ${30 - i}%),#141414)"><small>${esc(s.group)}</small><b>${esc(s.name)}</b><div><div class="bar"><i style="--w:${s.level}%"></i></div><small style="letter-spacing:0">${s.level}%</small></div></div></div>`;
    }).join("");
    $("#toolbox").innerHTML = D.toolbox.map((t) => `<span>${esc(t)}</span>`).join("");
    $("#eduList").innerHTML = D.education.map((e, i) => `<div class="edu-item"><span class="s">S${D.education.length - i}</span><div><b>${esc(e.title)}</b><div>${esc(e.org)}</div><div>${esc(e.date)} · <span class="score">${esc(e.score)}</span></div></div></div>`).join("");
    renderResearch();
  }

  function renderResearch() {
    const r = D.research;
    const cite = `N. H. Shukla, "${r.title}," ${r.venue}, ${r.details.replace(/ · /g, ", ")}.`;
    $("#researchBlock").innerHTML = `<div class="research reveal">
      <div>
        <div class="badge-row"><span class="chip gold">PEER-REVIEWED</span><span class="chip red">JETIR 2026</span><span class="chip">${esc(r.id)}</span></div>
        <h4>${esc(r.title)}</h4>
        <p class="venue">${esc(r.venue)}<br>${esc(r.details)}</p>
        <p class="abs">${esc(r.abstract)}</p>
        <div class="m-actions">
          <a class="btn btn-play" href="${r.url}" target="_blank" rel="noopener">${svg("doc")}<span>Read paper</span></a>
          <button class="btn btn-info" data-project="networksentinel">${svg("radar")}<span>About the project</span></button>
        </div>
        <div class="cite"><button id="copyCite">${"Copy citation"}</button>${esc(cite)}</div>
      </div>
      <div>
        <ul class="checks" id="quicChecks">${r.checks.map(([t, d], i) => `<li><span class="cn">${i + 1}</span><span><b>${esc(t)}</b><small>${esc(d)}</small></span><span class="ok">PASS ✓</span></li>`).join("")}</ul>
        <div class="grade"><b id="grade">—</b><span>QUIC audit grade<br>score <span id="score">0</span>/100 · Windows &amp; Android</span></div>
      </div></div>`;
    $("#copyCite").addEventListener("click", () => copy(cite, "Citation copied"));
  }

  function runQuicAudit() {
    const items = $$("#quicChecks li");
    items.forEach((li, i) => setTimeout(() => {
      li.classList.add("pass");
      $("#score").textContent = (i + 1) * 20;
      if (i === items.length - 1) $("#grade").textContent = "A+";
    }, reduced ? 0 : 400 + i * 450));
  }

  /* ---------------- modal ---------------- */
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $("#modalContent").innerHTML = html;
    const m = $("#modal"); m.hidden = false; document.body.classList.add("locked");
    m.scrollTop = 0;
    setTimeout(() => $(".modal-x", m).focus(), 30);
  }
  function closeModal() {
    $("#modal").hidden = true;
    if ($("#gate").classList.contains("done")) document.body.classList.remove("locked");
    if (location.hash.startsWith("#/")) history.replaceState(null, "", location.pathname + location.search);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }

  function openProject(id) {
    const p = D.projects.find((x) => x.id === id); if (!p) return;
    history.replaceState(null, "", "#/project/" + id);
    const eps = p.episodes ? `<div class="episodes"><h4>Episodes <small>Feature roadmap · ${p.episodes.length} episodes</small></h4>${p.episodes.map((e, i) => `<div class="ep"><span class="n">${i + 1}</span><div><b>${esc(e.t)}</b><p>${esc(e.d)}</p></div></div>`).join("")}</div>` : "";
    const more = D.projects.filter((x) => x.id !== id).slice(0, 3);
    openModal(`
      <div class="m-hero" style="background:radial-gradient(120% 140% at 0% 100%, ${p.art.a}, ${p.art.b} 75%)">${svg(p.art.icon, "glyph")}<h2 id="modalTitle">${esc(p.title)}</h2></div>
      <div class="m-body">
        <div>
          <div class="m-actions">${p.links.map((l, i) => `<a class="btn ${i === 0 ? "btn-play" : "btn-info"}" href="${l.href}" ${/^https?:/.test(l.href) ? 'target="_blank" rel="noopener"' : "data-close"}>${svg(i === 0 ? "play" : "github")}<span>${esc(l.label)}</span></a>`).join("")}<button class="btn btn-ghost" data-share="${p.id}">${svg("link")}<span>Share</span></button></div>
          <div class="m-meta"><span class="match">${p.match}% Match</span><span>${esc(p.year)}</span><span class="rating">${p.status === "building" ? "IN DEV" : p.status === "research" ? "PUBLISHED" : "SHIPPED"}</span><span class="hd">HD</span></div>
          <p>${esc(p.summary)}</p>
          ${p.bullets ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
        </div>
        <div class="m-side">
          <div><b>Stack: </b><span>${p.tech.map(esc).join(", ")}</span></div>
          <div><b>Genres: </b><span>${p.genre.map(esc).join(", ")}</span></div>
          <div><b>This project is: </b><span>${p.status === "building" ? "Actively in development, with roadmap episodes below" : p.status === "research" ? "Peer-reviewed and published" : "Shipped and working"}</span></div>
          <div><b>More like this: </b>${more.map((m) => `<button data-project="${m.id}" style="text-decoration:underline;color:#ddd">${esc(m.title)}</button>`).join(", ")}</div>
        </div>
        ${eps}
      </div>`);
  }

  function openCert(id) {
    const c = D.certificates.find((x) => x.id === id); if (!c) return;
    history.replaceState(null, "", "#/cert/" + id);
    const i = D.certificates.indexOf(c);
    const prev = D.certificates[(i - 1 + D.certificates.length) % D.certificates.length], next = D.certificates[(i + 1) % D.certificates.length];
    openModal(`
      <div class="m-hero cert"><img src="${c.thumb}" alt="${esc(c.title)} certificate issued by ${esc(c.org)}" /></div>
      <div class="m-body">
        <div>
          <h2 id="modalTitle" style="margin:12px 0 6px;font-size:26px">${esc(c.title)}</h2>
          <div class="m-meta"><span class="match">Verified</span><span>${esc(c.date)}</span><span class="rating">${esc(c.tag.toUpperCase())}</span></div>
          <p>${esc(c.note)}</p>
          <div class="m-actions"><a class="btn btn-play" href="${c.file}" target="_blank" rel="noopener">${svg("doc")}<span>Open original</span></a><button class="btn btn-ghost" data-share-cert="${c.id}">${svg("link")}<span>Share</span></button></div>
        </div>
        <div class="m-side">
          <div><b>Issued by: </b><span>${esc(c.org)}</span></div>
          <div><b>Recipient: </b><span>${esc(D.profile.name)}</span></div>
          <div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-small btn-info" data-cert="${prev.id}">‹ Prev</button><button class="btn btn-small btn-info" data-cert="${next.id}">Next ›</button></div>
        </div>
      </div>`);
  }

  /* ---------------- GitHub feed ---------------- */
  const LANG = { Rust: "#dea584", Python: "#3572A5", Kotlin: "#A97BFF", Java: "#b07219", JavaScript: "#f1e05a", TypeScript: "#3178c6", HTML: "#e34c26", CSS: "#563d7c", C: "#555", "C++": "#f34b7d", Shell: "#89e051", Go: "#00ADD8", Jupyter: "#DA5B0B" };
  function github() {
    $("#ghMore").href = GH;
    const row = $("#rowGithub");
    const moreTile = `<a class="gh-tile more" href="${GH}?tab=repositories" target="_blank" rel="noopener"><span style="font-size:13px;letter-spacing:.14em;font-weight:800">BROWSE ALL</span><h5>More on GitHub ›</h5><p style="color:#ffd7d9">github.com/${esc(D.profile.github)}</p></a>`;
    const fallback = () => { row.innerHTML = moreTile; };
    const cacheKey = "ns-gh-" + D.profile.github;
    const cached = (() => { try { const c = JSON.parse(store.get(cacheKey)); return c && Date.now() - c.t < 36e5 ? c.d : null; } catch (e) { return null; } })();
    const paint = (repos) => {
      if (!Array.isArray(repos) || !repos.length) return fallback();
      repos = repos.filter((r) => !r.fork).sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at))).slice(0, 10);
      row.innerHTML = repos.map((r) => `<a class="gh-tile" href="${r.html_url}" target="_blank" rel="noopener">
        <h5>${svg("github")} ${esc(r.name)}</h5><p>${esc(r.description || "No description yet — open the repo to explore.")}</p>
        <div class="gh-meta">${r.language ? `<span class="lang" style="--lc:${LANG[r.language] || "#888"}">${esc(r.language)}</span>` : ""}<span>★ ${r.stargazers_count}</span><span>⑂ ${r.forks_count}</span><span>Updated ${new Date(r.pushed_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span></div></a>`).join("") + moreTile;
    };
    if (cached) return paint(cached);
    fetch(`https://api.github.com/users/${encodeURIComponent(D.profile.github)}/repos?per_page=100&sort=pushed`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { store.set(cacheKey, JSON.stringify({ t: Date.now(), d })); paint(d); })
      .catch(fallback);
  }

  /* ---------------- command palette ---------------- */
  const goto = (id) => () => { closePalette(); const el = document.getElementById(id); el && el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
  function commands() {
    return [
      ...D.projects.map((p) => ({ i: "▶", t: p.title, s: p.kicker, run: () => { closePalette(); openProject(p.id); } })),
      ...D.certificates.map((c) => ({ i: "🏅", t: `${c.title} (${c.org.split(" · ")[0]})`, s: "certificate", run: () => { closePalette(); openCert(c.id); } })),
      { i: "📄", t: "Read the NetworkSentinel paper", s: "research", run: () => { closePalette(); window.open(D.research.url, "_blank", "noopener"); } },
      { i: "⬇", t: "Download résumé", s: "pdf", run: () => { closePalette(); const a = document.createElement("a"); a.href = D.profile.resume; a.download = ""; a.click(); } },
      { i: "✉", t: "Copy email address", s: D.profile.email, run: () => { closePalette(); copy(D.profile.email, "Email copied"); } },
      { i: "⌥", t: "Open GitHub", s: "github.com/" + D.profile.github, run: () => { closePalette(); window.open(GH, "_blank", "noopener"); } },
      { i: "🧪", t: "PCAP Lab: load sample capture", s: "lab", run: () => { goto("lab")(); setTimeout(() => $("#pcapSample").click(), 400); } },
      { i: "👤", t: "Switch profile", s: "who's viewing", run: () => { closePalette(); openGate(); } },
      ...["projects", "research", "certs", "skills", "education", "github", "lab", "contact"].map((id) => ({ i: "#", t: "Go to " + id, s: "section", run: goto(id) })),
      ...D.skills.map((s) => ({ i: "⚡", t: s.name, s: `skill · ${s.level}%`, run: goto("skills") }))
    ];
  }
  let cmdList = [], sel = 0;
  function openPalette() {
    const p = $("#palette"); p.hidden = false; document.body.classList.add("locked");
    const inp = $("#paletteInput"); inp.value = ""; $("#paletteTerm").hidden = true; filterPalette(); setTimeout(() => inp.focus(), 20);
  }
  function closePalette() {
    $("#palette").hidden = true;
    if ($("#gate").classList.contains("done") && $("#modal").hidden) document.body.classList.remove("locked");
  }
  function fuzzy(q, s) { q = q.toLowerCase(); s = s.toLowerCase(); if (s.includes(q)) return 2; let i = 0; for (const ch of s) if (ch === q[i]) i++; return i === q.length ? 1 : 0; }
  function filterPalette() {
    const q = $("#paletteInput").value.trim();
    const all = commands();
    cmdList = q ? all.map((c) => ({ c, r: fuzzy(q, c.t + " " + c.s) })).filter((x) => x.r).sort((a, b) => b.r - a.r).map((x) => x.c) : all.slice(0, 12);
    sel = 0; drawPalette();
  }
  function drawPalette() {
    $("#paletteList").innerHTML = cmdList.slice(0, 40).map((c, i) => `<li role="option" data-i="${i}" class="${i === sel ? "on" : ""}" aria-selected="${i === sel}"><i>${c.i}</i><span>${esc(c.t)}</span><small>${esc(c.s)}</small></li>`).join("") ||
      `<li><i>?</i><span>No matches. Press Enter to run it as a terminal command, or type <b>help</b>.</span></li>`;
    const on = $("#paletteList li.on"); on && on.scrollIntoView({ block: "nearest" });
  }
  const TERM = {
    help: () => "commands: <span class='g'>whoami</span>, <span class='g'>ls</span>, <span class='g'>cat research</span>, <span class='g'>skills</span>, <span class='g'>certs</span>, <span class='g'>contact</span>, <span class='g'>nmap nitin</span>, <span class='g'>sudo hire nitin</span>, <span class='g'>clear</span>",
    whoami: () => `${esc(D.profile.name)}\n${esc(D.profile.role)} · ${esc(D.profile.location)}`,
    ls: () => D.projects.map((p) => `drwxr-xr-x  ${p.status.padEnd(9)} ${esc(p.title)}`).join("\n"),
    "cat research": () => `${esc(D.research.title)}\n${esc(D.research.venue)}\n${esc(D.research.details)}\n${D.research.url}`,
    skills: () => D.skills.map((s) => `${s.name.padEnd(26)} ${"█".repeat(Math.round(s.level / 5))}${"░".repeat(20 - Math.round(s.level / 5))} ${s.level}%`).map(esc).join("\n"),
    certs: () => D.certificates.map((c) => `✓ ${c.title} — ${c.org} (${c.date})`).map(esc).join("\n"),
    contact: () => `email   ${esc(D.profile.email)}\ngithub  ${GH}`,
    "nmap nitin": () => `Starting Nmap scan against nitin.shukla …\nPORT     STATE  SERVICE\n22/tcp   open   rust-tooling\n53/udp   open   osint\n443/tcp  open   quic-audit  (RFC 9000 · A+)\n8080/tcp open   pentest\n\n<span class='g'>Host is up. 0 vulnerabilities, 100% hireable.</span>`,
    "sudo hire nitin": () => { setTimeout(() => { closePalette(); goto("contact")(); $("#contactForm [name=name]").focus(); }, 1400); return "[sudo] password for recruiter: ********\n<span class='g'>Access granted.</span> Redirecting to the contact form…"; }
  };
  function runTerm(q) {
    const t = $("#paletteTerm"); t.hidden = false;
    const key = q.trim().toLowerCase();
    if (key === "clear") { t.textContent = ""; t.hidden = true; return; }
    const f = TERM[key];
    t.innerHTML = `<span class='r'>nitin@portfolio</span>:~$ ${esc(q)}\n${f ? f() : `command not found: ${esc(q)}. Try <span class='g'>help</span>.`}`;
  }

  /* ---------------- misc ---------------- */
  function copy(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast(msg), () => { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast(msg); } catch (e) { toast(text); } ta.remove(); });
  }
  function share(hash, title) {
    const url = location.origin + location.pathname + hash;
    if (navigator.share) navigator.share({ title, url }).catch(() => {});
    else copy(url, "Link copied");
  }

  function wire() {
    document.addEventListener("click", (e) => {
      const pj = e.target.closest("[data-project]"); if (pj) { e.preventDefault(); return openProject(pj.dataset.project); }
      const ct = e.target.closest("[data-cert]"); if (ct) { e.preventDefault(); return openCert(ct.dataset.cert); }
      const sh = e.target.closest("[data-share]"); if (sh) return share("#/project/" + sh.dataset.share, "Nitin Shukla · project");
      const sc = e.target.closest("[data-share-cert]"); if (sc) return share("#/cert/" + sc.dataset.shareCert, "Nitin Shukla · certificate");
      if (e.target.closest("[data-close]")) { closeModal(); }
      if (e.target.closest("[data-pclose]")) closePalette();
    });
    $("#avatarBtn").addEventListener("click", openGate);
    $("#searchBtn").addEventListener("click", openPalette);
    $("#paletteInput").addEventListener("input", filterPalette);
    $("#paletteInput").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(cmdList.length - 1, sel + 1); drawPalette(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); drawPalette(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const q = e.target.value;
        if (TERM[q.trim().toLowerCase()] || q.trim().toLowerCase() === "clear" || !cmdList.length) runTerm(q);
        else cmdList[sel] && cmdList[sel].run();
      }
    });
    $("#paletteList").addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) cmdList[+li.dataset.i].run(); });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").hidden ? openPalette() : closePalette(); }
      else if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName) && $("#modal").hidden) { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") { if (!$("#palette").hidden) closePalette(); else if (!$("#modal").hidden) closeModal(); }
      else if (!$("#modal").hidden && /^Arrow(Left|Right)$/.test(e.key) && location.hash.startsWith("#/cert/")) {
        const id = location.hash.split("/")[2]; const i = D.certificates.findIndex((c) => c.id === id);
        const n = D.certificates[(i + (e.key === "ArrowRight" ? 1 : -1) + D.certificates.length) % D.certificates.length]; openCert(n.id);
      }
    });
    // focus trap for modal
    $("#modal").addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = $$("#modal a, #modal button").filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    // nav solid + active link
    const nav = $("#nav");
    const onScroll = () => nav.classList.toggle("solid", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    const links = $$(".nav-links a");
    const spy = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id));
    }), { rootMargin: "-45% 0px -50% 0px" });
    $$("#top, #rows > section").forEach((s) => spy.observe(s));

    // drag-to-scroll + wheel for rows on desktop
    $$(".row-track").forEach((tr) => {
      let down = false, sx = 0, sl = 0, moved = false;
      tr.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = tr.scrollLeft; });
      window.addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) { moved = true; tr.style.scrollSnapType = "none"; tr.scrollLeft = sl - dx; } });
      window.addEventListener("pointerup", () => { if (down) { down = false; tr.style.scrollSnapType = ""; } });
      tr.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    });

    // reveal + skill bars + quic audit
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in"); io.unobserve(en.target);
      if (en.target.classList.contains("research")) runQuicAudit();
    }), { threshold: 0.18 });
    $$(".reveal, .t10").forEach((el) => io.observe(el));

    // contact form → mailto
    $("#contactForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const sub = encodeURIComponent(`Portfolio enquiry from ${f.get("name")}`);
      const body = encodeURIComponent(`${f.get("msg")}\n\n— ${f.get("name")} (${f.get("email")})`);
      window.location.href = `mailto:${D.profile.email}?subject=${sub}&body=${body}`;
      toast("Opening your email app…");
    });
    $("#contactLinks").innerHTML = `
      <a href="mailto:${D.profile.email}">${svg("mail")} ${esc(D.profile.email)}</a>
      <button id="copyMail">${svg("copy")} Copy email</button>
      <a href="${GH}" target="_blank" rel="noopener">${svg("github")} GitHub</a>
      <a href="${D.profile.resume}" download>${svg("doc")} Résumé (PDF)</a>`;
    $("#copyMail").addEventListener("click", () => copy(D.profile.email, "Email copied"));

    // static links
    $("#resumeBtn").href = D.profile.resume;
    $("#footCv").href = D.profile.resume;
    $("#footGh").href = GH;
    const fm = $("#footMail"); fm.href = "mailto:" + D.profile.email; fm.textContent = D.profile.email;
    $("#yr").textContent = new Date().getFullYear();
  }

  function deepLink() {
    const m = location.hash.match(/^#\/(project|cert)\/([\w-]+)/);
    if (!m) return;
    m[1] === "project" ? openProject(m[2]) : openCert(m[2]);
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    buildGate(); renderRows(); wire(); github(); heroStats(); typeRoles(); packetCanvas();
    window.PcapLab && window.PcapLab.init();
    const saved = store.get("ns-profile");
    const deep = /^#\/(project|cert)\//.test(location.hash);
    const params = new URLSearchParams(location.search);
    if (saved || deep || params.has("skip")) { choose(saved || "recruiter"); }
    else { document.body.classList.add("locked"); if (reduced) { $(".gate-logo").style.display = "none"; } }
    deepLink();
    console.log("%cNITIN SHUKLA", "font:32px Impact;color:#e50914", "\nLooking under the hood? Press Ctrl+K and type 'help'.");
  });
})();
