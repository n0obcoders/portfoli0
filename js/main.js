/* ==========================================================================
   Main UI — profiles, billboard, rows, modals, GitHub feed, command palette
   ========================================================================== */
(function () {
  "use strict";

  const D = window.PORTFOLIO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    cloud: '<path d="M17.5 19H7a4 4 0 0 1-.7-7.9A5.5 5.5 0 0 1 17 10a4.5 4.5 0 0 1 .5 9z"/>',
    bug: '<path d="M8 8a4 4 0 1 1 8 0v1H8zM6 12h12M7 17h10M12 9v11M9 4 7 2M15 4l2-2M6 14l-3 1M18 14l3 1M7 20l-2 2M17 20l2 2"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/>'
  };
  const svg = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[name] || ""}</svg>`;

  /* ---------------- toast ---------------- */
  let toastTimer;
  window.toast = function (msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  };

  /* ---------------- profiles ---------------- */
  const PROFILES = {
    recruiter: {
      label: "Recruiter", sub: "Résumé first", color: "linear-gradient(135deg,#e50914,#7a0309)", icon: "briefcase",
      order: ["projects", "certs", "research", "skills", "education", "learning", "recon", "github", "lab", "contact"], hero: "me"
    },
    security: {
      label: "Security Lead", sub: "Show me the research", color: "linear-gradient(135deg,#16a34a,#064e1d)", icon: "shield",
      order: ["research", "projects", "certs", "lab", "skills", "learning", "recon", "education", "github", "contact"], hero: "networksentinel"
    },
    developer: {
      label: "Developer", sub: "Show me the code", color: "linear-gradient(135deg,#2563eb,#0b2566)", icon: "code",
      order: ["projects", "github", "lab", "learning", "skills", "research", "recon", "certs", "education", "contact"], hero: "n3core"
    },
    explorer: {
      label: "Explorer", sub: "Let me play", color: "linear-gradient(135deg,#eab308,#6b4a03)", icon: "compass",
      order: ["recon", "lab", "projects", "learning", "research", "certs", "skills", "github", "education", "contact"], hero: "packetra"
    }
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
    const rows = $("#rows");
    p.order.forEach((id) => { const el = rows.querySelector(`[data-row="${id}"]`); if (el) rows.appendChild(el); });
    setHero(p.hero);
    window.scrollTo({ top: 0 });
    if (window.ReconLab) {
      const section = document.getElementById("recon");
      if (section) window.ReconLab.init();
    }
  }

  function openGate() {
    const g = $("#gate"); g.classList.remove("done");
    const logo = $(".gate-logo", g); if (logo) logo.style.display = "none";
    const pick = $(".gate-pick", g);
    if (pick) { pick.style.animation = "fadeUp .55s ease forwards"; pick.style.animationDelay = "0s"; }
    document.body.classList.add("locked");
  }

  /* ---------------- hero ---------------- */
  function setHero(which) {
    const pr = D.profile;
    const project = D.projects.find((x) => x.id === which);
    if (!project) {
      $("#heroKicker").textContent = "CYBERSECURITY · ORIGINAL SERIES";
      $("#heroTitle").textContent = pr.short;
      $("#heroMatch").textContent = "99% Match";
      $("#heroDesc").textContent = pr.tagline;
      const play = $("#heroPlay");
      play.href = "#projects";
      play.removeAttribute("target");
      play.removeAttribute("rel");
      $("span", play).textContent = "Play";
      $("#heroInfo").onclick = () => openProject("networksentinel");
      return;
    }
    $("#heroKicker").textContent = project.status === "research" ? "PUBLISHED RESEARCH · JETIR 2026" : project.kicker.toUpperCase();
    $("#heroTitle").textContent = project.title;
    $("#heroMatch").textContent = project.match + "% Match";
    $("#heroDesc").textContent = project.summary;
    const play = $("#heroPlay");
    const link = project.links[0];
    play.href = link.href;
    $("span", play).textContent = project.status === "research" ? "Read paper" : "View project";
    if (/^https?:/.test(link.href)) { play.target = "_blank"; play.rel = "noopener"; }
    else { play.removeAttribute("target"); play.removeAttribute("rel"); }
    $("#heroInfo").onclick = () => openProject(project.id);
  }

  function typeRoles() {
    const el = $("#typed"), roles = D.profile.roles;
    if (!el) return;
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
    $("#heroStats").innerHTML = D.profile.stats.map((s) => `<div><b data-n="${s.n}">0</b><span>${esc(s.label)}</span></div>`).join("");
    $$("#heroStats b").forEach((b) => {
      const n = parseFloat(b.dataset.n), dec = String(n).includes(".") ? 2 : 0;
      if (reduced) { b.textContent = n.toFixed(dec); return; }
      const t0 = performance.now();
      (function step(t) { const k = Math.min(1, (t - t0) / 1600); b.textContent = (n * (1 - Math.pow(1 - k, 3))).toFixed(dec); if (k < 1) requestAnimationFrame(step); })(t0);
    });
  }

  function heroTerm() {
    const el = $("#heroTerm"); if (!el) return;
    const lines = [
      '<span class="cmd">$</span> whoami → security researcher',
      '> quic audit <span class="ok">A+</span> · 5/5 checks',
      '> writing: Sigma · ATT&amp;CK detections',
      '> availability: <span class="ok">open to work</span>'
    ];
    if (reduced) { el.innerHTML = lines.join("<br>"); return; }
    let i = 0;
    el.innerHTML = lines[0];
    setInterval(() => { i = (i + 1) % lines.length; el.style.opacity = "0"; setTimeout(() => { el.innerHTML = lines[i]; el.style.opacity = "1"; }, 180); }, 2900);
    el.style.transition = "opacity .18s";
  }

  /* ---------------- packet-flow canvas ---------------- */
  function packetCanvas() {
    const c = $("#packets"); if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let W, H, nodes = [], pkts = [], raf = 0;
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
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf); }).observe(c);
  }

  function gateCanvas() {
    const c = $("#gateCanvas"); if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W, H, nodes = [], raf = 0;
    function resize() {
      W = c.clientWidth; H = c.clientHeight; c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = Array.from({ length: Math.min(70, Math.round(W / 22)) }, () => ({
        x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: 1 + Math.random() * 2
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 145) { ctx.strokeStyle = `rgba(229,9,20,${(1 - d / 145) * .2})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = i % 11 === 0 ? "rgba(255,31,47,.85)" : "rgba(255,255,255,.4)";
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize(); window.addEventListener("resize", resize);
    if (reduced) { frame(); cancelAnimationFrame(raf); return; }
    new IntersectionObserver(([e]) => { if (e.isIntersecting) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf); }).observe(c);
  }

  /* ---------------- tiles ---------------- */
  function projectArt(p) {
    const ribbon = p.status === "research" ? '<span class="ribbon pub">PUBLISHED</span>' : '<span class="ribbon live">LIVE</span>';
    return `<span class="tile-art" style="background:radial-gradient(120% 120% at 0% 100%, ${p.art.a} 0%, ${p.art.b} 70%)">
      ${svg(p.art.icon, "glyph")}<span class="tkick"><span class="n-badge" style="font-size:16px">NS</span>${esc(p.kicker)}</span>${ribbon}<span class="tname">${esc(p.title)}</span></span>`;
  }

  function projectTile(p) {
    return `<button class="tile" data-project="${p.id}" aria-label="${esc(p.title)}: more info">
      ${projectArt(p)}
      <span class="tile-body" style="display:block">
        <span class="tile-actions"><span class="circ fill">${svg("play")}</span><span class="circ">${svg("plus")}</span><span class="circ">${svg("chev")}</span></span>
        <span class="tile-meta"><span class="match">${p.match}% Match</span><span class="rating">${esc(p.year)}</span><span>${p.status === "research" ? "Research" : "Shipped"}</span></span>
        <span class="tile-genre" style="display:block">${p.genre.map((g) => `<span>${esc(g)}</span>`).join("")}</span>
      </span></button>`;
  }

  function learningCard(l) {
    return `<article class="learning-card" style="--lc:${esc(l.color)}">
      <div class="learn-top"><span class="learn-icon">${svg(l.icon)}</span><span class="learn-stage">${esc(l.stage)}</span></div>
      <h4>${esc(l.title)}</h4>
      <p class="learn-source">${esc(l.source)}</p>
      <p class="learn-desc">${esc(l.desc)}</p>
      <div class="learn-tags">${l.tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      <div class="learn-bar"><i style="--w:${l.focus}%"></i></div>
      <div class="learn-bar-label"><span>SELF-TRACKED</span><span>${l.focus}%</span></div>
    </article>`;
  }

  function certTile(c) {
    return `<button class="tile" data-cert="${c.id}" aria-label="${esc(c.title)} certificate">
      <span class="tile-art"><img src="${c.thumb}" alt="${esc(c.title)}, ${esc(c.org)}" loading="lazy" /><span class="ribbon live">${esc(c.tag.toUpperCase())}</span></span>
      <span class="tile-body" style="display:block"><span class="tile-title" style="display:block">${esc(c.title)}</span><span class="tile-org" style="display:block">${esc(c.org)} · ${esc(c.date)}</span></span></button>`;
  }

  function renderRows() {
    const moreTile = `<a class="gh-tile more" href="${GH}" target="_blank" rel="noopener"><span style="font-size:13px;letter-spacing:.14em;font-weight:800">MORE TITLES</span><h5>See every project on GitHub ›</h5><p style="color:#ffd7d9">github.com/${esc(D.profile.github)}</p></a>`;
    $("#rowProjects").innerHTML = D.projects.map(projectTile).join("") + moreTile;
    $("#rowLearning").innerHTML = D.learning.map(learningCard).join("");
    $("#rowCerts").innerHTML = D.certificates.map(certTile).join("");
    $("#rowSkills").innerHTML = D.skills.map((s, i) => {
      const hue = [0, 355, 10, 20, 340, 350, 5, 15, 345, 0][i] == null ? 0 : [0, 355, 10, 20, 340, 350, 5, 15, 345, 0][i];
      return `<div class="t10" role="img" aria-label="#${i + 1} ${esc(s.name)}, ${s.level}%"><span class="num">${i + 1}</span><div class="card" style="--h:${hue}"><small>${esc(s.group)}</small><b>${esc(s.name)}</b><div><div class="bar"><i style="--w:${s.level}%"></i></div><small style="letter-spacing:0">${s.level}%</small></div></div></div>`;
    }).join("");
    $("#toolbox").innerHTML = D.toolbox.map((t) => `<span>${esc(t)}</span>`).join("");
    $("#eduList").innerHTML = D.education.map((e, i) => `<div class="edu-item"><span class="s">S${D.education.length - i}</span><div><b>${esc(e.title)}</b><div>${esc(e.org)}</div><div>${esc(e.date)} · <span class="score">${esc(e.score)}</span></div></div></div>`).join("");
    const pc = $("#projectCount"); if (pc) pc.textContent = D.projects.length + " titles";
    const cc = $("#certCount"); if (cc) cc.textContent = D.certificates.length + " credentials";
    renderResearch();
  }

  /* ---------------- research ---------------- */
  function renderResearch() {
    const r = D.research;
    const block = $("#researchBlock"); if (!block) return;
    const cite = `N. H. Shukla, "${r.title}," ${r.venue}, ${r.details.replace(/ · /g, ", ")}.`;
    block.innerHTML = `<div class="research reveal">
      <div>
        <div class="badge-row"><span class="chip gold">PEER-REVIEWED</span><span class="chip red">JETIR 2026</span><span class="chip">${esc(r.id)}</span></div>
        <h4>${esc(r.title)}</h4>
        <p class="venue">${esc(r.venue)}<br>${esc(r.details)}</p>
        <p class="abs">${esc(r.abstract)}</p>
        <div class="m-actions">
          <a class="btn btn-play" href="${esc(r.url)}" target="_blank" rel="noopener">${svg("doc")}<span>Read paper</span></a>
          <button class="btn btn-info" data-project="networksentinel">${svg("radar")}<span>About the project</span></button>
        </div>
        <div class="cite"><button id="copyCite">Copy citation</button>${esc(cite)}</div>
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
      const score = $("#score"); if (score) score.textContent = (i + 1) * 20;
      if (i === items.length - 1) { const grade = $("#grade"); if (grade) grade.textContent = "A+"; }
    }, reduced ? 0 : 400 + i * 450));
  }

  /* ---------------- modal ---------------- */
  let lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $("#modalContent").innerHTML = html;
    const m = $("#modal"); m.hidden = false; document.body.classList.add("locked");
    m.scrollTop = 0;
    setTimeout(() => { const x = $(".modal-x", m); if (x) x.focus(); }, 30);
  }
  function closeModal() {
    $("#modal").hidden = true;
    if ($("#gate").classList.contains("done")) document.body.classList.remove("locked");
    if (location.hash.startsWith("#/")) history.replaceState(null, "", location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function projectLink(link, i) {
    const external = /^https?:/.test(link.href);
    const href = external ? link.href : link.href;
    const attrs = external ? ' target="_blank" rel="noopener"' : " data-close";
    return `<a class="btn ${i === 0 ? "btn-play" : "btn-info"}" href="${esc(href)}"${attrs}>${svg(i === 0 ? "play" : "github")}<span>${esc(link.label)}</span></a>`;
  }

  function openProject(id) {
    const p = D.projects.find((x) => x.id === id); if (!p) return;
    history.replaceState(null, "", "#/project/" + id);
    const features = p.high ? `<div class="episodes"><h4>Capabilities <small>${p.high.length} highlights</small></h4>${p.high.map((e, i) => `<div class="ep"><span class="n">${i + 1}</span><div><b>${esc(e.t)}</b><p>${esc(e.d)}</p></div></div>`).join("")}</div>` : "";
    const bullets = p.bullets ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
    const more = D.projects.filter((x) => x.id !== id).slice(0, 3);
    const status = p.status === "research" ? "Peer-reviewed & published" : "Shipped and live";
    openModal(`
      <div class="m-hero" style="background:radial-gradient(120% 140% at 0% 100%, ${p.art.a}, ${p.art.b} 75%)">${svg(p.art.icon, "glyph")}<h2 id="modalTitle">${esc(p.title)}</h2></div>
      <div class="m-body">
        <div>
          <div class="m-actions">${p.links.map(projectLink).join("")}<button class="btn btn-ghost" data-share="${p.id}">${svg("link")}<span>Share</span></button></div>
          <div class="m-meta"><span class="match">${p.match}% Match</span><span>${esc(p.year)}</span><span class="rating">${p.status === "research" ? "PUBLISHED" : "SHIPPED"}</span><span class="hd">HD</span></div>
          <p>${esc(p.summary)}</p>
          ${features}
          ${bullets}
        </div>
        <div class="m-side">
          <div><b>Stack: </b><span>${p.tech.map(esc).join(", ")}</span></div>
          <div><b>Genres: </b><span>${p.genre.map(esc).join(", ")}</span></div>
          <div><b>Status: </b><span>${esc(status)}</span></div>
          <div><b>More like this: </b>${more.map((m) => `<button data-project="${m.id}" style="text-decoration:underline;color:#ddd">${esc(m.title)}</button>`).join(", ")}</div>
        </div>
      </div>`);
  }

  function openCert(id) {
    const c = D.certificates.find((x) => x.id === id); if (!c) return;
    history.replaceState(null, "", "#/cert/" + id);
    const i = D.certificates.indexOf(c);
    const prev = D.certificates[(i - 1 + D.certificates.length) % D.certificates.length];
    const next = D.certificates[(i + 1) % D.certificates.length];
    const original = c.file
      ? `<a class="btn btn-play" href="${esc(c.file)}" target="_blank" rel="noopener">${svg("doc")}<span>Open original</span></a>`
      : `<a class="btn btn-play" href="${esc(c.thumb)}" target="_blank" rel="noopener">${svg("award")}<span>View certificate</span></a>`;
    openModal(`
      <div class="m-hero cert"><img src="${c.thumb}" alt="${esc(c.title)} certificate issued by ${esc(c.org)}" /></div>
      <div class="m-body">
        <div>
          <h2 id="modalTitle" style="margin:12px 0 6px;font-size:26px">${esc(c.title)}</h2>
          <div class="m-meta"><span class="match">Verified</span><span>${esc(c.date)}</span><span class="rating">${esc(c.tag.toUpperCase())}</span></div>
          <p>${esc(c.note)}</p>
          <div class="m-actions">${original}<button class="btn btn-ghost" data-share-cert="${c.id}">${svg("link")}<span>Share</span></button></div>
        </div>
        <div class="m-side">
          <div><b>Issued by: </b><span>${esc(c.org)}</span></div>
          <div><b>Recipient: </b><span>${esc(D.profile.name)}</span></div>
          ${c.file ? "" : '<div><b>Note: </b><span>Original file not attached; the visual above is the certificate preview.</span></div>'}
          <div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-small btn-info" data-cert="${prev.id}">‹ Prev</button><button class="btn btn-small btn-info" data-cert="${next.id}">Next ›</button></div>
        </div>
      </div>`);
  }

  /* ---------------- GitHub feed ---------------- */
  const LANG = { Rust: "#dea584", Python: "#3572A5", Kotlin: "#A97BFF", Java: "#b07219", JavaScript: "#f1e05a", TypeScript: "#3178c6", HTML: "#e34c26", CSS: "#563d7c", C: "#555", "C++": "#f34b7d", Shell: "#89e051", Go: "#00ADD8", Jupyter: "#DA5B0B", QML: "#44a51c" };
  function github() {
    const more = $("#ghMore"); if (more) more.href = GH;
    const row = $("#rowGithub"); if (!row) return;
    const moreTile = `<a class="gh-tile more" href="${GH}?tab=repositories" target="_blank" rel="noopener"><span style="font-size:13px;letter-spacing:.14em;font-weight:800">BROWSE ALL</span><h5>More on GitHub ›</h5><p style="color:#ffd7d9">github.com/${esc(D.profile.github)}</p></a>`;
    const fallback = () => { row.innerHTML = moreTile; };
    const cacheKey = "ns-gh-" + D.profile.github;
    const cached = (() => { try { const c = JSON.parse(store.get(cacheKey)); return c && Date.now() - c.t < 36e5 ? c.d : null; } catch (e) { return null; } })();
    const paint = (repos) => {
      if (!Array.isArray(repos) || !repos.length) return fallback();
      repos = repos.filter((r) => !r.fork).sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at))).slice(0, 10);
      row.innerHTML = repos.map((r) => `<a class="gh-tile" href="${esc(r.html_url)}" target="_blank" rel="noopener">
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
  const goto = (id) => () => { closePalette(); const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }); };
  function commands() {
    return [
      ...D.projects.map((p) => ({ i: "▶", t: p.title, s: p.kicker, run: () => { closePalette(); openProject(p.id); } })),
      ...D.certificates.map((c) => ({ i: "🏅", t: `${c.title} (${c.org.split(" · ")[0]})`, s: "certificate", run: () => { closePalette(); openCert(c.id); } })),
      ...D.learning.map((l) => ({ i: "◈", t: l.title, s: "learning · " + l.stage, run: goto("learning") })),
      { i: "📡", t: "Run live recon on this portfolio", s: "passive OSINT console", run: () => { closePalette(); if (window.ReconLab) window.ReconLab.scan("n0obcoders.github.io/portfoli0"); } },
      { i: "🛰", t: "Open the recon console", s: "DNS · CT · headers · tech", run: goto("recon") },
      { i: "📄", t: "Read the NetworkSentinel paper", s: "research", run: () => { closePalette(); window.open(D.research.url, "_blank", "noopener"); } },
      { i: "⬇", t: "Download résumé", s: "pdf", run: () => { closePalette(); const a = document.createElement("a"); a.href = D.profile.resume; a.download = ""; a.click(); } },
      { i: "✉", t: "Copy email address", s: D.profile.email, run: () => { closePalette(); copy(D.profile.email, "Email copied"); } },
      { i: "⌥", t: "Open GitHub", s: "github.com/" + D.profile.github, run: () => { closePalette(); window.open(GH, "_blank", "noopener"); } },
      { i: "🧪", t: "PCAP Lab: load sample capture", s: "lab", run: () => { goto("lab")(); setTimeout(() => { const b = $("#pcapSample"); if (b) b.click(); }, 400); } },
      { i: "👤", t: "Switch profile", s: "who's viewing", run: () => { closePalette(); openGate(); } },
      ...["projects", "recon", "research", "learning", "certs", "skills", "education", "github", "lab", "contact"].map((id) => ({ i: "#", t: "Go to " + id, s: "section", run: goto(id) })),
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
    const on = $("#paletteList li.on"); if (on) on.scrollIntoView({ block: "nearest" });
  }
  const TERM = {
    help: () => "commands: <span class='g'>whoami</span>, <span class='g'>ls</span>, <span class='g'>cat research</span>, <span class='g'>skills</span>, <span class='g'>certs</span>, <span class='g'>learning</span>, <span class='g'>recon</span>, <span class='g'>scan example.com</span>, <span class='g'>contact</span>, <span class='g'>nmap nitin</span>, <span class='g'>sudo hire nitin</span>, <span class='g'>clear</span>",
    whoami: () => `${esc(D.profile.name)}\n${esc(D.profile.role)} · ${esc(D.profile.location)}`,
    ls: () => D.projects.map((p) => `drwxr-xr-x  ${p.status.padEnd(9)} ${esc(p.title)}`).join("\n"),
    "cat research": () => `${esc(D.research.title)}\n${esc(D.research.venue)}\n${esc(D.research.details)}\n${D.research.url}`,
    skills: () => D.skills.map((s) => `${s.name.padEnd(26)} ${"█".repeat(Math.round(s.level / 5))}${"░".repeat(20 - Math.round(s.level / 5))} ${s.level}%`).map(esc).join("\n"),
    certs: () => D.certificates.map((c) => `✓ ${c.title} — ${c.org} (${c.date})`).map(esc).join("\n"),
    learning: () => D.learning.map((l) => `◈ ${l.title} — ${l.stage} · ${l.focus}%`).map(esc).join("\n"),
    recon: () => { setTimeout(() => { closePalette(); if (window.ReconLab) window.ReconLab.focus(); }, 700); return "Opening the live recon console…\n<span class='g'>Passive only.</span> DNS, RDAP, Certificate Transparency, headers and tech fingerprints."; },
    contact: () => `email   ${esc(D.profile.email)}\ngithub  ${GH}`,
    "nmap nitin": () => `Starting Nmap scan against nitin.shukla …\nPORT     STATE  SERVICE\n22/tcp   open   rust-tooling\n53/udp   open   osint\n443/tcp  open   quic-audit  (RFC 9000 · A+)\n8080/tcp open   pentest\n\n<span class='g'>Host is up. 0 vulnerabilities, 100% hireable.</span>`,
    "sudo hire nitin": () => { setTimeout(() => { closePalette(); goto("contact")(); const f = $("#contactForm [name=name]"); if (f) f.focus(); }, 1400); return "[sudo] password for recruiter: ********\n<span class='g'>Access granted.</span> Redirecting to the contact form…"; }
  };
  function runTerm(q) {
    const t = $("#paletteTerm"); t.hidden = false;
    const key = q.trim().toLowerCase();
    if (key === "clear") { t.textContent = ""; t.hidden = true; return; }
    if (/^scan\s+/i.test(key)) {
      const target = q.trim().replace(/^scan\s+/i, "");
      t.innerHTML = `<span class='r'>nitin@portfolio</span>:~$ ${esc(q)}\n<span class='g'>Starting passive scan against ${esc(target)}…</span>`;
      setTimeout(() => { closePalette(); const el = document.getElementById("recon"); if (el) el.scrollIntoView({ behavior: "smooth" }); if (window.ReconLab) window.ReconLab.scan(target); }, 500);
      return;
    }
    const f = TERM[key];
    t.innerHTML = `<span class='r'>nitin@portfolio</span>:~$ ${esc(q)}\n${f ? f() : `command not found: ${esc(q)}. Try <span class='g'>help</span>.`}`;
  }

  /* ---------------- misc ---------------- */
  function copy(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .then(() => toast(msg), () => {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); toast(msg); } catch (e) { toast(text); }
        ta.remove();
      });
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
      if (e.target.closest("[data-close]")) closeModal();
      if (e.target.closest("[data-pclose]")) closePalette();
    });

    const avatar = $("#avatarBtn"); if (avatar) avatar.addEventListener("click", openGate);
    const search = $("#searchBtn"); if (search) search.addEventListener("click", openPalette);
    const pin = $("#paletteInput"); if (pin) pin.addEventListener("input", filterPalette);
    if (pin) pin.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(cmdList.length - 1, sel + 1); drawPalette(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); drawPalette(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const q = e.target.value;
        if (TERM[q.trim().toLowerCase()] || /^scan\s+/i.test(q.trim()) || q.trim().toLowerCase() === "clear" || !cmdList.length) runTerm(q);
        else if (cmdList[sel]) cmdList[sel].run();
      }
    });
    const plist = $("#paletteList"); if (plist) plist.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li && cmdList[+li.dataset.i]) cmdList[+li.dataset.i].run(); });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").hidden ? openPalette() : closePalette(); }
      else if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName) && $("#modal").hidden && $("#palette").hidden) { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") { if (!$("#palette").hidden) closePalette(); else if (!$("#modal").hidden) closeModal(); }
      else if (!$("#modal").hidden && /^Arrow(Left|Right)$/.test(e.key) && location.hash.startsWith("#/cert/")) {
        const id = location.hash.split("/")[2]; const i = D.certificates.findIndex((c) => c.id === id);
        const n = D.certificates[(i + (e.key === "ArrowRight" ? 1 : -1) + D.certificates.length) % D.certificates.length];
        if (n) openCert(n.id);
      }
    });

    $("#modal").addEventListener("keydown", (e) => {
      if (e.key !== "Tab") return;
      const f = $$("#modal a, #modal button").filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    // mobile menu
    const menuBtn = $("#menuBtn"), mobile = $("#mobileMenu");
    const setMenu = (open) => {
      if (!mobile || !menuBtn) return;
      mobile.hidden = !open;
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    if (menuBtn && mobile) {
      menuBtn.addEventListener("click", (e) => { e.stopPropagation(); setMenu(mobile.hidden); });
      $$("#mobileMenu a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
      document.addEventListener("click", (e) => {
        if (!mobile.hidden && !e.target.closest("#mobileMenu") && !e.target.closest("#menuBtn")) setMenu(false);
      });
    }

    // nav solid + scroll progress + active link
    const nav = $("#nav"), progress = $("#scrollProgress");
    const onScroll = () => {
      nav.classList.toggle("solid", window.scrollY > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (progress) progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
    };
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

    // reveal + skill bars + QUIC audit
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in"); io.unobserve(en.target);
      if (en.target.classList.contains("research")) runQuicAudit();
    }), { threshold: 0.18 });
    $$(".reveal, .learning-card, .t10").forEach((el) => io.observe(el));

    // contact form → mailto
    const form = $("#contactForm");
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const sub = encodeURIComponent(`Portfolio enquiry from ${f.get("name")}`);
      const body = encodeURIComponent(`${f.get("msg")}\n\n— ${f.get("name")} (${f.get("email")})`);
      window.location.href = `mailto:${D.profile.email}?subject=${sub}&body=${body}`;
      toast("Opening your email app…");
    });

    const contactLinks = $("#contactLinks");
    if (contactLinks) {
      contactLinks.innerHTML = `
        <a href="mailto:${D.profile.email}">${svg("mail")} ${esc(D.profile.email)}</a>
        <button id="copyMail">${svg("copy")} Copy email</button>
        <a href="${GH}" target="_blank" rel="noopener">${svg("github")} GitHub</a>
        <a href="${D.profile.resume}" download>${svg("doc")} Résumé (PDF)</a>`;
      const cm = $("#copyMail"); if (cm) cm.addEventListener("click", () => copy(D.profile.email, "Email copied"));
    }

    // static links
    const resumeBtn = $("#resumeBtn"); if (resumeBtn) resumeBtn.href = D.profile.resume;
    const footCv = $("#footCv"); if (footCv) footCv.href = D.profile.resume;
    const footGh = $("#footGh"); if (footGh) footGh.href = GH;
    const fm = $("#footMail"); if (fm) { fm.href = "mailto:" + D.profile.email; fm.textContent = D.profile.email; }
    const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();
  }

  function deepLink() {
    const m = location.hash.match(/^#\/(project|cert)\/([\w-]+)/);
    if (!m) return;
    m[1] === "project" ? openProject(m[2]) : openCert(m[2]);
  }

  /* ---------------- boot ---------------- */
  document.addEventListener("DOMContentLoaded", () => {
    buildGate(); renderRows(); wire(); github(); heroStats(); typeRoles(); heroTerm(); packetCanvas(); gateCanvas();
    if (window.PcapLab) window.PcapLab.init();
    if (window.ReconLab) window.ReconLab.init();
    const saved = store.get("ns-profile");
    const deep = /^#\/(project|cert)\//.test(location.hash);
    const params = new URLSearchParams(location.search);
    if (saved || deep || params.has("skip")) { choose(saved || "recruiter"); }
    else { document.body.classList.add("locked"); if (reduced) { const logo = $(".gate-logo"); if (logo) logo.style.display = "none"; } }
    deepLink();
    console.log("%cNITIN SHUKLA", "font:32px Impact;color:#e50914", "\nLooking under the hood? Press Ctrl+K and type 'help'.");
  });
})();
