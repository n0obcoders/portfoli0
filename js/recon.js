/* ==========================================================================
   ReconLab — passive OSINT console
   DNS · RDAP · Certificate Transparency · HTTP headers · tech fingerprinting
   No build step, no dependencies. All queries are public and read-only.
   ========================================================================== */
(function () {
  "use strict";

  const CACHE_TTL = 10 * 60 * 1000;
  const CACHE_KEY = "ns.recon.cache.v1";
  const HISTORY_KEY = "ns.recon.history.v1";
  const MAX_HISTORY = 8;
  const VERSION = "2.0";

  const COMMON_HOSTS = [
    "www", "mail", "api", "dev", "staging", "test", "blog", "shop", "admin",
    "vpn", "git", "cdn", "static", "assets", "docs", "status", "portal",
    "app", "beta", "support"
  ];

  // Hosted suffixes where the registrable domain is three labels deep. Kept
  // intentionally small: it only matters for RDAP lookups, not for DNS.
  const MULTI_LEVEL_SUFFIXES = [
    "github.io", "gitlab.io", "bitbucket.io", "pages.dev", "workers.dev",
    "vercel.app", "netlify.app", "web.app", "firebaseapp.com", "herokuapp.com",
    "azurewebsites.net", "cloudfront.net", "s3.amazonaws.com", "blogspot.com",
    "wordpress.com", "myshopify.com", "onrender.com", "fly.dev", "surge.sh",
    "glitch.me", "repl.co", "neocities.org", "readthedocs.io", "cargo.site"
  ];
  const CC_SECOND_LEVEL = [
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au",
    "co.nz", "co.in", "net.in", "org.in", "com.br", "com.cn", "com.mx",
    "co.jp", "co.kr", "co.za", "com.sg", "com.tr", "com.ar", "com.pl",
    "com.ua", "co.il", "com.hk", "com.tw"
  ];

  const INTERESTING_HOSTS = new Set([
    "admin", "api", "app", "beta", "dashboard", "dev", "develop", "git",
    "gitlab", "grafana", "internal", "jenkins", "jira", "kibana", "login",
    "mail", "old", "panel", "portal", "preprod", "preview", "qa", "sso",
    "staging", "status", "test", "uat", "vpn", "webmail"
  ]);

  const TAKEOVER_SERVICES = [
    { re: /\.github\.io$/i, service: "GitHub Pages" },
    { re: /\.herokuapp\.com$/i, service: "Heroku" },
    { re: /\.netlify\.app$/i, service: "Netlify" },
    { re: /\.vercel\.app$/i, service: "Vercel" },
    { re: /\.pages\.dev$/i, service: "Cloudflare Pages" },
    { re: /\.surge\.sh$/i, service: "Surge" },
    { re: /\.azurewebsites\.net$/i, service: "Azure App Service" },
    { re: /\.cloudfront\.net$/i, service: "Amazon CloudFront" },
    { re: /\.s3[.-][a-z0-9-]*\.amazonaws\.com$/i, service: "Amazon S3" },
    { re: /\.s3\.amazonaws\.com$/i, service: "Amazon S3" },
    { re: /\.elasticbeanstalk\.com$/i, service: "AWS Elastic Beanstalk" },
    { re: /\.firebaseapp\.com$/i, service: "Firebase" },
    { re: /\.web\.app$/i, service: "Firebase Hosting" },
    { re: /\.onrender\.com$/i, service: "Render" },
    { re: /\.fly\.dev$/i, service: "Fly.io" },
    { re: /\.wordpress\.com$/i, service: "WordPress.com" },
    { re: /\.myshopify\.com$/i, service: "Shopify" },
    { re: /\.readthedocs\.io$/i, service: "Read the Docs" },
    { re: /\.cargo\.site$/i, service: "GitHub Pages" }
  ];

  const state = {
    els: null,
    scanning: false,
    current: null,
    cache: loadJSON(CACHE_KEY, {}),
    history: loadJSON(HISTORY_KEY, []),
    timer: null,
    started: 0,
    progress: 0,
    logCount: 0
  };

  /* ============================== utilities ============================== */

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function safeHttp(value) {
    try {
      const u = new URL(value);
      return /^https?:$/.test(u.protocol) ? u.href : "#";
    } catch (e) {
      return "#";
    }
  }

  function clip(value, max) {
    const s = String(value == null ? "" : value);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  function shortError(error) {
    const msg = String((error && error.message) || error || "unknown error");
    return clip(msg.replace(/\s+/g, " "), 120);
  }

  function pct(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!then) return "";
    const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (sec < 60) return sec + "s ago";
    if (sec < 3600) return Math.round(sec / 60) + "m ago";
    if (sec < 86400) return Math.round(sec / 3600) + "h ago";
    return Math.round(sec / 86400) + "d ago";
  }

  function daysBetween(a, b) {
    const one = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / one));
  }

  function ageLabel(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const days = daysBetween(d, new Date());
    if (days < 1) return "today";
    if (days < 60) return days + " days";
    if (days < 730) return (days / 30.44).toFixed(1).replace(/\.0$/, "") + " months";
    return (days / 365.25).toFixed(1).replace(/\.0$/, "") + " years";
  }

  function dateLabel(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function untilLabel(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
    if (days < 0) return "expired";
    if (days < 1) return "today";
    if (days < 60) return "in " + days + " days";
    if (days < 730) return "in " + (days / 30.44).toFixed(1).replace(/\.0$/, "") + " months";
    return "in " + (days / 365.25).toFixed(1).replace(/\.0$/, "") + " years";
  }

  function durationLabel(ms) {
    if (!ms && ms !== 0) return "—";
    return ms < 1000 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(1) + " s";
  }

  function dedupe(list) {
    return Array.from(new Set(list.filter(Boolean)));
  }

  function txtValue(data) {
    let s = String(data == null ? "" : data);
    s = s.replace(/"\s+"/g, "");
    if (s.charAt(0) === '"') s = s.slice(1);
    if (s.charAt(s.length - 1) === '"') s = s.slice(0, -1);
    return s.replace(/\\(["\\])/g, "$1").trim();
  }

  function notify(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(notify._timer);
    notify._timer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  }

  async function request(url, options, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeout || 15000);
    try {
      const res = await fetch(url, Object.assign({ signal: controller.signal, credentials: "omit", cache: "no-store" }, options || {}));
      return res;
    } catch (error) {
      if (error && error.name === "AbortError") throw new Error("request timed out");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getJSON(url, timeout) {
    const res = await request(url, { headers: { accept: "application/json" } }, timeout || 12000);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function getText(url, headers, timeout) {
    const res = await request(url, { headers: headers || {} }, timeout || 15000);
    const text = await res.text();
    if (!res.ok && !(res.status === 404 && text)) throw new Error("HTTP " + res.status);
    return { ok: res.ok, status: res.status, text: text, headers: res.headers };
  }

  /* ============================ target parsing =========================== */

  function ipv4Number(host) {
    const parts = host.split(".");
    if (parts.length !== 4) return null;
    let n = 0;
    for (let i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return null;
      const v = Number(parts[i]);
      if (v < 0 || v > 255) return null;
      n = (n * 256) + v;
    }
    return n >>> 0;
  }

  function isPublicIPv4(host) {
    const n = ipv4Number(host);
    if (n == null) return false;
    const blocked = [
      [0, 0, 0, 0, 8], [10, 0, 0, 0, 8], [100, 64, 0, 0, 10], [127, 0, 0, 0, 8],
      [169, 254, 0, 0, 16], [172, 16, 0, 0, 12], [192, 0, 0, 0, 24],
      [192, 0, 2, 0, 24], [192, 88, 99, 0, 24], [192, 168, 0, 0, 16],
      [198, 18, 0, 0, 15], [198, 51, 100, 0, 24], [203, 0, 113, 0, 24],
      [224, 0, 0, 0, 4], [240, 0, 0, 0, 4]
    ].map(function (b) {
      return { base: ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0, bits: b[4] };
    });
    return !blocked.some(function (b) {
      const mask = b.bits === 0 ? 0 : (0xFFFFFFFF << (32 - b.bits)) >>> 0;
      return (n & mask) === (b.base & mask);
    });
  }

  function isPublicIPv6(host) {
    const h = host.toLowerCase();
    if (h === "::" || h === "::1") return false;
    if (/^f[cd][0-9a-f]{2}:/.test(h)) return false;
    if (/^fe[89ab][0-9a-f]:/.test(h)) return false;
    if (/^ff[0-9a-f]{2}:/.test(h)) return false;
    if (/^2001:db8:/.test(h)) return false;
    if (/^::ffff:/.test(h)) {
      const tail = h.split(":").pop();
      return /^\d+\.\d+\.\d+\.\d+$/.test(tail) ? isPublicIPv4(tail) : false;
    }
    return true;
  }

  function normalizeTarget(raw) {
    let value = String(raw == null ? "" : raw).trim();
    if (!value) throw new Error("Enter a domain or URL to scan.");
    if (value.length > 320) throw new Error("That target is too long. Paste a single public domain.");
    value = value.replace(/\s+/g, "");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = "https://" + value;

    let parsed;
    try { parsed = new URL(value); } catch (e) { throw new Error("That does not look like a valid URL or domain."); }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("Only HTTP and HTTPS targets are supported.");
    if (parsed.username || parsed.password) throw new Error("Remove the credentials from the URL and try again.");
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      throw new Error("Only standard web ports (80/443) are in scope.");
    }

    let host = parsed.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
    if (!host) throw new Error("That URL has no hostname.");

    if (host === "localhost" || /(^|\.)(localhost|local|internal|lan|home|arpa|test|invalid|example|onion)$/i.test(host)) {
      throw new Error("Local, private and reserved hosts are out of scope.");
    }

    let path = parsed.pathname || "/";
    if (path.charAt(0) !== "/") path = "/" + path;
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    if (path.length > 180) throw new Error("That path is too long. Scan the site root instead.");
    // URL() already resolves dot segments, but reject encoded separators so a
    // path cannot be used to smuggle a different origin into the reader call.
    if (/%2e|%2f|%5c/i.test(path)) throw new Error("Encoded path separators are not supported.");

    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(":") !== -1) {
      const publicV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPublicIPv4(host);
      const publicV6 = host.indexOf(":") !== -1 && isPublicIPv6(host);
      if (!publicV4 && !publicV6) throw new Error("Private, loopback and reserved IP addresses are out of scope.");
      const origin = "https://" + (host.indexOf(":") !== -1 ? "[" + host + "]" : host);
      return {
        input: raw,
        host: host,
        domain: host,
        registrable: host,
        isIP: true,
        path: path,
        origin: origin,
        key: host + (path === "/" ? "" : path),
        url: origin + path
      };
    }

    if (!/^(?=.{4,253}$)(?!-)[a-z0-9-]{1,63}(?:\.(?!-)[a-z0-9-]{1,63})+$/i.test(host)) {
      throw new Error("Enter a valid public domain, like example.com.");
    }
    if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(host.split(".").pop())) throw new Error("That top-level domain is not valid.");
    if (host.split(".").length < 2) throw new Error("Use a full domain name, like example.com.");

    const origin = "https://" + host;
    return {
      input: raw,
      host: host,
      domain: host,
      registrable: registrableDomain(host),
      isIP: false,
      path: path,
      origin: origin,
      key: host + (path === "/" ? "" : path),
      url: origin + path
    };
  }

  function registrableDomain(host) {
    const h = String(host || "").toLowerCase().replace(/\.$/, "");
    for (let i = 0; i < MULTI_LEVEL_SUFFIXES.length; i++) {
      const suffix = MULTI_LEVEL_SUFFIXES[i];
      if (h === suffix || h.endsWith("." + suffix)) return suffix;
    }
    const labels = h.split(".");
    if (labels.length >= 3 && CC_SECOND_LEVEL.indexOf(labels.slice(-2).join(".")) !== -1) {
      return labels.slice(-3).join(".");
    }
    return labels.slice(-2).join(".");
  }

  /* =============================== caching =============================== */

  function cacheGet(host) {
    const entry = state.cache[host];
    if (!entry || !entry.at || !entry.result) return null;
    if (Date.now() - entry.at > CACHE_TTL) {
      delete state.cache[host];
      saveJSON(CACHE_KEY, state.cache);
      return null;
    }
    return entry;
  }

  function cacheSet(host, result) {
    state.cache[host] = { at: Date.now(), result: result };
    const keys = Object.keys(state.cache);
    if (keys.length > 30) {
      keys.sort(function (a, b) { return (state.cache[a].at || 0) - (state.cache[b].at || 0); });
      keys.slice(0, keys.length - 30).forEach(function (k) { delete state.cache[k]; });
    }
    saveJSON(CACHE_KEY, state.cache);
  }

  function cacheClear() {
    state.cache = {};
    try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
    notify("Recon cache cleared.");
  }

  /* ============================== DNS layer ============================== */

  const DNS_TYPES = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA", 257: "CAA" };

  async function dnsQuery(name, type, wantDnssec) {
    const url = "https://dns.google/resolve?name=" + encodeURIComponent(name) + "&type=" + encodeURIComponent(type) + (wantDnssec ? "&do=1" : "");
    const data = await getJSON(url, 9000);
    const answers = (data.Answer || []).map(function (a) {
      return {
        name: String(a.name || "").replace(/\.$/, "").toLowerCase(),
        type: DNS_TYPES[a.type] || String(a.type),
        ttl: a.TTL,
        data: a.data
      };
    });
    return {
      status: data.Status,
      ad: !!data.AD,
      answers: answers,
      authority: data.Authority || []
    };
  }

  function valuesFor(record, type) {
    return record && record.answers
      ? record.answers.filter(function (a) { return a.type === type; }).map(function (a) { return a.data; })
      : [];
  }

  function detectDnsProvider(nameservers) {
    const ns = nameservers.join(" ").toLowerCase();
    const map = [
      ["cloudflare", "Cloudflare"], ["awsdns", "Amazon Route 53"], ["azure-dns", "Azure DNS"],
      ["googledomains", "Google Cloud DNS"], ["googledns", "Google Cloud DNS"], ["domaincontrol", "GoDaddy"],
      ["registrar-servers", "Namecheap"], ["namecheaphosting", "Namecheap"], ["digitalocean", "DigitalOcean"],
      ["nsone.net", "NS1"], ["dnsimple", "DNSimple"], ["gandi.net", "Gandi"], ["ovh.net", "OVHcloud"],
      ["hetzner", "Hetzner"], ["linode", "Akamai / Linode"], ["cloudns", "ClouDNS"], ["dnspod", "DNSPod"],
      ["yandex", "Yandex"], ["he.net", "Hurricane Electric"], ["1984", "1984 Hosting"], ["hostinger", "Hostinger"],
      ["porkbun", "Porkbun"], ["dynadot", "Dynadot"], ["name.com", "Name.com"], ["dnsmadeeasy", "DNS Made Easy"],
      ["ultradns", "UltraDNS"], ["akam", "Akamai"], ["ns1", "NS1"]
    ];
    for (let i = 0; i < map.length; i++) if (ns.indexOf(map[i][0]) !== -1) return map[i][1];
    return nameservers.length ? "Custom / registrar DNS" : "Unknown";
  }

  function detectMailProvider(mx) {
    const raw = mx.map(function (m) { return m.host; }).join(" ").toLowerCase();
    const map = [
      ["google.com", "Google Workspace"], ["googlemail", "Google Workspace"],
      ["outlook.com", "Microsoft 365"], ["protection.outlook", "Microsoft 365"], ["microsoft", "Microsoft 365"],
      ["zoho", "Zoho Mail"], ["protonmail", "Proton Mail"], ["proton.me", "Proton Mail"],
      ["icloud", "iCloud Mail"], ["mailgun", "Mailgun"], ["mimecast", "Mimecast"],
      ["proofpoint", "Proofpoint"], ["barracuda", "Barracuda"], ["amazonses", "Amazon SES"],
      ["fastmail", "Fastmail"], ["secureserver", "GoDaddy Email"], ["hostinger", "Hostinger Email"],
      ["titan.email", "Titan Email"], ["privateemail", "Namecheap Private Email"], ["gandi", "Gandi Mail"],
      ["messagelabs", "Symantec Email"], ["trendmicro", "Trend Micro"], ["sophos", "Sophos"],
      ["qq.com", "Tencent Mail"], ["mail.ru", "Mail.ru"], ["yandex", "Yandex Mail"], ["mailbox.org", "Mailbox.org"]
    ];
    for (let i = 0; i < map.length; i++) if (raw.indexOf(map[i][0]) !== -1) return map[i][1];
    return mx.length ? "Custom / self-hosted" : "No MX records";
  }

  function parseSpf(txt) {
    const raw = txt.find(function (t) { return /^v=spf1\b/i.test(t); });
    if (!raw) return { found: false, raw: "", all: "", lookups: 0, valid: false };
    const terms = raw.split(/\s+/).slice(1);
    let all = "";
    let lookups = 0;
    terms.forEach(function (t) {
      if (/^[+\-~?]?all$/i.test(t)) all = t;
      if (/^[+\-~?]?(include|a|mx|ptr|exists|redirect)(:|\/|$)/i.test(t)) lookups++;
    });
    const hasAll = !!all;
    return {
      found: true,
      raw: raw,
      all: all || "(no all mechanism)",
      lookups: lookups,
      valid: terms.length > 0,
      weak: !hasAll || /^[+?]?all$/i.test(all)
    };
  }

  function parseDmarc(txt) {
    const raw = txt.find(function (t) { return /^v=DMARC1\b/i.test(t); });
    if (!raw) return { found: false, raw: "", policy: "", pct: "", rua: "", adkim: "", aspf: "" };
    const get = function (key) {
      const m = raw.match(new RegExp("(?:^|;)\\s*" + key + "\\s*=\\s*([^;]+)", "i"));
      return m ? m[1].trim() : "";
    };
    return {
      found: true,
      raw: raw,
      policy: get("p").toLowerCase(),
      subdomainPolicy: get("sp").toLowerCase(),
      pct: get("pct"),
      rua: get("rua"),
      ruf: get("ruf"),
      adkim: get("adkim"),
      aspf: get("aspf")
    };
  }

  async function collectDns(target) {
    if (target.isIP) {
      return {
        isIP: true, a: [target.host], aaaa: [], ns: [], mx: [], txt: [], caa: [], soa: [],
        spf: { found: false, raw: "", all: "", lookups: 0 }, dmarc: { found: false }, dkim: { found: false, selectors: [] },
        dnssec: false, dnsProvider: "—", mailProvider: "—", mtaSts: false, bimi: false, caaPresent: false,
        note: "IP target — DNS and registration records are not applicable."
      };
    }

    const domain = target.domain;
    const nsName = target.registrable && target.registrable !== domain ? target.registrable : domain;
    const core = await Promise.all([
      dnsQuery(domain, "A", true),
      dnsQuery(domain, "AAAA"),
      dnsQuery(nsName, "NS"),
      dnsQuery(domain, "MX"),
      dnsQuery(domain, "TXT"),
      dnsQuery(domain, "CAA"),
      dnsQuery(nsName, "SOA")
    ]);

    const a = valuesFor(core[0], "A");
    const aaaa = valuesFor(core[1], "AAAA");
    const ns = valuesFor(core[2], "NS").map(function (v) { return v.replace(/\.$/, "").toLowerCase(); });
    const mx = valuesFor(core[3], "MX").map(function (v) {
      const m = String(v).match(/^(\d+)\s+(.+)$/);
      return { pref: m ? Number(m[1]) : 0, host: (m ? m[2] : v).replace(/\.$/, "").toLowerCase() };
    }).sort(function (x, y) { return x.pref - y.pref; });
    const txt = valuesFor(core[4], "TXT").map(txtValue).filter(Boolean);
    const caa = valuesFor(core[5], "CAA").map(txtValue).filter(Boolean);

    const extra = await Promise.all([
      dnsQuery("_dmarc." + domain, "TXT"),
      dnsQuery("default._domainkey." + domain, "TXT"),
      dnsQuery("selector1._domainkey." + domain, "TXT"),
      dnsQuery("_mta-sts." + domain, "TXT"),
      dnsQuery("default._bimi." + domain, "TXT")
    ]);

    const dmarcTxt = valuesFor(extra[0], "TXT").map(txtValue);
    const dkimDefault = valuesFor(extra[1], "TXT").map(txtValue);
    const dkimSelector1 = valuesFor(extra[2], "TXT").map(txtValue);
    const mtaTxt = valuesFor(extra[3], "TXT").map(txtValue);
    const bimiTxt = valuesFor(extra[4], "TXT").map(txtValue);

    const spf = parseSpf(txt);
    const dmarc = parseDmarc(dmarcTxt);
    const dkimSelectors = [];
    if (dkimDefault.some(function (v) { return /v=DKIM1/i.test(v); })) dkimSelectors.push("default");
    if (dkimSelector1.some(function (v) { return /v=DKIM1/i.test(v); })) dkimSelectors.push("selector1");

    return {
      isIP: false,
      a: a,
      aaaa: aaaa,
      ns: ns,
      nsDomain: nsName,
      apex: target.registrable || domain,
      mx: mx,
      txt: txt,
      caa: caa,
      soa: valuesFor(core[6], "SOA"),
      dnssec: !!(core[0] && core[0].ad),
      dnsProvider: detectDnsProvider(ns),
      mailProvider: detectMailProvider(mx),
      spf: spf,
      dmarc: dmarc,
      dkim: { found: dkimSelectors.length > 0, selectors: dkimSelectors, defaultRaw: dkimDefault[0] || "", selector1Raw: dkimSelector1[0] || "" },
      mtaSts: mtaTxt.some(function (v) { return /^v=STSv1\b/i.test(v); }),
      bimi: bimiTxt.some(function (v) { return /^v=BIMI1\b/i.test(v); }),
      caaPresent: caa.length > 0,
      wildcardHint: false
    };
  }

  /* ============================== RDAP layer ============================= */

  function entityName(entity) {
    if (!entity) return "";
    const vcard = entity.vcardArray && entity.vcardArray[1];
    if (Array.isArray(vcard)) {
      const fn = vcard.find(function (row) { return row && row[0] === "fn"; });
      if (fn && fn[3]) return String(fn[3]);
    }
    return String(entity.handle || entity.name || "");
  }

  async function collectRdap(target) {
    if (target.isIP) {
      const data = await getJSON("https://rdap.org/ip/" + encodeURIComponent(target.host), 12000);
      const events = {};
      (data.events || []).forEach(function (e) { events[e.eventAction] = e.eventDate; });
      return {
        type: "ip",
        handle: data.handle || "",
        name: data.name || "",
        range: data.startAddress && data.endAddress ? data.startAddress + " – " + data.endAddress : "",
        country: data.country || "",
        registered: events.registration || "",
        changed: events["last changed"] || "",
        status: data.status || [],
        registrar: entityName((data.entities || []).find(function (e) { return (e.roles || []).indexOf("registrar") !== -1; })) || "",
        nameservers: (data.nameservers || []).map(function (n) { return String(n.ldhName || "").toLowerCase(); }).filter(Boolean)
      };
    }

    const registrable = target.registrable || target.domain;
    // .io RDAP is served by Identity Digital; rdap.org's bootstrap returns 404
    // for .io registrations, so query the registry endpoint directly there.
    const rdapUrls = /\.io$/i.test(registrable)
      ? ["https://rdap.identitydigital.services/rdap/domain/" + encodeURIComponent(registrable)]
      : ["https://rdap.org/domain/" + encodeURIComponent(registrable)];
    let data = null;
    let lastError = null;
    for (let i = 0; i < rdapUrls.length; i++) {
      try {
        data = await getJSON(rdapUrls[i], 12000);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!data) throw lastError || new Error("RDAP lookup failed");
    const events = {};
    (data.events || []).forEach(function (e) { events[e.eventAction] = e.eventDate; });
    const registrarEntity = (data.entities || []).find(function (e) {
      return (e.roles || []).indexOf("registrar") !== -1;
    });
    return {
      type: "domain",
      queried: registrable,
      handle: data.handle || "",
      ldhName: data.ldhName || registrable,
      unicodeName: data.unicodeName || "",
      registrar: entityName(registrarEntity),
      registrarId: registrarEntity ? String(registrarEntity.handle || "") : "",
      registered: events.registration || "",
      expires: events.expiration || "",
      changed: events["last changed"] || "",
      transferred: events.transfer || "",
      status: data.status || [],
      nameservers: (data.nameservers || []).map(function (n) { return String(n.ldhName || "").toLowerCase(); }).filter(Boolean),
      secureDns: data.secureDNS ? {
        delegationSigned: !!data.secureDNS.delegationSigned,
        ds: (data.secureDNS.dsData || []).map(function (d) { return d.digest || ""; }).filter(Boolean)
      } : null
    };
  }

  /* =========================== Certificate logs ========================= */

  async function ctFromCertSpotter(target) {
    const data = await getJSON(
      "https://api.certspotter.com/v1/issuances?domain=" + encodeURIComponent(target.domain) + "&include_subdomains=true&expand=dns_names&expand=issuer",
      20000
    );
    if (!Array.isArray(data)) throw new Error("Unexpected Cert Spotter response");
    const names = [];
    const issuers = [];
    let latest = "";
    let earliest = "";
    data.forEach(function (entry) {
      (entry.dns_names || []).forEach(function (name) {
        const clean = String(name || "").toLowerCase().replace(/^\*\./, "").replace(/\.$/, "");
        if (clean && (clean === target.domain || clean.endsWith("." + target.domain))) names.push(clean);
      });
      const issuer = entry.issuer && (entry.issuer.friendly_name || entry.issuer.name);
      if (issuer) issuers.push(String(issuer));
      if (entry.not_before && (!earliest || entry.not_before < earliest)) earliest = entry.not_before;
      if (entry.not_before && (!latest || entry.not_before > latest)) latest = entry.not_before;
    });
    const subdomains = dedupe(names).sort(function (a, b) { return a.length - b.length || a.localeCompare(b); }).slice(0, 400);
    return {
      available: true,
      entries: data.length,
      subdomains: subdomains,
      issuers: dedupe(issuers).slice(0, 20),
      earliest: earliest,
      latest: latest,
      truncated: dedupe(names).length > 400,
      source: "Cert Spotter",
      note: data.length === 0
        ? "No exact-name certificate matched. Shared wildcard certificates (for example *.github.io) are not enumerated for a single subdomain."
        : ""
    };
  }

  async function ctFromCrtSh(target) {
    const res = await getText(
      "https://crt.sh/?q=" + encodeURIComponent(target.domain) + "&output=json",
      { accept: "application/json" },
      22000
    );
    const text = String(res.text || "").trim();
    if (!text || text.charAt(0) !== "[") throw new Error("crt.sh returned no JSON");
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error("crt.sh returned invalid JSON"); }
    if (!Array.isArray(data)) throw new Error("Unexpected crt.sh response");
    const names = [];
    const issuers = [];
    let latest = "";
    let earliest = "";
    data.forEach(function (entry) {
      String(entry.name_value || entry.common_name || "").split(/\n/).forEach(function (name) {
        const clean = String(name || "").toLowerCase().replace(/^\*\./, "").replace(/\.$/, "").trim();
        if (clean && (clean === target.domain || clean.endsWith("." + target.domain))) names.push(clean);
      });
      const issuer = String(entry.issuer_name || "");
      const cn = (issuer.match(/CN=([^,]+)/) || [])[1] || issuer;
      if (cn) issuers.push(cn.trim());
      if (entry.not_before && (!earliest || entry.not_before < earliest)) earliest = entry.not_before;
      if (entry.not_before && (!latest || entry.not_before > latest)) latest = entry.not_before;
    });
    const subdomains = dedupe(names).sort(function (a, b) { return a.length - b.length || a.localeCompare(b); }).slice(0, 400);
    return {
      available: true,
      entries: data.length,
      subdomains: subdomains,
      issuers: dedupe(issuers).slice(0, 20),
      earliest: earliest,
      latest: latest,
      truncated: dedupe(names).length > 400,
      source: "crt.sh fallback",
      note: data.length === 0
        ? "No exact-name certificate matched. Shared wildcard certificates (for example *.github.io) are not enumerated for a single subdomain."
        : ""
    };
  }

  async function collectCt(target) {
    if (target.isIP) return { available: false, entries: 0, subdomains: [], issuers: [], source: "", note: "Certificate Transparency is domain-only." };
    let primaryError;
    try {
      return await ctFromCertSpotter(target);
    } catch (error) {
      primaryError = error;
    }
    try {
      return await ctFromCrtSh(target);
    } catch (fallbackError) {
      throw new Error("Cert Spotter: " + shortError(primaryError) + " | crt.sh: " + shortError(fallbackError));
    }
  }

  /* ============================= IP intel ============================== */

  async function collectIp(ip) {
    if (!ip) return null;
    const attempts = [
      {
        name: "ipinfo.io",
        run: async function () {
          const data = await getJSON("https://ipinfo.io/" + encodeURIComponent(ip) + "/json", 10000);
          if (!data || data.bogon) throw new Error("bogon address");
          const loc = String(data.loc || "").split(",");
          const org = String(data.org || "");
          const asnMatch = org.match(/^AS\d+/i);
          return {
            ip: data.ip || ip,
            type: ip.indexOf(":") !== -1 ? "IPv6" : "IPv4",
            city: data.city || "",
            region: data.region || "",
            country: data.country || "",
            countryCode: data.country || "",
            continent: "",
            latitude: loc[0] ? Number(loc[0]) : null,
            longitude: loc[1] ? Number(loc[1]) : null,
            timezone: data.timezone || "",
            asn: asnMatch ? asnMatch[0].toUpperCase() : "",
            org: org.replace(/^AS\d+\s*/i, ""),
            isp: org.replace(/^AS\d+\s*/i, ""),
            domain: data.hostname || "",
            hosting: !!org,
            source: "ipinfo.io"
          };
        }
      },
      {
        name: "ip.sb",
        run: async function () {
          const data = await getJSON("https://api.ip.sb/geoip/" + encodeURIComponent(ip), 10000);
          if (!data || !data.ip) throw new Error("no IP data");
          return {
            ip: data.ip || ip,
            type: ip.indexOf(":") !== -1 ? "IPv6" : "IPv4",
            city: data.city || "",
            region: data.region || "",
            country: data.country || "",
            countryCode: data.country_code || "",
            continent: data.continent_code || "",
            latitude: data.latitude != null ? data.latitude : null,
            longitude: data.longitude != null ? data.longitude : null,
            timezone: data.timezone || "",
            asn: data.asn ? "AS" + data.asn : "",
            org: data.asn_organization || data.organization || "",
            isp: data.isp || data.organization || "",
            domain: "",
            hosting: !!(data.asn || data.organization),
            source: "ip.sb"
          };
        }
      },
      {
        name: "ipwho.is",
        run: async function () {
          const data = await getJSON("https://ipwho.is/" + encodeURIComponent(ip), 10000);
          if (data.success === false) throw new Error(data.message || "IP lookup failed");
          const conn = data.connection || {};
          return {
            ip: data.ip || ip,
            type: data.type || "",
            city: data.city || "",
            region: data.region || "",
            country: data.country || "",
            countryCode: data.country_code || "",
            continent: data.continent || "",
            latitude: data.latitude,
            longitude: data.longitude,
            timezone: (data.timezone && data.timezone.id) || "",
            asn: conn.asn || "",
            org: conn.org || "",
            isp: conn.isp || "",
            domain: conn.domain || "",
            hosting: !!conn.org,
            source: "ipwho.is"
          };
        }
      }
    ];

    const errors = [];
    for (let i = 0; i < attempts.length; i++) {
      try {
        return await attempts[i].run();
      } catch (error) {
        errors.push(attempts[i].name + ": " + shortError(error));
      }
    }
    throw new Error(errors.join(" | ") || "IP lookup failed");
  }

  function hostingFrom(ipInfo) {
    if (!ipInfo) return "Unknown";
    const raw = (ipInfo.org + " " + ipInfo.isp + " " + ipInfo.asn).toLowerCase();
    const map = [
      ["amazon", "Amazon Web Services"], ["aws", "Amazon Web Services"], ["google", "Google Cloud"],
      ["microsoft", "Microsoft Azure"], ["azure", "Microsoft Azure"], ["cloudflare", "Cloudflare"],
      ["digitalocean", "DigitalOcean"], ["hetzner", "Hetzner"], ["ovh", "OVHcloud"],
      ["linode", "Akamai / Linode"], ["akamai", "Akamai"], ["oracle", "Oracle Cloud"],
      ["alibaba", "Alibaba Cloud"], ["tencent", "Tencent Cloud"], ["fastly", "Fastly"],
      ["github", "GitHub"], ["netlify", "Netlify"], ["vercel", "Vercel"], ["heroku", "Heroku"]
    ];
    for (let i = 0; i < map.length; i++) if (raw.indexOf(map[i][0]) !== -1) return map[i][1];
    return ipInfo.org || ipInfo.isp || "Unknown";
  }

  /* ============================ HTTP fetching ========================== */

  function parseRawHeaders(text) {
    const map = {};
    let status = null;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      const s = line.trim();
      if (!s) return;
      if (/^HTTP\/\d(?:\.\d)?\s+\d{3}/i.test(s)) {
        status = Number(s.split(/\s+/)[1]);
        return;
      }
      const idx = s.indexOf(":");
      if (idx < 1) return;
      const name = s.slice(0, idx).trim().toLowerCase();
      const value = s.slice(idx + 1).trim();
      if (!name || /\s/.test(name)) return;
      if (name === "set-cookie") {
        map[name] = map[name] ? map[name] + "\n" + value : value;
      } else {
        map[name] = map[name] ? map[name] + ", " + value : value;
      }
    });
    return { map: map, status: status, raw: String(text || "").trim() };
  }

  async function collectHeaders(target) {
    // HackerTarget mirrors the target's response headers and allows browser
    // CORS. Passing the full URL makes it fetch the actual path (and follow
    // redirects) rather than only the domain root.
    const res = await getText("https://api.hackertarget.com/httpheaders/?q=" + encodeURIComponent(target.url), {}, 16000);
    const body = res.text.trim();
    if (!body || /^error/i.test(body) || /api count exceeded|no records found|invalid/i.test(body)) {
      throw new Error(clip(body || "empty header response", 160));
    }
    const parsed = parseRawHeaders(body);
    if (!Object.keys(parsed.map).length) throw new Error("Header service returned no parseable headers");
    return { available: true, map: parsed.map, status: parsed.status, raw: parsed.raw, source: "HackerTarget" };
  }

  function looksLikeHtml(text) {
    const s = String(text || "").trimStart().toLowerCase();
    return s.startsWith("<!doctype") || s.startsWith("<html") || (s.indexOf("<head") !== -1 && s.indexOf("<body") !== -1);
  }

  async function collectHttp(target) {
    const out = { page: null, headers: null, html: "", htmlSource: "", status: 0, headerStatus: 0, errors: [] };

    const headerPromise = collectHeaders(target).catch(function (e) {
      out.errors.push("headers: " + shortError(e));
      return null;
    });

    const htmlErrors = [];
    const attempts = [
      {
        name: "Jina Reader",
        run: async function () {
          const r = await getText("https://r.jina.ai/" + target.url, {
            accept: "text/html",
            "x-respond-with": "html"
          }, 20000);
          if (/AbuseAlleviationError|Anonymous access to domain/i.test(r.text.slice(0, 600))) throw new Error("reader blocked this target");
          if (!looksLikeHtml(r.text)) throw new Error("reader did not return HTML");
          return { html: r.text, status: r.status };
        }
      },
      {
        name: "Microlink",
        run: async function () {
          const url = "https://api.microlink.io/?url=" + encodeURIComponent(target.url) +
            "&data.html.selector=html&data.html.attr=outerHTML";
          const data = await getJSON(url, 14000);
          if (data.status !== "success" || !data.data || !data.data.html) throw new Error((data.data && data.data.message) || "no HTML returned");
          if (!looksLikeHtml(data.data.html)) throw new Error("no HTML returned");
          return { html: data.data.html, status: 200 };
        }
      }
    ];

    // Sequential by design: the Jina reader succeeds for most public sites;
    // only pay the Microlink round-trip (and its tight free-tier limit) when
    // the first reader fails. Promise.any also caused avoidable 429s.
    for (let i = 0; i < attempts.length; i++) {
      try {
        const found = await attempts[i].run();
        if (!found || !found.html) continue;
        out.html = found.html;
        out.page = parsePage(found.html, target);
        out.htmlSource = attempts[i].name;
        out.status = found.status || 0;
        break;
      } catch (e) {
        htmlErrors.push(attempts[i].name + ": " + shortError(e));
      }
    }
    if (!out.page) out.errors.push("html: " + (htmlErrors.join(" | ") || "readers unavailable"));

    out.headers = await headerPromise;
    out.headerStatus = out.headers && out.headers.status ? out.headers.status : 0;
    if (!out.status) out.status = out.headerStatus;
    return out;
  }

  function parsePage(html, target) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const meta = function (selector) {
      const el = doc.querySelector(selector);
      return el ? String(el.getAttribute("content") || "").trim() : "";
    };
    const bodyText = (doc.body && doc.body.textContent ? doc.body.textContent : "").replace(/\s+/g, " ").trim();
    const anchors = Array.from(doc.querySelectorAll("a[href]"));
    const images = Array.from(doc.querySelectorAll("img"));
    const scripts = Array.from(doc.querySelectorAll("script"));
    const styles = Array.from(doc.querySelectorAll('link[rel~="stylesheet"], style'));
    const externalDomains = [];
    anchors.forEach(function (a) {
      try {
        const u = new URL(a.getAttribute("href"), target.url);
        if (/^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, "") !== target.host.replace(/^www\./, "")) {
          externalDomains.push(u.hostname.toLowerCase());
        }
      } catch (e) { /* ignore malformed hrefs */ }
    });
    const mixed = [];
    Array.from(doc.querySelectorAll("img[src], script[src], link[href], iframe[src], source[src], video[src], audio[src], form[action]")).forEach(function (el) {
      const v = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("action") || "";
      if (/^http:\/\//i.test(v)) mixed.push(v);
    });
    const canonicalEl = doc.querySelector('link[rel="canonical"]');
    const canonical = canonicalEl ? canonicalEl.getAttribute("href") || "" : "";
    const faviconEl = doc.querySelector('link[rel~="icon"]');
    let favicon = faviconEl ? faviconEl.getAttribute("href") || "" : "";
    try { if (favicon) favicon = new URL(favicon, target.url).href; } catch (e) { favicon = ""; }

    return {
      title: (doc.title || "").trim(),
      description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
      canonical: canonical,
      favicon: favicon,
      lang: (doc.documentElement.getAttribute("lang") || "").trim(),
      viewport: meta('meta[name="viewport"]'),
      generator: meta('meta[name="generator"]'),
      themeColor: meta('meta[name="theme-color"]'),
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]'),
      ogImage: meta('meta[property="og:image"]'),
      ogType: meta('meta[property="og:type"]'),
      twitterCard: meta('meta[name="twitter:card"]'),
      twitterSite: meta('meta[name="twitter:site"]'),
      h1: doc.querySelectorAll("h1").length,
      h2: doc.querySelectorAll("h2").length,
      h3: doc.querySelectorAll("h3").length,
      links: anchors.length,
      externalDomains: dedupe(externalDomains).slice(0, 40),
      images: images.length,
      missingAlt: images.filter(function (img) { return !img.hasAttribute("alt"); }).length,
      scripts: scripts.length,
      inlineScripts: scripts.filter(function (s) { return !s.getAttribute("src"); }).length,
      stylesheets: styles.length,
      forms: doc.querySelectorAll("form").length,
      iframes: doc.querySelectorAll("iframe").length,
      mixedContent: dedupe(mixed).slice(0, 20),
      textLength: bodyText.length,
      htmlBytes: new Blob([html]).size,
      hasServiceWorker: /serviceWorker\s*\.\s*register/i.test(html),
      copyright: (bodyText.match(/©[^.]{0,90}/) || [""])[0].trim(),
      bodyText: clip(bodyText, 1200)
    };
  }

  /* ========================= well-known files ========================== */

  async function jinaText(url) {
    const r = await getText("https://r.jina.ai/" + url, { accept: "text/plain", "x-respond-with": "text" }, 14000);
    const text = r.text.trim();
    if (/AbuseAlleviationError|Anonymous access to domain/i.test(text.slice(0, 400))) throw new Error("blocked by reader");
    if (/^404\b|ICMP Destination Unreachable|This page dropped off the network/i.test(text.slice(0, 300))) {
      return { found: false, text: "", status: 404 };
    }
    return { found: true, text: text, status: r.status };
  }

  async function collectWellKnown(target) {
    // robots.txt and security.txt are origin-scoped, never path-scoped.
    const base = target.origin || ("https://" + target.host);
    const tasks = [
      jinaText(base + "/robots.txt").then(function (r) {
        if (!r.found) return { found: false };
        const sitemaps = (r.text.match(/^\s*Sitemap:\s*(\S+)/gim) || []).map(function (l) { return l.replace(/^\s*Sitemap:\s*/i, "").trim(); });
        const disallows = (r.text.match(/^\s*Disallow:\s*\S+/gim) || []).length;
        const agents = (r.text.match(/^\s*User-agent:\s*\S+/gim) || []).length;
        return { found: true, sitemaps: dedupe(sitemaps).slice(0, 10), disallows: disallows, agents: agents, sample: clip(r.text, 700) };
      }).catch(function () { return { found: false }; }),
      jinaText(base + "/.well-known/security.txt").then(function (r) {
        if (!r.found && !/contact:/i.test(r.text || "")) return { found: false };
        const get = function (key) {
          const m = r.text.match(new RegExp("^\\s*" + key + ":\\s*(.+)$", "im"));
          return m ? m[1].trim() : "";
        };
        return {
          found: /contact:/i.test(r.text),
          contacts: (r.text.match(/^\s*Contact:\s*(.+)$/gim) || []).map(function (l) { return l.replace(/^\s*Contact:\s*/i, "").trim(); }).slice(0, 8),
          expires: get("Expires"),
          canonical: get("Canonical"),
          policy: get("Policy"),
          languages: get("Preferred-Languages")
        };
      }).catch(function () { return { found: false }; }),
      jinaText(base + "/sitemap.xml").then(function (r) {
        if (!r.found) return { found: false };
        const locs = r.text.match(/<loc>\s*([^<]+?)\s*<\/loc>/gi) || [];
        return { found: locs.length > 0, count: locs.length, sample: locs.slice(0, 5).map(function (l) { return l.replace(/<\/?loc>/gi, "").trim(); }) };
      }).catch(function () { return { found: false }; })
    ];
    const out = await Promise.all(tasks);
    return { robots: out[0], securityTxt: out[1], sitemap: out[2] };
  }

  /* ============================ tech database ========================== */

  const TECH = [
    { name: "WordPress", cat: "CMS / Platform", icon: "W", color: "#21759b", html: /wp-content|wp-includes|wp-json/i, header: /(?:x-generator|x-powered-by):[^\n]*wordpress/i, cookie: /^wp-settings|^wordpress_/i },
    { name: "Drupal", cat: "CMS / Platform", icon: "D", color: "#0678be", html: /drupal\.settings|sites\/default\/files|drupal-/i, header: /(?:x-generator|x-powered-by):[^\n]*drupal|x-drupal-cache:/i },
    { name: "Joomla", cat: "CMS / Platform", icon: "J", color: "#f44321", html: /\/components\/com_content|joomla/i },
    { name: "Ghost", cat: "CMS / Platform", icon: "G", color: "#15171a", html: /ghost(?:-url|-settings|\.js)|content="ghost/i },
    { name: "Shopify", cat: "E-commerce", icon: "S", color: "#95bf47", html: /cdn\.shopify\.com|shopify-payment|myshopify/i, header: /x-shopify/i, cookie: /^_shopify|^shopify/i },
    { name: "WooCommerce", cat: "E-commerce", icon: "W", color: "#7f54b3", html: /woocommerce|wc-block/i },
    { name: "Magento", cat: "E-commerce", icon: "M", color: "#f26322", html: /magento|mage\/cookies|\/static\/version\d+\//i, header: /x-magento|server:[^\n]*magento/i },
    { name: "BigCommerce", cat: "E-commerce", icon: "B", color: "#121118", html: /bigcommerce/i },
    { name: "PrestaShop", cat: "E-commerce", icon: "P", color: "#df0067", html: /prestashop/i },
    { name: "Wix", cat: "CMS / Platform", icon: "W", color: "#faad14", html: /wixstatic|wix\.com|wix-code/i, header: /x-wix|server:[^\n]*wix/i },
    { name: "Squarespace", cat: "CMS / Platform", icon: "S", color: "#222222", html: /squarespace|static\.squarespace/i, header: /server:[^\n]*squarespace|x-squarespace/i },
    { name: "Webflow", cat: "CMS / Platform", icon: "W", color: "#4353ff", html: /webflow(?:\.js|\.css|\.com)|data-wf-page/i, header: /server:[^\n]*webflow|x-webflow/i },
    { name: "Blogger", cat: "CMS / Platform", icon: "B", color: "#f57d00", html: /blogger\.com|blogspot/i },
    { name: "Next.js", cat: "Framework", icon: "N", color: "#000000", html: /__NEXT_DATA__|_next\/static|next\/dist/i, header: /x-nextjs|server:[^\n]*next\.js|x-powered-by:[^\n]*next\.js/i },
    { name: "Nuxt", cat: "Framework", icon: "N", color: "#00dc82", html: /__NUXT__|_nuxt\//i, header: /x-nuxt|server:[^\n]*nuxt/i },
    { name: "Astro", cat: "Framework", icon: "A", color: "#ff5d01", html: /astro-island|astro\/|data-astro/i },
    { name: "Gatsby", cat: "Framework", icon: "G", color: "#663399", html: /gatsby|___gatsby/i },
    { name: "Remix", cat: "Framework", icon: "R", color: "#121212", html: /remix-run|__remixContext/i },
    { name: "Ruby on Rails", cat: "Framework", icon: "R", color: "#cc0000", html: /csrf-token|rails-ujs|actioncable/i, header: /x-powered-by:[^\n]*(?:phusion|passenger|rails)|server:[^\n]*(?:passenger|rails)/i, cookie: /_rails|_session_id/i },
    { name: "Laravel", cat: "Framework", icon: "L", color: "#ff2d20", html: /laravel|livewire/i, cookie: /^laravel_session|^XSRF-TOKEN/i },
    { name: "Django", cat: "Framework", icon: "D", color: "#092e20", html: /csrfmiddlewaretoken/i, cookie: /^csrftoken|^django/i },
    { name: "Express", cat: "Framework", icon: "E", color: "#444444", header: /x-powered-by:[^\n]*express/i },
    { name: "ASP.NET", cat: "Framework", icon: ".N", color: "#512bd4", html: /__viewstate|aspnet/i, header: /x-powered-by:[^\n]*asp\.net|x-aspnet-version:/i, cookie: /^ASP\.NET/i },
    { name: "React", cat: "Frontend", icon: "R", color: "#61dafb", html: /data-reactroot|react-dom|__REACT_DEVTOOLS|react\.production/i },
    { name: "Vue.js", cat: "Frontend", icon: "V", color: "#41b883", html: /vue(?:\.min)?\.js|__VUE__|data-v-[0-9a-f]{6}/i },
    { name: "Angular", cat: "Frontend", icon: "A", color: "#dd0031", html: /ng-version|ng-app|angular(?:\.min)?\.js/i },
    { name: "Svelte", cat: "Frontend", icon: "S", color: "#ff3e00", html: /svelte(?:-[\w-]+)?\.js|sveltekit/i },
    { name: "Alpine.js", cat: "Frontend", icon: "A", color: "#8bc0d0", html: /alpinejs|x-data=/i },
    { name: "htmx", cat: "Frontend", icon: "H", color: "#36c", html: /htmx(?:\.min)?\.js/i },
    { name: "jQuery", cat: "Frontend", icon: "jQ", color: "#0769ad", html: /jquery(?:-[\d.]+)?(?:\.min)?\.js/i },
    { name: "Bootstrap", cat: "Frontend", icon: "B", color: "#7952b3", html: /bootstrap(?:\.min)?\.(?:css|js)/i },
    { name: "Tailwind CSS", cat: "Frontend", icon: "T", color: "#06b6d4", html: /tailwindcss\.com|\/tailwind(?:\.min)?\.(?:css|js)/i },
    { name: "GSAP", cat: "Frontend", icon: "G", color: "#88ce02", html: /gsap(?:\.min)?\.js|greensock\.com/i },
    { name: "Three.js", cat: "Frontend", icon: "3", color: "#000000", html: /three(?:\.min)?\.js|THREE\./i },
    { name: "Chart.js", cat: "Frontend", icon: "C", color: "#ff6384", html: /chart(?:\.min)?\.js|Chart\.defaults/i },
    { name: "Lodash", cat: "Frontend", icon: "L", color: "#3492ff", html: /lodash(?:\.min)?\.js/i },
    { name: "Google Fonts", cat: "Fonts", icon: "G", color: "#4285f4", html: /fonts\.googleapis\.com|fonts\.gstatic\.com/i },
    { name: "Adobe Fonts", cat: "Fonts", icon: "A", color: "#ff0000", html: /use\.typekit\.net|p\.typekit\.net/i },
    { name: "Font Awesome", cat: "Fonts", icon: "F", color: "#528dd7", html: /font-?awesome|fontawesome/i },
    { name: "Cloudflare", cat: "Hosting / Edge", icon: "CF", color: "#f38020", header: /server:[^\n]*cloudflare|cf-ray:|cf-cache-status:|cf-mitigated:/i, cookie: /^__cf/i },
    { name: "Vercel", cat: "Hosting / Edge", icon: "V", color: "#000000", header: /server:[^\n]*vercel|x-vercel/i, html: /_vercel\/insights/i },
    { name: "Netlify", cat: "Hosting / Edge", icon: "N", color: "#00c7b7", header: /server:[^\n]*netlify|x-nf-/i },
    { name: "GitHub Pages", cat: "Hosting / Edge", icon: "GH", color: "#181717", header: /server:[^\n]*github\.com|x-github-request-id:/i, host: /\.github\.io$/i },
    { name: "Cloudflare Pages", cat: "Hosting / Edge", icon: "CP", color: "#f38020", host: /\.pages\.dev$/i },
    { name: "Amazon S3", cat: "Hosting / Edge", icon: "S3", color: "#569a31", header: /server:[^\n]*amazons3|x-amz-request-id|x-amz-id-2/i, host: /\.s3[.-][a-z0-9-]*\.amazonaws\.com$/i },
    { name: "Amazon CloudFront", cat: "CDN / Assets", icon: "CF", color: "#ff9900", header: /x-amz-cf-id|server:[^\n]*cloudfront|via:[^\n]*cloudfront/i, host: /\.cloudfront\.net$/i },
    { name: "Akamai", cat: "CDN / Assets", icon: "A", color: "#009bde", header: /x-akamai|server:[^\n]*akamai/i },
    { name: "Fastly", cat: "CDN / Assets", icon: "F", color: "#ff282d", header: /x-fastly|server:[^\n]*fastly|x-served-by:[^\n]*cache-/i },
    { name: "Azure", cat: "Hosting / Edge", icon: "AZ", color: "#0078d4", header: /x-azure|x-msedge-ref|server:[^\n]*(?:azure|windows-azure)/i, host: /\.azurewebsites\.net$/i },
    { name: "Firebase", cat: "Hosting / Edge", icon: "FB", color: "#ffca28", host: /\.web\.app$|\.firebaseapp\.com$/i },
    { name: "Heroku", cat: "Hosting / Edge", icon: "H", color: "#430098", header: /server:[^\n]*heroku|via:[^\n]*vegur/i, host: /\.herokuapp\.com$/i },
    { name: "Render", cat: "Hosting / Edge", icon: "R", color: "#46e3b7", header: /server:[^\n]*render|x-render-/i, host: /\.onrender\.com$/i },
    { name: "Nginx", cat: "Server", icon: "N", color: "#009639", header: /server:[^\n]*nginx/i },
    { name: "Apache", cat: "Server", icon: "A", color: "#d22128", header: /server:[^\n]*apache/i },
    { name: "LiteSpeed", cat: "Server", icon: "L", color: "#0f5f9e", header: /server:[^\n]*litespeed/i },
    { name: "OpenResty", cat: "Server", icon: "O", color: "#00a98f", header: /server:[^\n]*openresty/i },
    { name: "Envoy", cat: "Server", icon: "E", color: "#ac6199", header: /server:[^\n]*envoy|x-envoy/i },
    { name: "IIS", cat: "Server", icon: "I", color: "#0078d4", header: /server:[^\n]*microsoft-iis/i },
    { name: "Caddy", cat: "Server", icon: "C", color: "#1f88c8", header: /server:[^\n]*caddy/i },
    { name: "PHP", cat: "Language", icon: "P", color: "#777bb4", header: /x-powered-by:[^\n]*php|server:[^\n]*php/i, cookie: /^PHPSESSID$/i },
    { name: "ASP.NET", cat: "Language", icon: ".N", color: "#512bd4", header: /x-powered-by:[^\n]*asp\.net|x-aspnet-version:/i, cookie: /^ASP\.NET/i },
    { name: "Java", cat: "Language", icon: "J", color: "#f89820", cookie: /^JSESSIONID$/i },
    { name: "Node.js", cat: "Language", icon: "N", color: "#5fa04e", header: /x-powered-by:[^\n]*node|server:[^\n]*node/i },
    { name: "Python", cat: "Language", icon: "Py", color: "#3776ab", header: /x-powered-by:[^\n]*(?:python|gunicorn|uvicorn|werkzeug)|server:[^\n]*(?:python|gunicorn|uvicorn|werkzeug)/i },
    { name: "Ruby", cat: "Language", icon: "R", color: "#cc342d", header: /x-powered-by:[^\n]*(?:ruby|passenger)|server:[^\n]*(?:ruby|passenger)/i },
    { name: "Google Analytics", cat: "Analytics", icon: "GA", color: "#e37400", html: /googletagmanager\.com\/gtag\/js|google-analytics\.com\/analytics\.js|ga\('create'/i },
    { name: "Google Tag Manager", cat: "Analytics", icon: "GT", color: "#246fdb", html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i },
    { name: "Meta Pixel", cat: "Analytics", icon: "MP", color: "#1877f2", html: /connect\.facebook\.net|fbq\(/i },
    { name: "Hotjar", cat: "Analytics", icon: "H", color: "#fd3a5c", html: /hotjar/i },
    { name: "Microsoft Clarity", cat: "Analytics", icon: "MC", color: "#0078d4", html: /clarity\.ms/i },
    { name: "Plausible", cat: "Analytics", icon: "P", color: "#5850ec", html: /plausible\.io/i },
    { name: "Matomo", cat: "Analytics", icon: "M", color: "#3152a0", html: /matomo|piwik/i },
    { name: "Fathom", cat: "Analytics", icon: "F", color: "#9187ff", html: /usefathom|fathom\.js/i },
    { name: "Umami", cat: "Analytics", icon: "U", color: "#00bcd4", html: /umami/i },
    { name: "Segment", cat: "Analytics", icon: "S", color: "#52bd95", html: /cdn\.segment\.com|api\.segment\.io/i },
    { name: "Sentry", cat: "Analytics", icon: "S", color: "#362d59", html: /sentry(?:\.min)?\.js|sentry\.io/i },
    { name: "HubSpot", cat: "Marketing / Support", icon: "H", color: "#ff7a59", html: /js\.hs-scripts\.com|hs-scripts|hubspot\.com/i },
    { name: "Intercom", cat: "Marketing / Support", icon: "I", color: "#1f8ded", html: /intercom/i },
    { name: "Drift", cat: "Marketing / Support", icon: "D", color: "#0176ff", html: /drift\.(?:com|js)|driftt/i },
    { name: "Zendesk", cat: "Marketing / Support", icon: "Z", color: "#03363d", html: /zendesk|zdassets/i },
    { name: "Tawk.to", cat: "Marketing / Support", icon: "T", color: "#03a84e", html: /tawk\.to/i },
    { name: "Crisp", cat: "Marketing / Support", icon: "C", color: "#1972f5", html: /crisp\.chat/i },
    { name: "LiveChat", cat: "Marketing / Support", icon: "L", color: "#ff5100", html: /livechatinc|livechat\.com/i },
    { name: "Stripe", cat: "Payments", icon: "S", color: "#635bff", html: /js\.stripe\.com|stripe\.com\/v3/i },
    { name: "PayPal", cat: "Payments", icon: "PP", color: "#003087", html: /paypal\.com\/sdk|paypalobjects/i },
    { name: "Razorpay", cat: "Payments", icon: "R", color: "#0c2451", html: /razorpay/i },
    { name: "Google reCAPTCHA", cat: "Security", icon: "R", color: "#4285f4", html: /recaptcha|gstatic\.com\/recaptcha/i },
    { name: "hCaptcha", cat: "Security", icon: "H", color: "#0074bf", html: /hcaptcha/i },
    { name: "Cloudflare Turnstile", cat: "Security", icon: "T", color: "#f38020", html: /challenges\.cloudflare\.com\/turnstile|turnstile/i },
    { name: "Sucuri", cat: "Security", icon: "S", color: "#f26722", header: /x-sucuri|server:[^\n]*sucuri/i },
    { name: "Google Cloud", cat: "Hosting / Edge", icon: "GC", color: "#4285f4", header: /server:[^\n]*(?:google frontend|gws)|via:[^\n]*google|x-cloud-trace-context|x-goog-/i },
    { name: "Microsoft 365", cat: "DNS / Email", icon: "M", color: "#d83b01", dns: /outlook|protection\.outlook|microsoft/i },
    { name: "Google Workspace", cat: "DNS / Email", icon: "G", color: "#4285f4", dns: /google\.com|googlemail/i },
    { name: "Amazon Route 53", cat: "DNS / Email", icon: "R53", color: "#ff9900", dns: /awsdns/i },
    { name: "Cloudflare DNS", cat: "DNS / Email", icon: "CF", color: "#f38020", dns: /cloudflare/i },
    { name: "Azure DNS", cat: "DNS / Email", icon: "AZ", color: "#0078d4", dns: /azure-dns/i },
    { name: "Google Cloud DNS", cat: "DNS / Email", icon: "GD", color: "#4285f4", dns: /googledomains|googledns/i },
    { name: "GoDaddy DNS", cat: "DNS / Email", icon: "GD", color: "#1bdbdb", dns: /domaincontrol/i },
    { name: "Namecheap DNS", cat: "DNS / Email", icon: "NC", color: "#de3723", dns: /registrar-servers|namecheaphosting/i },
    { name: "Zoho Mail", cat: "DNS / Email", icon: "Z", color: "#e42527", dns: /zoho/i },
    { name: "Proton Mail", cat: "DNS / Email", icon: "P", color: "#6d4aff", dns: /protonmail|proton\.me/i },
    { name: "SPF", cat: "DNS / Email", icon: "SPF", color: "#16a34a", txt: /v=spf1/i },
    { name: "DMARC", cat: "DNS / Email", icon: "DM", color: "#0ea5e9", txt: /v=DMARC1/i },
    { name: "DKIM", cat: "DNS / Email", icon: "DK", color: "#8b5cf6", txt: /v=DKIM1/i },
    { name: "DNSSEC", cat: "DNS / Email", icon: "DS", color: "#22c55e", dnssec: true }
  ];

  const CATEGORY_ORDER = [
    "CMS / Platform", "Framework", "Frontend", "E-commerce", "Hosting / Edge",
    "Server", "Language", "CDN / Assets", "Analytics", "Marketing / Support",
    "Payments", "Security", "Fonts", "DNS / Email", "Other"
  ];

  function structuralHtml(html) {
    if (!html) return "";
    let doc;
    try { doc = new DOMParser().parseFromString(html, "text/html"); } catch (e) { return html; }
    const clone = doc.documentElement.cloneNode(true);

    // Content, prose links, comments and descriptive metadata are not stack
    // evidence. Keep structural tags, scripts, styles and meaningful metas.
    const keepMeta = /^(generator|application-name|csrf-token|csrf-param)$/i;
    Array.from(clone.querySelectorAll("a, meta")).forEach(function (el) {
      if (el.tagName === "META") {
        const key = (el.getAttribute("name") || el.getAttribute("property") || "").trim().toLowerCase();
        if (!keepMeta.test(key)) el.remove();
      } else {
        el.remove();
      }
    });
    Array.from(clone.querySelectorAll("script")).forEach(function (el) { el.textContent = ""; });

    const walker = doc.createTreeWalker(clone, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT);
    const drop = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === 8) { drop.push(node); continue; }
      const parent = node.parentNode;
      if (parent && !/^(SCRIPT|STYLE)$/i.test(parent.tagName)) drop.push(node);
    }
    drop.forEach(function (node) { node.remove(); });

    Array.from(clone.querySelectorAll("[alt], [title], [aria-label], [placeholder], [value]")).forEach(function (el) {
      ["alt", "title", "aria-label", "placeholder", "value"].forEach(function (attr) { el.removeAttribute(attr); });
    });

    // Some CMSs embed article/citation JSON in long data-* attributes. That is
    // page content, not a stack signal, and can mention other platforms.
    Array.from(clone.querySelectorAll("*")).forEach(function (el) {
      Array.from(el.attributes).forEach(function (attr) {
        if (attr.value.length > 240) el.removeAttribute(attr.name);
      });
    });
    return clone.outerHTML;
  }

  const GENERATOR_HINTS = [
    ["WordPress", /wordpress/i], ["Drupal", /drupal/i], ["Joomla", /joomla/i],
    ["Ghost", /ghost/i], ["Shopify", /shopify/i], ["Wix", /wix/i],
    ["Squarespace", /squarespace/i], ["Webflow", /webflow/i], ["Next.js", /next\.?js/i],
    ["Nuxt", /nuxt/i], ["Astro", /astro/i], ["Gatsby", /gatsby/i], ["Hugo", /hugo/i]
  ];

  const INLINE_RULES = [
    ["Google Tag Manager", /GTM-[A-Z0-9]{4,}/i],
    ["Google Analytics", /ga\('create'|gtag\('config'|GoogleAnalyticsObject/i],
    ["Meta Pixel", /fbq\('init'/i],
    ["Hotjar", /hjid\s*:/i],
    ["Sentry", /Sentry\.init/i],
    ["Intercom", /intercomSettings/i],
    ["Drift", /drift\.load/i],
    ["Tawk.to", /Tawk_API/i],
    ["Crisp", /CRISP_WEBSITE_ID/i],
    ["LiveChat", /LiveChatWidget/i],
    ["Stripe", /Stripe\(/i],
    ["PayPal", /paypal\.Buttons/i],
    ["Razorpay", /Razorpay\(/i],
    ["Google reCAPTCHA", /grecaptcha\.(?:execute|render)/i],
    ["hCaptcha", /hcaptcha\.(?:execute|render|onload)/i],
    ["Cloudflare Turnstile", /turnstile\.(?:execute|render)/i],
    ["Plausible", /plausible\('init'/i],
    ["Matomo", /_paq\.push/i],
    ["Fathom", /fathom\.track/i],
    ["Umami", /umami\.track/i],
    ["Segment", /analytics\.(?:load|track)\(/i],
    ["HubSpot", /hbspt\./i]
  ];

  function inlineScripts(html) {
    if (!html) return "";
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return Array.from(doc.querySelectorAll("script:not([src])")).filter(function (s) {
        return !/json|template|text\/plain/i.test(s.getAttribute("type") || "text/javascript");
      }).map(function (s) { return s.textContent || ""; }).join("\n").slice(0, 400000);
    } catch (e) { return ""; }
  }

  function detectTech(html, http, dns, target, page, ipInfo) {
    const found = new Map();
    const skipHeader = /^(content-security-policy|content-security-policy-report-only|link|report-to|reporting-endpoints|nel|permissions-policy|referrer-policy|strict-transport-security|alt-svc|set-cookie|content-encoding|content-length|content-type|date|etag|last-modified|vary|age|expires|cache-control|access-control-allow-origin|timing-allow-origin|cross-origin-opener-policy|cross-origin-embedder-policy|cross-origin-resource-policy|server-timing|keep-alive|connection|transfer-encoding)$/i;
    const headerText = http && http.headers && http.headers.map
      ? Object.keys(http.headers.map).filter(function (k) { return !skipHeader.test(k); }).map(function (k) { return k + ": " + http.headers.map[k]; }).join("\n")
      : "";
    const cookies = http && http.headers && http.headers.map["set-cookie"] ? http.headers.map["set-cookie"] : "";
    const dnsText = dns ? [dns.ns.join(" "), dns.mx.map(function (m) { return m.host; }).join(" ")].join(" ") : "";
    const txtText = dns ? dns.txt.join(" ") : "";
    const htmlText = structuralHtml(html || "");
    const generator = page && page.generator ? page.generator : "";
    const host = target.host;

    TECH.forEach(function (sig) {
      let source = "";
      if (sig.html && sig.html.test(htmlText)) source = "HTML";
      else if (sig.header && sig.header.test(headerText)) source = "headers";
      else if (sig.cookie && sig.cookie.test(cookies)) source = "cookie";
      else if (sig.host && sig.host.test(host)) source = "hostname";
      else if (sig.dns && sig.dns.test(dnsText)) source = "DNS";
      else if (sig.txt && sig.txt.test(txtText)) source = "TXT";
      else if (sig.dnssec && dns && dns.dnssec) source = "DNSSEC";
      if (source && !found.has(sig.name)) {
        found.set(sig.name, { name: sig.name, cat: sig.cat, icon: sig.icon, color: sig.color, source: source });
      }
    });

    if (generator) {
      for (let i = 0; i < GENERATOR_HINTS.length; i++) {
        const hint = GENERATOR_HINTS[i];
        if (hint[1].test(generator) && !found.has(hint[0])) {
          const sig = TECH.find(function (t) { return t.name === hint[0]; });
          if (sig) found.set(sig.name, { name: sig.name, cat: sig.cat, icon: sig.icon, color: sig.color, source: "generator" });
        }
      }
    }

    const inlineText = inlineScripts(html || "");
    if (inlineText) {
      for (let i = 0; i < INLINE_RULES.length; i++) {
        const rule = INLINE_RULES[i];
        if (!found.has(rule[0]) && rule[1].test(inlineText)) {
          const sig = TECH.find(function (t) { return t.name === rule[0]; });
          if (sig) found.set(sig.name, { name: sig.name, cat: sig.cat, icon: sig.icon, color: sig.color, source: "inline script" });
        }
      }
    }

    if (http && http.headers && http.headers.map.server) {
      const server = http.headers.map.server.toLowerCase();
      if (/cloudflare/.test(server) && !found.has("Cloudflare")) found.set("Cloudflare", { name: "Cloudflare", cat: "Hosting / Edge", icon: "CF", color: "#f38020", source: "server" });
      if (/vercel/.test(server) && !found.has("Vercel")) found.set("Vercel", { name: "Vercel", cat: "Hosting / Edge", icon: "V", color: "#000000", source: "server" });
      if (/netlify/.test(server) && !found.has("Netlify")) found.set("Netlify", { name: "Netlify", cat: "Hosting / Edge", icon: "N", color: "#00c7b7", source: "server" });
    }

    if (ipInfo) {
      const org = (ipInfo.org + " " + ipInfo.isp).toLowerCase();
      const clouds = [
        ["amazon", "Amazon Web Services", "AWS", "#ff9900"],
        ["google", "Google Cloud", "GC", "#4285f4"],
        ["microsoft", "Microsoft Azure", "AZ", "#0078d4"],
        ["cloudflare", "Cloudflare", "CF", "#f38020"],
        ["digitalocean", "DigitalOcean", "DO", "#0080ff"],
        ["hetzner", "Hetzner", "H", "#d50c2d"],
        ["ovh", "OVHcloud", "OVH", "#123f6d"],
        ["linode", "Akamai / Linode", "L", "#00a95c"],
        ["oracle", "Oracle Cloud", "O", "#f80000"]
      ];
      for (let i = 0; i < clouds.length; i++) {
        if (org.indexOf(clouds[i][0]) !== -1 && !found.has(clouds[i][1])) {
          found.set(clouds[i][1], { name: clouds[i][1], cat: "Hosting / Edge", icon: clouds[i][2], color: clouds[i][3], source: "IP ASN" });
          break;
        }
      }
    }

    return Array.from(found.values()).sort(function (a, b) {
      const ai = CATEGORY_ORDER.indexOf(a.cat);
      const bi = CATEGORY_ORDER.indexOf(b.cat);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.name.localeCompare(b.name);
    }).slice(0, 40);
  }

  /* =========================== security audit ========================== */

  function headerValue(map, name) {
    return map && map[name] ? String(map[name]) : "";
  }

  function auditHeaders(http, dns, page) {
    const available = !!(http && http.headers && http.headers.available);
    const map = available ? http.headers.map : {};
    const hsts = headerValue(map, "strict-transport-security");
    const csp = headerValue(map, "content-security-policy");
    const xcto = headerValue(map, "x-content-type-options").toLowerCase();
    const xfo = headerValue(map, "x-frame-options").toLowerCase();
    const referrer = headerValue(map, "referrer-policy");
    const permissions = headerValue(map, "permissions-policy");
    const coop = headerValue(map, "cross-origin-opener-policy");
    const corp = headerValue(map, "cross-origin-resource-policy");
    const server = headerValue(map, "server");
    const powered = headerValue(map, "x-powered-by");
    const cookies = headerValue(map, "set-cookie");

    const checks = [];
    const add = function (id, label, status, severity, points, detail, value) {
      checks.push({ id: id, label: label, status: status, severity: severity, points: points, detail: detail, value: value || "" });
    };

    if (available) {
      const hstsMax = (hsts.match(/max-age\s*=\s*(\d+)/i) || [])[1];
      if (!hsts) add("hsts", "HSTS", "fail", "high", 12, "No Strict-Transport-Security header. Browsers can be downgraded to HTTP on first contact.", "");
      else if (!hstsMax || Number(hstsMax) < 15552000) add("hsts", "HSTS", "warn", "med", 6, "HSTS is present but max-age is below 180 days (15,552,000 seconds).", hsts);
      else add("hsts", "HSTS", "pass", "ok", 0, "HSTS enforces HTTPS." + (/includesubdomains/i.test(hsts) ? " Includes subdomains." : "") + (/preload/i.test(hsts) ? " Preload ready." : ""), hsts);

      if (!csp) add("csp", "Content-Security-Policy", "fail", "high", 14, "No CSP. The page has no browser-enforced restriction on injected scripts or external origins.", "");
      else {
        const weak = /unsafe-inline|unsafe-eval/i.test(csp);
        const strong = /default-src|script-src/i.test(csp);
        add("csp", "Content-Security-Policy", weak ? "warn" : "pass", weak ? "med" : "ok", weak ? 6 : 0,
          weak ? "CSP is deployed but allows unsafe-inline or unsafe-eval, weakening XSS mitigation." : "CSP is present" + (strong ? " with a source policy." : "."),
          csp);
      }

      if (xcto === "nosniff") add("xcto", "X-Content-Type-Options", "pass", "ok", 0, "nosniff prevents MIME-type confusion.", xcto);
      else add("xcto", "X-Content-Type-Options", "fail", "med", 5, "Missing or invalid. Add `X-Content-Type-Options: nosniff`.", xcto);

      const cspFrames = /frame-ancestors/i.test(csp);
      if (/deny|sameorigin/i.test(xfo) || cspFrames) {
        add("xfo", "Framing protection", "pass", "ok", 0, cspFrames ? "CSP frame-ancestors controls embedding." : "X-Frame-Options restricts embedding.", xfo || "CSP frame-ancestors");
      } else {
        add("xfo", "Framing protection", "fail", "med", 6, "No X-Frame-Options and no CSP frame-ancestors. Clickjacking protection is missing.", xfo);
      }

      if (referrer) add("referrer", "Referrer-Policy", "pass", "ok", 0, "Controls how much URL data is sent to third parties.", referrer);
      else add("referrer", "Referrer-Policy", "warn", "low", 3, "No Referrer-Policy. Browsers may leak full URLs cross-origin.", "");

      if (permissions) add("permissions", "Permissions-Policy", "pass", "ok", 0, "Sensitive browser features are explicitly scoped.", permissions);
      else add("permissions", "Permissions-Policy", "warn", "low", 3, "No Permissions-Policy. Camera, microphone and geolocation defaults are unrestricted.", "");

      if (coop) add("coop", "Cross-Origin-Opener-Policy", "pass", "ok", 0, "Process isolation against cross-window attacks.", coop);
      else add("coop", "Cross-Origin-Opener-Policy", "warn", "low", 2, "No COOP header.", "");

      if (corp) add("corp", "Cross-Origin-Resource-Policy", "pass", "ok", 0, "Restricts which origins can load this resource.", corp);
      else add("corp", "Cross-Origin-Resource-Policy", "warn", "low", 2, "No CORP header.", "");

      if (/[\/\s]\d+(?:\.\d+)+/.test(server) && !/cloudflare/i.test(server)) {
        add("server", "Server version disclosure", "warn", "low", 2, "The Server header exposes a version number. Reduce banner information.", server);
      } else if (server) {
        add("server", "Server banner", "pass", "ok", 0, "Server header does not expose a version.", server);
      } else {
        add("server", "Server banner", "pass", "ok", 0, "No Server header exposed.", "");
      }

      if (powered) add("powered", "X-Powered-By disclosure", "warn", "low", 3, "The stack is advertised in a response header. Remove it in production.", powered);
      else add("powered", "X-Powered-By disclosure", "pass", "ok", 0, "No technology disclosure in X-Powered-By.", "");

      if (cookies) {
        const cookieList = cookies.split(/\n/);
        let weakCookies = 0;
        cookieList.forEach(function (c) {
          if (!/secure/i.test(c) || !/httponly/i.test(c)) weakCookies++;
        });
        if (weakCookies) add("cookies", "Cookie flags", "warn", "med", Math.min(6, weakCookies * 2), weakCookies + " cookie(s) missing Secure and/or HttpOnly. Check SameSite as well.", clip(cookies, 240));
        else add("cookies", "Cookie flags", "pass", "ok", 0, "All observed cookies set Secure and HttpOnly.", clip(cookies, 240));
      } else {
        add("cookies", "Cookie flags", "pass", "ok", 0, "No Set-Cookie headers on the homepage response.", "");
      }

      add("https", "HTTPS", "pass", "ok", 0, "Homepage is fetched over HTTPS.", http.page && http.page.canonical ? http.page.canonical : "");
    } else {
      add("unavailable", "Header fetch unavailable", "info", "low", 0, "The public header service did not return a response. DNS and certificate data below are still valid.", "");
    }

    const deductions = checks.reduce(function (sum, c) { return sum + (c.points || 0); }, 0);
    const score = available ? Math.max(0, 100 - deductions) : null;
    const grade = score == null ? "?" : score >= 95 ? "A+" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
    const passed = checks.filter(function (c) { return c.status === "pass"; }).length;
    const total = checks.filter(function (c) { return c.status !== "info"; }).length;
    const color = score == null ? "#8b8b96" : score >= 85 ? "#4ade80" : score >= 70 ? "#fbbf24" : score >= 50 ? "#fb923c" : "#ff1f2f";

    return {
      available: available,
      grade: grade,
      score: score,
      color: color,
      passed: passed,
      total: total,
      checks: checks,
      deductions: deductions,
      rawHeaders: available ? http.headers.raw : "",
      source: available ? http.headers.source : "",
      email: emailPosture(dns)
    };
  }

  function emailPosture(dns) {
    if (!dns) return [];
    if (dns.isIP) return [];
    const out = [];
    out.push({
      label: "SPF",
      status: dns.spf && dns.spf.found ? (dns.spf.weak ? "warn" : "pass") : "warn",
      value: dns.spf && dns.spf.found ? dns.spf.all : "missing",
      detail: dns.spf && dns.spf.found ? (dns.spf.lookups + " DNS lookups · " + dns.spf.all) : "No SPF record. Anyone can spoof the domain's envelope sender."
    });
    const dm = dns.dmarc || {};
    out.push({
      label: "DMARC",
      status: dm.found ? (dm.policy === "reject" || dm.policy === "quarantine" ? "pass" : "warn") : "warn",
      value: dm.found ? ("p=" + (dm.policy || "none") + (dm.pct ? " · pct=" + dm.pct : "")) : "missing",
      detail: dm.found ? "Aggregate reports: " + (dm.rua ? "configured" : "none") : "No DMARC policy. Spoofed mail is not governed by a published policy."
    });
    out.push({
      label: "DKIM",
      status: dns.dkim && dns.dkim.found ? "pass" : "info",
      value: dns.dkim && dns.dkim.found ? dns.dkim.selectors.join(", ") : "not found",
      detail: dns.dkim && dns.dkim.found ? "DKIM public key found at the default selector." : "No key at the common selectors. A custom selector may still exist."
    });
    out.push({
      label: "DNSSEC",
      status: dns.dnssec ? "pass" : "warn",
      value: dns.dnssec ? "signed" : "unsigned",
      detail: dns.dnssec ? "The validating resolver returned the AD bit." : "DNSSEC is not validated for this zone."
    });
    out.push({
      label: "MTA-STS",
      status: dns.mtaSts ? "pass" : "info",
      value: dns.mtaSts ? "published" : "not found",
      detail: dns.mtaSts ? "SMTP MTA Strict Transport Security TXT record is live." : "Opportunistic TLS only; no MTA-STS policy detected."
    });
    out.push({
      label: "CAA",
      status: dns.caaPresent ? "pass" : "info",
      value: dns.caaPresent ? dns.caa.length + " record(s)" : "not found",
      detail: dns.caaPresent ? "Certificate Authorities are restricted by CAA." : "Any CA may issue for this domain."
    });
    out.push({
      label: "BIMI",
      status: dns.bimi ? "pass" : "info",
      value: dns.bimi ? "published" : "not found",
      detail: dns.bimi ? "A BIMI record is published." : "No BIMI record."
    });
    return out;
  }

  /* ========================= subdomain probing ========================= */

  function takeoverFor(cname) {
    if (!cname) return null;
    for (let i = 0; i < TAKEOVER_SERVICES.length; i++) {
      if (TAKEOVER_SERVICES[i].re.test(cname)) return TAKEOVER_SERVICES[i].service;
    }
    return null;
  }

  async function resolveHost(host) {
    try {
      const a = await dnsQuery(host, "A");
      const cnames = valuesFor(a, "CNAME").map(function (v) { return String(v).replace(/\.$/, "").toLowerCase(); });
      const ips = valuesFor(a, "A");
      return {
        host: host,
        status: ips.length ? "active" : cnames.length ? "cname" : "no-a",
        ips: ips.slice(0, 4),
        cname: cnames[0] || "",
        takeover: takeoverFor(cnames[0] || "")
      };
    } catch (e) {
      return { host: host, status: "error", ips: [], cname: "", takeover: null, error: shortError(e) };
    }
  }

  async function mapLimit(items, limit, worker) {
    const out = new Array(items.length);
    let index = 0;
    async function next() {
      while (index < items.length) {
        const current = index++;
        out[current] = await worker(items[current], current);
      }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
    return out;
  }

  async function collectSubdomains(ct, target) {
    const ctNames = (ct && ct.subdomains ? ct.subdomains : []).filter(function (h) { return h !== target.domain; });
    const interesting = ctNames.filter(function (h) {
      const label = h.split(".")[0];
      return INTERESTING_HOSTS.has(label) || /(^|\.)(dev|staging|test|admin|internal|vpn|git)\./i.test(h);
    }).slice(0, 10);
    const known = new Set(ctNames);
    const common = COMMON_HOSTS.filter(function (h) { return !known.has(h + "." + target.domain); }).map(function (h) { return h + "." + target.domain; });
    const probeHosts = dedupe(common.concat(interesting)).slice(0, 26);

    const probes = await mapLimit(probeHosts, 6, resolveHost);
    const active = probes.filter(function (p) { return p.status === "active" || p.status === "cname"; });
    const takeovers = probes.filter(function (p) { return !!p.takeover; });
    return {
      probes: probes.sort(function (a, b) { return (b.ips.length ? 1 : 0) - (a.ips.length ? 1 : 0) || a.host.localeCompare(b.host); }),
      active: active,
      takeovers: takeovers,
      interesting: interesting,
      probed: probes.length
    };
  }

  /* ================================ render ============================= */

  /* ------------------------------- atoms ------------------------------- */

  function statusIcon(status) {
    return status === "pass" ? "✓" : status === "warn" ? "!" : status === "fail" ? "✕" : "i";
  }

  function statusLabel(status) {
    return status === "pass" ? "PASS" : status === "warn" ? "CHECK" : status === "fail" ? "FAIL" : "INFO";
  }

  function statusClass(status) {
    return status === "pass" ? "pass" : status === "warn" ? "warn" : status === "fail" ? "fail" : "info";
  }

  function kvRows(rows) {
    return rows.filter(Boolean).map(function (row) {
      const cls = row.mono ? " class=\"mono\"" : "";
      const dot = row.dot ? "<span class=\"dot " + (row.dot === "ok" ? "" : row.dot) + "\"></span>" : "";
      return "<dt>" + esc(row.k) + "</dt><dd" + cls + ">" + dot + (row.raw ? row.v : esc(row.v == null || row.v === "" ? "—" : row.v)) + "</dd>";
    }).join("");
  }

  function gradeRing(security) {
    const score = security && security.score != null ? security.score : 0;
    const grade = security && security.grade ? security.grade : "?";
    const color = security && security.color ? security.color : "#8b8b96";
    const copy = security && security.score != null
      ? security.passed + "/" + security.total + " checks passed"
      : "headers unavailable";
    return "<div class=\"grade-ring\" data-score=\"" + score + "\" style=\"--p:0;--gc:" + color + "\"><b>" + esc(grade) + "</b></div>" +
      "<div class=\"grade-copy\">SECURITY SCORE<b>" + esc(security && security.score != null ? score + "/100 · " + copy : copy) + "</b></div>";
  }

  function checkRow(check) {
    return "<div class=\"check-row\">" +
      "<span class=\"ico " + statusClass(check.status) + "\">" + statusIcon(check.status) + "</span>" +
      "<span><b>" + esc(check.label) + "</b><small>" + esc(check.detail) + (check.value ? " <span class=\"mini\">" + esc(clip(check.value, 130)) + "</span>" : "") + "</small></span>" +
      "<span class=\"sev " + (check.status === "pass" ? "ok" : check.severity || "low") + "\">" + statusLabel(check.status) + "</span>" +
      "</div>";
  }

  function techEmpty(message) {
    return "<p class=\"tech-empty\">" + esc(message) + "</p>";
  }

  /* ------------------------------- header ------------------------------ */

  function resultHeader(result, cached) {
    const target = result.target;
    const sec = result.security || {};
    const dns = result.dns || {};
    const ct = result.ct || {};
    const http = result.http || {};
    const ip = result.ip || null;
    const tags = [];
    const status = http.status || (http.headers && http.headers.status);
    if (status) tags.push("<span class=\"" + (status >= 200 && status < 400 ? "good" : "bad") + "\">HTTP " + status + "</span>");
    else tags.push("<span>HTTP status unknown</span>");
    tags.push("<span class=\"good\">HTTPS</span>");
    if (dns.dnssec) tags.push("<span class=\"good\">DNSSEC</span>");
    else if (!target.isIP) tags.push("<span class=\"warn\">NO DNSSEC</span>");
    if (dns.spf && dns.spf.found) tags.push("<span class=\"" + (dns.spf.weak ? "warn" : "good") + "\">SPF</span>");
    else if (!target.isIP) tags.push("<span class=\"bad\">NO SPF</span>");
    if (dns.dmarc && dns.dmarc.found) tags.push("<span class=\"" + (dns.dmarc.policy === "reject" || dns.dmarc.policy === "quarantine" ? "good" : "warn") + "\">DMARC</span>");
    else if (!target.isIP) tags.push("<span class=\"bad\">NO DMARC</span>");
    if (ct.available) tags.push("<span>CT · " + ct.entries + " certs</span>");
    if (ip && ip.countryCode) tags.push("<span>" + esc(ip.country && ip.country !== ip.countryCode ? ip.countryCode + " · " + ip.country : ip.countryCode) + "</span>");
    if (cached) tags.push("<span class=\"warn\">CACHED · " + esc(timeAgo(result.meta.finishedAt)) + "</span>");

    const favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(target.host) + "&sz=64";
    const displayUrl = result.target.url;
    return "<div class=\"rr-head\">" +
      "<div class=\"rr-favicon\"><img src=\"" + favicon + "\" alt=\"\" width=\"26\" height=\"26\" loading=\"lazy\" /></div>" +
      "<div class=\"rr-identity\">" +
        "<div class=\"rr-domain\">" + esc(target.domain) + "</div>" +
        "<a class=\"rr-url\" href=\"" + safeHttp(displayUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + esc(displayUrl) + "</a>" +
        "<div class=\"rr-tags\">" + tags.join("") + "</div>" +
      "</div>" +
      "<div class=\"rr-grade\">" + gradeRing(sec) + "</div>" +
    "</div>" +
    "<div class=\"rr-actions\">" +
      "<button type=\"button\" data-act=\"export-json\">↓ JSON</button>" +
      "<button type=\"button\" data-act=\"export-md\">↓ Markdown</button>" +
      "<button type=\"button\" data-act=\"copy\">Copy summary</button>" +
      "<button type=\"button\" data-act=\"rescan\">↻ Rescan</button>" +
      "<a href=\"" + safeHttp(displayUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">Open site ↗</a>" +
    "</div>" +
    "<div class=\"rr-cards\">" + statCards(result) + "</div>";
  }

  function statCards(result) {
    const dns = result.dns || {};
    const rdap = result.rdap || {};
    const ct = result.ct || {};
    const ip = result.ip || {};
    const ipAddress = dns.a && dns.a[0] ? dns.a[0] : result.target.isIP ? result.target.host : "—";
    const asn = ip.asn ? "AS" + String(ip.asn).replace(/^AS/i, "") : "—";
    const hosting = hostingFrom(ip);
    const tlsIssuer = ct.issuers && ct.issuers.length
      ? ct.issuers[0]
      : (ct.available && ct.entries === 0 ? "No exact-name cert" : "—");
    const dnsProvider = dns.dnsProvider || "—";
    const registered = rdap.registered || "";
    const expires = rdap.expires || "";
    const cards = [
      { k: "IP ADDRESS", v: ipAddress, s: ip.country ? ip.country + (ip.city ? " · " + ip.city : "") : (dns.aaaa && dns.aaaa[0] ? "IPv6 · " + dns.aaaa[0] : "resolved address") },
      { k: "NETWORK", v: asn, s: ip.org || ip.isp || "ASN lookup" },
      { k: "HOSTING / EDGE", v: hosting, s: ip.domain || "from ASN + fingerprints" },
      { k: "TLS ISSUER", v: tlsIssuer, s: ct.available ? (ct.entries ? ct.entries + " CT certificate(s)" : "shared wildcard / no exact match") : "CT unavailable" },
      { k: "DNS PROVIDER", v: dnsProvider, s: dns.ns && dns.ns.length ? dns.ns[0] : (dns.isIP ? "IP target" : "nameserver lookup") },
      { k: "DOMAIN AGE", v: registered ? ageLabel(registered) : "—", s: registered ? (rdap.queried && rdap.queried !== result.target.host ? rdap.queried + " · " : "") + "since " + dateLabel(registered) + (expires ? " · expires " + dateLabel(expires) : "") : (result.target.isIP ? "IP target" : "RDAP unavailable") }
    ];
    return cards.map(function (c) {
      return "<div class=\"rr-card\"><span>" + esc(c.k) + "</span><b title=\"" + esc(c.v) + "\">" + esc(c.v) + "</b><small title=\"" + esc(c.s) + "\">" + esc(c.s) + "</small></div>";
    }).join("");
  }

  /* ------------------------------- tabs -------------------------------- */

  function tabsMarkup(result) {
    const tabs = [
      ["overview", "Overview"], ["dns", "DNS & Email"], ["tech", "Tech Stack"],
      ["headers", "Headers"], ["subdomains", "Subdomains" + (result.ct && result.ct.subdomains && result.ct.subdomains.length ? " · " + result.ct.subdomains.length : "")],
      ["page", "Page"], ["raw", "Raw"]
    ];
    return "<div class=\"rr-tabs\" role=\"tablist\" aria-label=\"Recon results\">" + tabs.map(function (t, i) {
      return "<button type=\"button\" class=\"rr-tab" + (i === 0 ? " on" : "") + "\" data-tab=\"" + t[0] + "\" role=\"tab\" aria-selected=\"" + (i === 0 ? "true" : "false") + "\">" + esc(t[1]) + "</button>";
    }).join("") + "</div>";
  }

  function panelMarkup(result) {
    return "<div class=\"rr-panel on\" data-panel=\"overview\">" + overviewPanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"dns\">" + dnsPanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"tech\">" + techPanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"headers\">" + headersPanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"subdomains\">" + subdomainsPanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"page\">" + pagePanel(result) + "</div>" +
      "<div class=\"rr-panel\" data-panel=\"raw\">" + rawPanel(result) + "</div>";
  }

  /* ----------------------------- overview ------------------------------ */

  function overviewPanel(result) {
    const target = result.target;
    const dns = result.dns || {};
    const rdap = result.rdap || {};
    const ct = result.ct || {};
    const ip = result.ip || {};
    const page = result.page || {};
    const http = result.http || {};
    const well = result.wellKnown || {};
    const sec = result.security || { checks: [], email: [] };
    const issues = (sec.checks || []).filter(function (c) { return c.status === "fail" || c.status === "warn"; }).slice(0, 5);
    const email = (sec.email || []).slice(0, 5);
    const server = http.headers && http.headers.map ? http.headers.map.server || "" : "";
    const powered = http.headers && http.headers.map ? http.headers.map["x-powered-by"] || "" : "";

    const profileRows = [
      { k: "Final URL", v: target.url, mono: true },
      { k: "HTTP status", v: http.status || (http.headers && http.headers.status) ? String(http.status || http.headers.status) : (http.errors && http.errors.length ? "fetch issue" : "unknown"), dot: (http.status || (http.headers && http.headers.status)) && (http.status || http.headers.status) < 400 ? "ok" : "warn" },
      { k: "Page title", v: page.title || "—" },
      { k: "Server", v: server || "not exposed" },
      { k: "Powered by", v: powered || "not exposed" },
      { k: "Registrar", v: rdap.registrar || "—" },
      { k: "Registered domain", v: rdap.queried || target.registrable || target.domain },
      { k: "Registered", v: rdap.registered ? dateLabel(rdap.registered) : "—" },
      { k: "Expires", v: rdap.expires ? dateLabel(rdap.expires) : "—" },
      { k: "Nameservers", v: dns.ns && dns.ns.length ? dns.ns.join(" · ") : "—" },
      { k: "Mail provider", v: dns.mailProvider || "—" },
      { k: "IP address", v: dns.a && dns.a.length ? dns.a.slice(0, 2).join(" · ") : target.isIP ? target.host : "—", mono: true },
      { k: "ASN", v: ip.asn ? "AS" + String(ip.asn).replace(/^AS/i, "") + (ip.org ? " · " + ip.org : "") : "—" },
      { k: "TLS issuer", v: ct.available && ct.issuers && ct.issuers.length ? ct.issuers[0] : "—" },
      { k: "Certificate first seen", v: ct.earliest ? dateLabel(ct.earliest) : "—" }
    ];

    const securityBlock = sec.available
      ? "<div class=\"rr-score\" style=\"--gc:" + sec.color + "\"><span class=\"big\">" + esc(sec.grade) + "</span><p><b>" + sec.score + "/100</b> · " + sec.passed + "/" + sec.total + " header checks passed. " + (issues.length ? "Top gaps are listed below." : "No material header gaps detected.") + "</p></div>" +
        (issues.length ? "<div style=\"display:grid;gap:6px\">" + issues.map(checkRow).join("") + "</div>" : "<p class=\"rr-note\">No failing or warning-level header checks.</p>")
      : "<p class=\"rr-note\">The public header service was unavailable, so the HTTP grade is not scored. DNS, RDAP and Certificate Transparency data below are still live.</p>";

    const emailList = email.length
      ? "<ul class=\"rr-list\">" + email.map(function (e) {
          return "<li><span class=\"ico " + statusClass(e.status) + "\">" + statusIcon(e.status) + "</span><span><b>" + esc(e.label) + "</b> — " + esc(e.detail) + " <span class=\"mini\">" + esc(e.value) + "</span></span></li>";
        }).join("") + "</ul>"
      : "<p class=\"rr-note\">Email posture is not applicable to this target.</p>";

    const exposure = [];
    if (ct.available) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#8b5cf6\">CT</i>" + ct.subdomains.length + " unique names</span>");
    if (result.subdomains) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#0ea5e9\">DNS</i>" + result.subdomains.active.length + " live probes</span>");
    if (result.subdomains && result.subdomains.takeovers.length) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#ff1f2f\">!</i>" + result.subdomains.takeovers.length + " CNAME review</span>");
    if (well.securityTxt && well.securityTxt.found) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#4ade80\">TXT</i>security.txt</span>");
    if (well.robots && well.robots.found) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#4ade80\">RB</i>robots.txt</span>");
    if (dns.caaPresent) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#4ade80\">CA</i>CAA present</span>");
    else if (!target.isIP) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#fbbf24\">CA</i>no CAA</span>");
    if (page.mixedContent && page.mixedContent.length) exposure.push("<span class=\"tech-chip\"><i style=\"--tc:#ff1f2f\">!</i>" + page.mixedContent.length + " mixed resources</span>");

    return "<div class=\"rr-grid\">" +
      "<div class=\"rr-section\"><h4>Target profile <span class=\"tag\">PASSIVE OSINT</span></h4><dl class=\"rr-kv\">" + kvRows(profileRows) + "</dl></div>" +
      "<div class=\"rr-section\"><h4>Security posture <span class=\"tag\">HTTP + EMAIL</span></h4>" + securityBlock +
        "<h4 style=\"margin:16px 0 9px\">Email &amp; DNS</h4>" + emailList + "</div>" +
    "</div>" +
    "<div class=\"rr-section\" style=\"margin-top:14px\"><h4>Exposure summary <span class=\"tag\">PUBLIC SURFACE</span></h4>" +
      (exposure.length ? "<div class=\"tech-chips\">" + exposure.join("") + "</div>" : "<p class=\"rr-note\">No additional exposure notes.</p>") +
      "<p class=\"rr-note\">Everything here came from public DNS, RDAP, Certificate Transparency, the site's own homepage and public header data. No intrusive requests were made.</p>" +
    "</div>";
  }

  /* -------------------------------- DNS -------------------------------- */

  function dnsPanel(result) {
    const dns = result.dns || {};
    const rdap = result.rdap || {};
    const sec = result.security || {};
    const rows = [];
    const push = function (type, values, label) {
      if (!values || !values.length) return;
      values.forEach(function (v, i) {
        rows.push({
          type: i === 0 ? type : "",
          name: label || "",
          value: String(v),
          ttl: ""
        });
      });
    };
    push("A", dns.a);
    push("AAAA", dns.aaaa);
    push("NS", dns.ns);
    push("MX", (dns.mx || []).map(function (m) { return m.pref + "  " + m.host; }));
    push("TXT", dns.txt);
    push("CAA", dns.caa);
    push("SOA", dns.soa);

    const table = rows.length
      ? "<div class=\"rr-table-wrap\"><table class=\"rr-table\"><thead><tr><th>Type</th><th>Value</th></tr></thead><tbody>" + rows.map(function (r) {
          return "<tr><td class=\"mono\">" + esc(r.type) + "</td><td class=\"mono\" title=\"" + esc(r.value) + "\">" + esc(clip(r.value, 190)) + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class=\"rr-note\">No DNS records returned for this target.</p>";

    const emailChecks = sec.email && sec.email.length
      ? sec.email.map(function (e) {
          return "<div class=\"check-row\"><span class=\"ico " + statusClass(e.status) + "\">" + statusIcon(e.status) + "</span><span><b>" + esc(e.label) + " · " + esc(e.value) + "</b><small>" + esc(e.detail) + "</small></span><span class=\"sev " + (e.status === "pass" ? "ok" : e.status === "warn" ? "med" : "low") + "\">" + statusLabel(e.status) + "</span></div>";
        }).join("")
      : "<p class=\"rr-note\">Email posture is not applicable.</p>";

    const rdapRows = [
      { k: "Registrar", v: rdap.registrar || "—" },
      { k: "Registered domain", v: rdap.queried || (result.target && result.target.registrable) || "—", mono: true },
      { k: "RDAP handle", v: rdap.handle || "—", mono: true },
      { k: "Registered", v: rdap.registered ? dateLabel(rdap.registered) : "—" },
      { k: "Expires", v: rdap.expires ? dateLabel(rdap.expires) + " (" + untilLabel(rdap.expires) + ")" : "—" },
      { k: "Last changed", v: rdap.changed ? dateLabel(rdap.changed) : "—" },
      { k: "Status", v: (rdap.status || []).join(", ") || "—" },
      { k: "Nameservers", v: (rdap.nameservers || []).join(" · ") || "—" },
      { k: "DNSSEC", v: dns.dnssec ? "validated (AD bit)" : "unsigned", dot: dns.dnssec ? "ok" : "warn" }
    ];
    const nsNote = dns.nsDomain && result.target && dns.nsDomain !== result.target.host
      ? "<p class=\"rr-note\">NS and SOA records are published by the registrable domain <b>" + esc(dns.nsDomain) + "</b>.</p>"
      : "";

    return "<div class=\"rr-grid\">" +
      "<div class=\"rr-section\"><h4>DNS records <span class=\"tag\">GOOGLE DoH</span></h4>" + table + nsNote + "</div>" +
      "<div class=\"rr-section\"><h4>Email security <span class=\"tag\">SPF · DMARC · DKIM</span></h4><div style=\"display:grid;gap:6px\">" + emailChecks + "</div>" +
        "<p class=\"rr-note\">Mail provider: <b>" + esc(dns.mailProvider || "—") + "</b> · " + (dns.mx ? dns.mx.length : 0) + " MX record(s).</p></div>" +
    "</div>" +
    "<div class=\"rr-section\" style=\"margin-top:14px\"><h4>Registration &amp; delegation <span class=\"tag\">RDAP</span></h4><dl class=\"rr-kv\">" + kvRows(rdapRows) + "</dl></div>";
  }

  /* -------------------------------- tech ------------------------------- */

  function techPanel(result) {
    const tech = result.tech || [];
    const groups = [];
    CATEGORY_ORDER.forEach(function (cat) {
      const items = tech.filter(function (t) { return t.cat === cat; });
      if (items.length) groups.push({ cat: cat, items: items });
    });
    tech.forEach(function (t) {
      if (CATEGORY_ORDER.indexOf(t.cat) === -1 && !groups.some(function (g) { return g.cat === t.cat; })) {
        groups.push({ cat: t.cat, items: tech.filter(function (x) { return x.cat === t.cat; }) });
      }
    });

    const grid = groups.length
      ? "<div class=\"tech-groups\">" + groups.map(function (g) {
          return "<div class=\"tech-group\"><h5>" + esc(g.cat) + " <span>" + g.items.length + "</span></h5><div class=\"tech-chips\">" + g.items.map(function (t) {
            return "<span class=\"tech-chip\" title=\"Detected via " + esc(t.source) + "\"><i style=\"--tc:" + esc(t.color) + "\">" + esc(t.icon) + "</i>" + esc(t.name) + "<small>" + esc(t.source) + "</small></span>";
          }).join("") + "</div></div>";
        }).join("") + "</div>"
      : techEmpty(result.page ? "No fingerprints matched. The site may use a custom stack or block automated readers." : "Homepage HTML could not be fetched, so HTML fingerprints were skipped. Header and DNS fingerprints are still included.");

    const notes = [];
    if (result.http && result.http.htmlSource) notes.push("HTML via " + result.http.htmlSource);
    if (result.http && result.http.errors && result.http.errors.length) notes.push(result.http.errors.length + " fetch issue(s)");
    if (result.dns && result.dns.dnssec) notes.push("DNSSEC validated");
    return "<div class=\"rr-section\"><h4>Detected stack <span class=\"tag\">" + tech.length + " FINGERPRINTS</span></h4>" + grid +
      "<p class=\"rr-note\">" + esc(notes.length ? notes.join(" · ") : "Fingerprints combine HTML, response headers, cookies, DNS and the hostname.") + " Detection is heuristic — verify before relying on it.</p></div>";
  }

  /* ------------------------------ headers ------------------------------ */

  function headersPanel(result) {
    const sec = result.security || { checks: [], available: false };
    const checks = sec.checks || [];
    const raw = sec.rawHeaders || "";
    const list = checks.length
      ? "<div style=\"display:grid;gap:6px\">" + checks.map(checkRow).join("") + "</div>"
      : "<p class=\"rr-note\">No header checks were possible.</p>";
    const scoreBlock = sec.available
      ? "<div class=\"rr-score\" style=\"--gc:" + sec.color + "\"><span class=\"big\">" + esc(sec.grade) + "</span><p><b>" + sec.score + "/100</b> · " + sec.passed + "/" + sec.total + " checks passed. Score = 100 minus weighted deductions. CSP 14 · HSTS 12 · framing 6 · nosniff 5 · cookie flags 6.</p></div>"
      : "<div class=\"rr-score\" style=\"--gc:#8b8b96\"><span class=\"big\">?</span><p><b>Unscored.</b> The public header service did not return a response for this target. Try a rescan in a moment.</p></div>";

    return "<div class=\"rr-section\"><h4>Header audit <span class=\"tag\">" + (sec.available ? esc(sec.source || "HTTP") : "NO RESPONSE") + "</span></h4>" + scoreBlock + list +
      "<p class=\"rr-note\">Grading is relative, not absolute: it reflects missing defensive headers on the homepage response, not a penetration test.</p></div>" +
      "<div class=\"rr-grid\" style=\"margin-top:14px\">" +
        "<div class=\"rr-section\"><h4>Raw headers <span class=\"tag\">CAPTURED</span></h4><pre class=\"rr-raw\">" + esc(raw || "No headers captured.") + "</pre></div>" +
        "<div class=\"rr-section\"><h4>Cookie flags <span class=\"tag\">Set-Cookie</span></h4><p class=\"rr-note\">" + (sec.available && /set-cookie/i.test(raw) ? "Cookies were observed. Flags are evaluated in the audit above." : "No Set-Cookie header was present on the homepage response, or headers were unavailable.") + "</p>" +
          "<h4 style=\"margin-top:14px\">Quick fixes</h4><ul class=\"rr-list\">" +
            "<li><span class=\"ico pass\">✓</span><span>Add <b>Strict-Transport-Security</b> with a one-year max-age.</span></li>" +
            "<li><span class=\"ico pass\">✓</span><span>Ship a <b>Content-Security-Policy</b> without unsafe-inline/eval.</span></li>" +
            "<li><span class=\"ico pass\">✓</span><span>Set <b>X-Content-Type-Options: nosniff</b> and a framing policy.</span></li>" +
            "<li><span class=\"ico pass\">✓</span><span>Remove version banners from <b>Server</b> and <b>X-Powered-By</b>.</span></li>" +
          "</ul></div>" +
      "</div>";
  }

  /* ---------------------------- subdomains ----------------------------- */

  function subdomainsPanel(result) {
    const ct = result.ct || {};
    const subs = result.subdomains || { probes: [], active: [], takeovers: [], interesting: [] };
    const names = ct.subdomains || [];
    const shown = names.slice(0, 140);
    const chips = shown.length
      ? "<div class=\"subdomains\">" + shown.map(function (h) {
          const label = h.split(".")[0];
          const interesting = INTERESTING_HOSTS.has(label) || /(^|\.)(dev|staging|test|admin|internal|vpn|git)\./i.test(h);
          return "<span class=\"" + (interesting ? "interesting" : "") + "\" title=\"" + esc(h) + "\">" + esc(h) + "</span>";
        }).join("") + "</div>"
      : "<p class=\"rr-note\">" + esc(ct.note || "No subdomains were returned by Certificate Transparency.") + "</p>";

    const probes = subs.probes && subs.probes.length
      ? "<div class=\"rr-table-wrap\"><table class=\"rr-table\"><thead><tr><th>Host</th><th>DNS</th><th>CNAME</th><th>Address</th><th>Risk</th></tr></thead><tbody>" + subs.probes.map(function (p) {
          const risk = p.takeover ? "<span class=\"sev high\">review · " + esc(p.takeover) + "</span>" : p.status === "active" ? "<span class=\"sev ok\">live</span>" : p.status === "cname" ? "<span class=\"sev low\">cname</span>" : "<span class=\"sev low\">" + esc(p.status) + "</span>";
          return "<tr><td class=\"mono\">" + esc(p.host) + "</td><td><span class=\"mini\">" + esc(p.status) + "</span></td><td class=\"mono\">" + esc(p.cname || "—") + "</td><td class=\"mono\">" + esc((p.ips || []).join(", ") || "—") + "</td><td>" + risk + "</td></tr>";
        }).join("") + "</tbody></table></div>"
      : "<p class=\"rr-note\">No common-host probes were resolved. DNS may be filtered or the target may not publish records for these names.</p>";

    const takeovers = subs.takeovers && subs.takeovers.length
      ? "<div class=\"rr-section\" style=\"margin-top:14px\"><h4>Takeover review <span class=\"tag\">CNAME HEURISTIC</span></h4><ul class=\"rr-list\">" + subs.takeovers.map(function (p) {
          return "<li><span class=\"ico warn\">!</span><span><b>" + esc(p.host) + "</b> points at <b>" + esc(p.takeover) + "</b> via <span class=\"mini\">" + esc(p.cname) + "</span>. Confirm the backing service is still claimed; this is a review signal, not a confirmed takeover.</span></li>";
        }).join("") + "</ul></div>"
      : "<p class=\"rr-note\" style=\"margin-top:10px\">No known takeover-prone CNAME targets were found in the probed names.</p>";

    return "<div class=\"rr-section\"><h4>Certificate Transparency <span class=\"tag\">" + esc(ct.source || "CERT SPOTTER") + "</span></h4>" +
      "<dl class=\"rr-kv\">" +
        kvRows([
          { k: "Certificates", v: ct.available ? ct.entries + " issuance(s)" : "unavailable" },
          { k: "Unique names", v: ct.available ? names.length + (ct.truncated ? "+" : "") : "—" },
          { k: "First seen", v: ct.earliest ? dateLabel(ct.earliest) : "—" },
          { k: "Latest", v: ct.latest ? dateLabel(ct.latest) : "—" },
          { k: "Issuers", v: (ct.issuers || []).join(" · ") || "—" },
          { k: "Probed", v: subs.probed ? subs.probed + " host(s), " + subs.active.length + " live" : "—" }
        ]) +
      "</dl><div style=\"margin-top:12px\">" + chips + "</div>" + takeovers + "</div>" +
      "<div class=\"rr-section\" style=\"margin-top:14px\"><h4>Common host probes <span class=\"tag\">DoH · PASSIVE</span></h4>" + probes +
        "<p class=\"rr-note\">Probes resolve A/CNAME records for common hostnames and interesting CT names. No HTTP requests are sent to subdomains.</p></div>";
  }

  /* -------------------------------- page ------------------------------- */

  function pagePanel(result) {
    const page = result.page;
    if (!page) {
      return "<div class=\"rr-section\"><h4>Homepage metadata <span class=\"tag\">UNAVAILABLE</span></h4><p class=\"rr-note\">The homepage HTML could not be fetched by any public reader. DNS, RDAP, certificates and headers above are unaffected.</p></div>";
    }
    const favicon = "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(result.target.host) + "&sz=64";
    const stats = [
      { k: "Page size", v: page.htmlBytes ? Math.round(page.htmlBytes / 1024) + " KB" : "—" },
      { k: "Text length", v: page.textLength ? page.textLength.toLocaleString() + " chars" : "—" },
      { k: "H1 / H2 / H3", v: page.h1 + " / " + page.h2 + " / " + page.h3 },
      { k: "Links", v: String(page.links) },
      { k: "External hosts", v: String(page.externalDomains.length) },
      { k: "Images", v: page.images + (page.missingAlt ? " · " + page.missingAlt + " no alt" : "") },
      { k: "Scripts", v: page.scripts + " · " + page.inlineScripts + " inline" },
      { k: "Forms / iframes", v: page.forms + " / " + page.iframes },
      { k: "Mixed content", v: page.mixedContent.length ? page.mixedContent.length + " http:// resource(s)" : "none" },
      { k: "Service worker", v: page.hasServiceWorker ? "registered" : "not detected" }
    ];
    const social = [
      ["og:title", page.ogTitle], ["og:description", page.ogDescription], ["og:image", page.ogImage],
      ["og:type", page.ogType], ["twitter:card", page.twitterCard], ["twitter:site", page.twitterSite]
    ].filter(function (x) { return x[1]; });
    return "<div class=\"rr-section\"><h4>Homepage <span class=\"tag\">" + esc(result.http && result.http.htmlSource || "READER") + "</span></h4>" +
      "<div class=\"rr-page\"><div><h5>" + esc(page.title || "(no title)") + "</h5><p>" + esc(page.description || "No meta description.") + "</p>" +
        "<p class=\"rr-note\">" + esc(page.canonical || result.target.url) + "</p></div><div class=\"site-badge\"><img src=\"" + favicon + "\" alt=\"\" loading=\"lazy\" /></div></div>" +
      "<div class=\"rr-cards\" style=\"grid-template-columns:repeat(auto-fit,minmax(108px,1fr));margin-bottom:0\">" + stats.map(function (s) {
        return "<div class=\"rr-card\"><span>" + esc(s.k) + "</span><b title=\"" + esc(s.v) + "\">" + esc(s.v) + "</b></div>";
      }).join("") + "</div></div>" +
      "<div class=\"rr-grid\" style=\"margin-top:14px\">" +
        "<div class=\"rr-section\"><h4>Metadata <span class=\"tag\">HTML</span></h4><dl class=\"rr-kv\">" + kvRows([
          { k: "Lang", v: page.lang || "—" },
          { k: "Viewport", v: page.viewport || "—" },
          { k: "Generator", v: page.generator || "not exposed" },
          { k: "Theme color", v: page.themeColor || "—" },
          { k: "Canonical", v: page.canonical || "—", mono: true },
          { k: "Copyright", v: page.copyright || "—" }
        ]) + "</dl>" +
        (page.externalDomains.length ? "<h4 style=\"margin-top:14px\">External hosts <span class=\"tag\">" + page.externalDomains.length + "</span></h4><div class=\"tech-chips\">" + page.externalDomains.slice(0, 20).map(function (d) { return "<span class=\"tech-chip\">" + esc(d) + "</span>"; }).join("") + "</div>" : "") +
        "</div>" +
        "<div class=\"rr-section\"><h4>Social cards <span class=\"tag\">OPEN GRAPH</span></h4>" +
          (social.length ? "<dl class=\"rr-kv\">" + kvRows(social.map(function (x) { return { k: x[0], v: x[1] }; })) + "</dl>" : "<p class=\"rr-note\">No Open Graph or Twitter card metadata found.</p>") +
          "<h4 style=\"margin-top:14px\">Body preview</h4><p class=\"rr-note\">" + esc(clip(page.bodyText || "No readable body text.", 600)) + "</p>" +
        "</div>" +
      "</div>";
  }

  /* -------------------------------- raw -------------------------------- */

  function buildExport(result) {
    const copy = JSON.parse(JSON.stringify(result));
    if (copy.ct && copy.ct.subdomains) copy.ct.subdomains = copy.ct.subdomains.slice(0, 300);
    if (copy.subdomains && copy.subdomains.probes) copy.subdomains.probes = copy.subdomains.probes.slice(0, 60);
    if (copy.page) {
      copy.page.bodyText = clip(copy.page.bodyText || "", 300);
      copy.page.externalDomains = (copy.page.externalDomains || []).slice(0, 30);
    }
    copy.meta = Object.assign({}, copy.meta || {}, { exportedAt: new Date().toISOString(), tool: "ReconLab", version: VERSION });
    return copy;
  }

  function rawPanel(result) {
    const json = JSON.stringify(buildExport(result), null, 2);
    return "<div class=\"rr-section\"><h4>Raw report <span class=\"tag\">JSON</span></h4><pre class=\"rr-raw\">" + esc(json) + "</pre>" +
      "<p class=\"rr-note\">Use the export buttons above to download this report. Page HTML is intentionally not stored; only derived metadata is included.</p></div>";
  }

  /* ------------------------------ actions ------------------------------ */

  function markdownFor(result) {
    const target = result.target;
    const dns = result.dns || {};
    const rdap = result.rdap || {};
    const ct = result.ct || {};
    const ip = result.ip || {};
    const page = result.page || {};
    const http = result.http || {};
    const sec = result.security || { checks: [], email: [] };
    const subs = result.subdomains || { probes: [], takeovers: [] };
    const md = function (v) { return String(v == null || v === "" ? "—" : v).replace(/\|/g, "\\|").replace(/\r?\n/g, " "); };
    const lines = [];
    lines.push("# Passive recon — " + target.domain);
    lines.push("");
    lines.push("> Generated " + new Date().toLocaleString() + " by ReconLab. Public, read-only sources: Google DNS, RDAP, Cert Spotter, IP geolocation APIs, HackerTarget and the target's homepage. No intrusive testing.");
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push("| URL | " + md(target.url) + " |");
    lines.push("| HTTP status | " + md(http.status || (http.headers && http.headers.status)) + " |");
    lines.push("| IP | " + md((dns.a || []).join(", ")) + " |");
    lines.push("| ASN / org | " + md((ip.asn ? "AS" + String(ip.asn).replace(/^AS/i, "") + " · " : "") + (ip.org || "")) + " |");
    lines.push("| Hosting | " + md(hostingFrom(ip)) + " |");
    lines.push("| Registrar | " + md(rdap.registrar) + " |");
    lines.push("| Registered | " + md(rdap.registered ? dateLabel(rdap.registered) : "—") + " |");
    lines.push("| Expires | " + md(rdap.expires ? dateLabel(rdap.expires) : "—") + " |");
    lines.push("| DNS provider | " + md(dns.dnsProvider) + " |");
    lines.push("| Mail provider | " + md(dns.mailProvider) + " |");
    lines.push("| CT certificates | " + md(ct.available ? ct.entries : "unavailable") + " |");
    lines.push("| Security grade | " + md(sec.available ? sec.grade + " (" + sec.score + "/100)" : "unscored") + " |");
    lines.push("");
    lines.push("## DNS");
    lines.push("");
    lines.push("| Type | Value |");
    lines.push("|---|---|");
    [["A", dns.a], ["AAAA", dns.aaaa], ["NS", dns.ns], ["MX", (dns.mx || []).map(function (m) { return m.pref + " " + m.host; })], ["TXT", dns.txt], ["CAA", dns.caa], ["SOA", dns.soa]].forEach(function (pair) {
      (pair[1] || []).forEach(function (v) { lines.push("| " + pair[0] + " | " + md(v) + " |"); });
    });
    lines.push("");
    lines.push("## Email security");
    lines.push("");
    (sec.email || []).forEach(function (e) {
      lines.push("- **" + e.label + "** — " + e.value + " (" + e.status + "): " + e.detail);
    });
    lines.push("");
    lines.push("## Tech stack");
    lines.push("");
    (result.tech || []).forEach(function (t) { lines.push("- " + t.name + " — " + t.cat + " (" + t.source + ")"); });
    lines.push("");
    lines.push("## Security headers");
    lines.push("");
    lines.push("| Check | Status | Detail |");
    lines.push("|---|---|---|");
    (sec.checks || []).forEach(function (c) { lines.push("| " + md(c.label) + " | " + c.status + " | " + md(c.detail + (c.value ? " — " + c.value : "")) + " |"); });
    lines.push("");
    lines.push("## Subdomains");
    lines.push("");
    if (ct.available) {
      lines.push("Certificate Transparency returned **" + ct.entries + "** issuance(s) and **" + (ct.subdomains || []).length + "** unique names.");
      lines.push("");
      (ct.subdomains || []).slice(0, 100).forEach(function (s) { lines.push("- " + s); });
      if ((ct.subdomains || []).length > 100) lines.push("- … " + (ct.subdomains.length - 100) + " more");
      lines.push("");
      lines.push("Takeover review candidates: " + (subs.takeovers && subs.takeovers.length ? subs.takeovers.map(function (t) { return t.host + " → " + t.takeover; }).join(", ") : "none"));
    } else {
      lines.push("Certificate Transparency unavailable for this target.");
    }
    lines.push("");
    lines.push("## Page");
    lines.push("");
    lines.push("- Title: " + md(page.title));
    lines.push("- Description: " + md(page.description));
    lines.push("- Lang: " + md(page.lang) + " · H1: " + (page.h1 || 0) + " · Links: " + (page.links || 0) + " · Scripts: " + (page.scripts || 0));
    lines.push("- Mixed content: " + ((page.mixedContent || []).length ? page.mixedContent.length + " resource(s)" : "none"));
    lines.push("");
    lines.push("---");
    lines.push("_Generated by ReconLab · passive OSINT only._");
    return lines.join("\n");
  }

  function summaryFor(result) {
    const d = result.target.domain;
    const dns = result.dns || {};
    const ip = result.ip || {};
    const sec = result.security || {};
    const ct = result.ct || {};
    return d + " · " + (dns.a && dns.a[0] ? dns.a[0] : "no A record") + " · " +
      (ip.asn ? "AS" + String(ip.asn).replace(/^AS/i, "") : "unknown ASN") + " · " +
      (sec.available ? "security " + sec.grade + " (" + sec.score + "/100)" : "security unscored") + " · " +
      (ct.available ? ct.subdomains.length + " CT names" : "CT unavailable");
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/[^a-z0-9._-]+/gi, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyText(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { notify(message || "Copied."); }, function () { fallbackCopy(text, message); });
    } else {
      fallbackCopy(text, message);
    }
  }

  function fallbackCopy(text, message) {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); notify(message || "Copied."); } catch (e) { notify("Copy failed — select the raw report instead."); }
    area.remove();
  }

  function handleAction(action, result) {
    if (action === "export-json") {
      download(result.target.host + "-recon.json", JSON.stringify(buildExport(result), null, 2), "application/json");
      notify("JSON report downloaded.");
    } else if (action === "export-md") {
      download(result.target.host + "-recon.md", markdownFor(result), "text/markdown");
      notify("Markdown report downloaded.");
    } else if (action === "copy") {
      copyText(summaryFor(result), "Summary copied.");
    } else if (action === "rescan") {
      scan(result.target.host, { force: true });
    }
  }

  function bindResults(result) {
    const root = state.els.results;
    root.querySelectorAll(".rr-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        const id = tab.getAttribute("data-tab");
        root.querySelectorAll(".rr-tab").forEach(function (t) {
          const on = t === tab;
          t.classList.toggle("on", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        root.querySelectorAll(".rr-panel").forEach(function (p) {
          p.classList.toggle("on", p.getAttribute("data-panel") === id);
        });
      });
    });
    root.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function () { handleAction(btn.getAttribute("data-act"), result); });
    });
    requestAnimationFrame(function () {
      root.querySelectorAll(".grade-ring").forEach(function (ring) {
        const score = Number(ring.getAttribute("data-score")) || 0;
        ring.style.setProperty("--p", Math.max(0, Math.min(100, score)));
      });
    });
  }

  function renderResult(result, cached) {
    const els = state.els;
    if (!els) return;
    state.current = result;
    els.empty.hidden = true;
    els.scanning.hidden = true;
    els.results.hidden = false;
    els.results.innerHTML = resultHeader(result, cached) + tabsMarkup(result) + panelMarkup(result) +
      "<div class=\"rr-foot\"><span>Scanned " + esc(dateLabel(result.meta.finishedAt)) + " at " + esc(new Date(result.meta.finishedAt).toLocaleTimeString()) + " · " + esc(durationLabel(result.meta.elapsedMs)) + " · passive only</span><span>" +
      (cached ? "Served from local cache · 10 minute TTL" : "Fresh scan · cached locally for 10 minutes") + "</span></div>";
    bindResults(result);
    els.shell.classList.add("has-result");
  }

  /* ----------------------------- scan engine --------------------------- */

  function collectEls() {
    const form = document.getElementById("reconForm");
    if (!form) return null;
    const byId = function (id) { return document.getElementById(id); };
    return {
      shell: byId("reconShell"),
      form: form,
      input: byId("reconInput"),
      run: byId("reconRun"),
      quick: byId("reconQuick"),
      history: byId("reconHistory"),
      empty: byId("reconEmpty"),
      scanning: byId("reconScanning"),
      results: byId("reconResults"),
      log: byId("scanLog"),
      target: byId("scanTarget"),
      bar: byId("scanProgressBar"),
      label: byId("scanProgressLabel"),
      percent: byId("scanPercent"),
      elapsed: byId("scanElapsed"),
      stage: byId("reconStage")
    };
  }

  function logLine(text, cls) {
    if (!state.els || !state.els.log) return;
    const el = document.createElement("div");
    if (cls) el.className = cls;
    const now = ((performance.now() - state.started) / 1000).toFixed(1);
    el.textContent = "[" + now.padStart(5, " ") + "s] " + text;
    state.els.log.appendChild(el);
    state.logCount++;
    if (state.logCount > 220) {
      const first = state.els.log.firstElementChild;
      if (first) first.remove();
    }
    state.els.log.scrollTop = state.els.log.scrollHeight;
  }

  function advance(value, label) {
    if (!state.els) return;
    if (value > state.progress) {
      state.progress = pct(value);
      state.els.bar.style.width = state.progress + "%";
      state.els.percent.textContent = state.progress + "%";
    }
    if (label && (value >= state.progress || !state.els.label.textContent)) {
      state.els.label.textContent = label;
    }
  }

  function setBusy(busy) {
    if (!state.els) return;
    state.els.run.disabled = busy;
    state.els.input.disabled = busy;
    state.els.form.setAttribute("aria-busy", busy ? "true" : "false");
    const label = state.els.run.querySelector(".run-label");
    if (label) label.textContent = busy ? "Scanning" : "Scan";
  }

  function startClock() {
    stopClock();
    state.started = performance.now();
    state.timer = setInterval(function () {
      if (!state.els || !state.els.elapsed) return;
      state.els.elapsed.textContent = ((performance.now() - state.started) / 1000).toFixed(1) + "s";
    }, 100);
  }

  function stopClock() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  function showScanning(target) {
    const els = state.els;
    els.empty.hidden = true;
    els.results.hidden = true;
    els.scanning.hidden = false;
    els.shell.classList.remove("has-result");
    els.target.textContent = target.key;
    els.log.innerHTML = "";
    els.elapsed.textContent = "0.0s";
    els.bar.style.width = "0%";
    els.percent.textContent = "0%";
    els.label.textContent = "validating target";
    state.progress = 0;
    state.logCount = 0;
    setBusy(true);
    startClock();
    logLine("target accepted: " + target.host, "ok");
    logLine(target.isIP ? "public IP target · no DNS enumeration" : "passive DNS · RDAP · Certificate Transparency", "dimline");
    logLine("scope guard active · localhost and private ranges blocked", "dimline");
    advance(2, "target validated");
  }

  function showCached(result, age) {
    const els = state.els;
    els.empty.hidden = true;
    els.scanning.hidden = true;
    els.results.hidden = false;
    renderResult(result, true);
    notify("Cached result · " + age + " old. Rescan for fresh data.");
  }

  function showError(message) {
    const els = state.els;
    if (!els) return;
    stopClock();
    setBusy(false);
    state.scanning = false;
    state.current = null;
    els.empty.hidden = true;
    els.scanning.hidden = true;
    els.results.hidden = false;
    els.shell.classList.remove("has-result");
    els.results.innerHTML = "<div class=\"recon-error\"><div class=\"err-icon\">⌁</div><h3>Scan stopped</h3><p>" + esc(message) + "</p>" +
      "<button type=\"button\" class=\"btn btn-play\" data-retry>Try another target</button></div>";
    const retry = els.results.querySelector("[data-retry]");
    if (retry) {
      retry.addEventListener("click", function () {
        els.input.focus();
        els.input.select();
      });
    }
  }

  async function stageCall(label, value, fn) {
    logLine("→ " + label, "info");
    const t0 = performance.now();
    try {
      const out = await fn();
      const ms = Math.round(performance.now() - t0);
      logLine("✓ " + label + " · " + ms + "ms", "ok");
      advance(value, label);
      return out;
    } catch (error) {
      const ms = Math.round(performance.now() - t0);
      logLine("! " + label + " · " + shortError(error) + " · " + ms + "ms", "err");
      advance(Math.max(2, value - 4), label + " unavailable");
      return null;
    }
  }

  function defaultHttp() {
    return { page: null, headers: null, html: "", htmlSource: "", status: 0, headerStatus: 0, errors: ["homepage fetch failed"] };
  }

  function defaultCt() {
    return { available: false, entries: 0, subdomains: [], issuers: [], earliest: "", latest: "", truncated: false };
  }

  function defaultSubdomains() {
    return { probes: [], active: [], takeovers: [], interesting: [], probed: 0 };
  }

  function defaultWellKnown() {
    return { robots: { found: false }, securityTxt: { found: false }, sitemap: { found: false } };
  }

  async function executeScan(target, result) {
    logLine("resolving nameservers, mail records and DNSSEC", "dimline");
    const dns = await stageCall("DNS · mail · DNSSEC", 14, function () { return collectDns(target); });
    if (!dns) throw new Error("DNS resolution failed. Check the domain name and try again.");
    result.dns = dns;
    logLine(dns.a && dns.a.length ? "A → " + dns.a.join(", ") : "no A record published", dns.a && dns.a.length ? "ok" : "warn");
    logLine(dns.ns.length + " nameserver(s) · " + dns.dnsProvider + " · mail: " + dns.mailProvider, "dimline");
    advance(20, "DNS resolved");

    const ipPromise = dns.a && dns.a.length
      ? stageCall("IP intelligence · ASN · geo", 48, function () { return collectIp(dns.a[0]); })
      : Promise.resolve(null);
    const ctPromise = stageCall("Certificate Transparency", 34, function () { return collectCt(target); });
    const subPromise = ctPromise.then(function (ct) {
      if (!ct || !ct.subdomains || !ct.subdomains.length) return null;
      return stageCall("Subdomain probes · " + ct.subdomains.length + " CT names", 94, function () {
        return collectSubdomains(ct, target);
      });
    });
    const rdapPromise = stageCall("RDAP registration", 26, function () { return collectRdap(target); });
    const wellPromise = stageCall("Security.txt · robots · sitemap", 58, function () { return collectWellKnown(target); });
    const httpPromise = stageCall("Homepage · response headers", 70, function () { return collectHttp(target); });

    const settled = await Promise.all([ipPromise, ctPromise, subPromise, rdapPromise, wellPromise, httpPromise]);
    result.ip = settled[0];
    result.ct = settled[1] || defaultCt();
    result.subdomains = settled[2] || defaultSubdomains();
    result.rdap = settled[3] || null;
    result.wellKnown = settled[4] || defaultWellKnown();
    result.http = settled[5] || defaultHttp();
    result.page = result.http.page || null;

    if (result.ip) logLine("AS" + String(result.ip.asn || "").replace(/^AS/i, "") + " · " + (result.ip.org || "unknown org") + " · " + (result.ip.country || "unknown country"), "dimline");
    if (result.ct.available) logLine(result.ct.entries + " certificate(s) · " + result.ct.subdomains.length + " unique name(s)", "dimline");
    if (result.subdomains.takeovers.length) logLine(result.subdomains.takeovers.length + " CNAME review candidate(s) — verify, do not assume", "warn");
    if (result.wellKnown.securityTxt && result.wellKnown.securityTxt.found) logLine("security.txt published", "dimline");
    if (result.http.htmlSource) logLine("HTML via " + result.http.htmlSource, "dimline");
    if (result.http.errors && result.http.errors.length) logLine(result.http.errors.length + " non-fatal fetch issue(s)", "warn");

    advance(88, "fingerprinting stack");
    logLine("→ Tech fingerprinting", "info");
    result.tech = detectTech(result.http.html || "", result.http, result.dns, target, result.page, result.ip);
    logLine("✓ Tech stack · " + result.tech.length + " signature(s)", "ok");
    delete result.http.html;
    advance(92, "tech stack mapped");

    logLine("→ Security header audit", "info");
    result.security = auditHeaders(result.http, result.dns, result.page);
    if (result.security.available) {
      logLine("✓ Header grade · " + result.security.grade + " · " + result.security.score + "/100 · " + result.security.passed + "/" + result.security.total + " passed", result.security.score >= 70 ? "ok" : "warn");
    } else {
      logLine("! Header grade unavailable · unscored", "warn");
    }
    advance(98, "security audit complete");

    result.meta = {
      tool: "ReconLab",
      version: VERSION,
      startedAt: result.meta.startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - state.started),
      cached: false,
      passive: true,
      sources: ["Google DNS over HTTPS", "RDAP.org", "Cert Spotter", "ipinfo.io", "ip.sb", "HackerTarget", "Jina Reader"]
    };
    advance(100, "scan complete");
    logLine("scan complete · " + durationLabel(result.meta.elapsedMs) + " · passive only", "ok");
    await new Promise(function (resolve) { setTimeout(resolve, 260); });
    return result;
  }

  function scan(raw, options) {
    const opts = options || {};
    if (!state.els) init();
    if (!state.els) return Promise.resolve(null);
    if (state.scanning) {
      notify("A scan is already running.");
      return Promise.resolve(null);
    }

    let target;
    try {
      target = normalizeTarget(raw);
    } catch (error) {
      showError(error.message);
      return Promise.resolve(null);
    }

    state.els.input.value = target.key;
    state.currentTarget = target;

    if (!opts.force) {
      const cached = cacheGet(target.key);
      if (cached) {
        cached.result.meta.cached = true;
        showCached(cached.result, timeAgo(new Date(cached.at).toISOString()));
        addHistory(cached.result);
        return Promise.resolve(cached.result);
      }
    }

    state.scanning = true;
    const result = {
      target: {
        input: raw,
        host: target.host,
        domain: target.domain,
        registrable: target.registrable,
        isIP: target.isIP,
        path: target.path,
        origin: target.origin,
        key: target.key,
        url: target.url
      },
      meta: { startedAt: new Date().toISOString() }
    };
    showScanning(target);

    return executeScan(target, result).then(function (finished) {
      stopClock();
      state.scanning = false;
      setBusy(false);
      state.els.elapsed.textContent = (finished.meta.elapsedMs / 1000).toFixed(1) + "s";
      cacheSet(target.key, finished);
      addHistory(finished);
      renderResult(finished, false);
      return finished;
    }).catch(function (error) {
      stopClock();
      state.scanning = false;
      setBusy(false);
      showError(shortError(error) + ". Try a domain that publishes public DNS records.");
      return null;
    });
  }

  /* ------------------------------- history ----------------------------- */

  function addHistory(result) {
    if (!result || !result.target) return;
    const target = result.target;
    const key = target.key || (target.host + (target.path && target.path !== "/" ? target.path : ""));
    const entry = {
      key: key,
      host: target.host,
      path: target.path || "/",
      at: Date.now(),
      grade: result.security && result.security.available ? result.security.grade : "?",
      score: result.security && result.security.score != null ? result.security.score : null
    };
    state.history = [entry].concat(state.history.filter(function (h) {
      const hkey = h.key || h.host;
      return hkey !== entry.key;
    })).slice(0, MAX_HISTORY);
    saveJSON(HISTORY_KEY, state.history);
    renderHistory();
  }

  function renderHistory() {
    const el = state.els && state.els.history;
    if (!el) return;
    if (!state.history.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = "<span>RECENT</span>" + state.history.map(function (h) {
      const key = h.key || h.host;
      const label = h.grade && h.grade !== "?" ? h.grade : "—";
      return "<button type=\"button\" data-host=\"" + esc(key) + "\" title=\"" + esc(key + " · " + timeAgo(new Date(h.at).toISOString())) + "\">" + esc(key) + " <span style=\"color:var(--dim)\">" + esc(label) + "</span></button>";
    }).join("") + "<button type=\"button\" data-history-clear title=\"Clear recent scans\">clear</button>";
  }

  /* -------------------------------- init ------------------------------- */

  function focus() {
    if (!state.els) init();
    if (!state.els) return;
    const section = document.getElementById("recon");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () {
      state.els.input.focus();
      state.els.input.select();
    }, 350);
  }

  function prefill(value) {
    if (!state.els) init();
    if (!state.els) return;
    state.els.input.value = value || "";
    focus();
  }

  function init() {
    if (state.els) return state.els;
    const els = collectEls();
    if (!els || !els.form || !els.results) return null;
    state.els = els;

    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      scan(els.input.value);
    });

    if (els.quick) {
      els.quick.addEventListener("click", function (event) {
        const button = event.target.closest("[data-scan]");
        if (button) scan(button.getAttribute("data-scan"));
      });
    }

    if (els.history) {
      els.history.addEventListener("click", function (event) {
        const clear = event.target.closest("[data-history-clear]");
        if (clear) {
          state.history = [];
          saveJSON(HISTORY_KEY, state.history);
          renderHistory();
          notify("Recent scans cleared.");
          return;
        }
        const button = event.target.closest("[data-host]");
        if (button) scan(button.getAttribute("data-host"));
      });
    }

    renderHistory();
    return els;
  }

  const api = {
    init: init,
    scan: function (value, options) { return scan(value, options || {}); },
    focus: focus,
    prefill: prefill,
    clearCache: cacheClear
  };

  window.ReconLab = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
