/* ==========================================================================
   PCAP Lab — a small, dependency-free pcap / pcapng parser and dissector.
   Runs fully client-side. Exposes window.PcapLab.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- helpers ---------------- */
  const hex = (n, w = 2) => n.toString(16).padStart(w, "0");
  const mac = (b, o) => Array.from(b.subarray(o, o + 6), (x) => hex(x)).join(":");
  const ip4 = (b, o) => `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`;
  function ip6(b, o) {
    const parts = [];
    for (let i = 0; i < 16; i += 2) parts.push(((b[o + i] << 8) | b[o + i + 1]).toString(16));
    // compress the longest run of zeros
    let best = [-1, 0], cur = [-1, 0];
    parts.forEach((p, i) => {
      if (p === "0") { if (cur[0] < 0) cur = [i, 0]; cur[1]++; if (cur[1] > best[1]) best = [...cur]; }
      else cur = [-1, 0];
    });
    if (best[1] > 1) {
      const l = parts.slice(0, best[0]).join(":"), r = parts.slice(best[0] + best[1]).join(":");
      return `${l}::${r}`;
    }
    return parts.join(":");
  }
  const u16 = (b, o) => (b[o] << 8) | b[o + 1];
  const u32 = (b, o) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
  const ascii = (b, o, n) => { let s = ""; for (let i = o; i < Math.min(b.length, o + n); i++) s += String.fromCharCode(b[i]); return s; };

  const PORTS = { 20: "FTP-DATA", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 67: "DHCP", 68: "DHCP", 80: "HTTP", 110: "POP3", 123: "NTP", 143: "IMAP", 161: "SNMP", 443: "HTTPS", 445: "SMB", 465: "SMTPS", 587: "SMTP", 853: "DoT", 993: "IMAPS", 1900: "SSDP", 3306: "MySQL", 3389: "RDP", 5353: "mDNS", 5432: "PostgreSQL", 8080: "HTTP-alt" };
  const DNS_T = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 12: "PTR", 15: "MX", 16: "TXT", 28: "AAAA", 33: "SRV", 65: "HTTPS" };
  const ICMP_T = { 0: "Echo (ping) reply", 3: "Destination unreachable", 5: "Redirect", 8: "Echo (ping) request", 11: "Time exceeded" };
  const ICMP6_T = { 128: "Echo request", 129: "Echo reply", 133: "Router Solicitation", 134: "Router Advertisement", 135: "Neighbor Solicitation", 136: "Neighbor Advertisement" };

  /* ---------------- file readers ---------------- */
  function parseFile(buf) {
    const b = new Uint8Array(buf);
    const dv = new DataView(buf);
    if (b.length < 24) throw new Error("File too small to be a capture.");
    const m = dv.getUint32(0, false);
    if (m === 0x0a0d0d0a) return parsePcapng(b, dv);
    let le, nano;
    if (m === 0xa1b2c3d4) { le = false; nano = false; }
    else if (m === 0xd4c3b2a1) { le = true; nano = false; }
    else if (m === 0xa1b23c4d) { le = false; nano = true; }
    else if (m === 0x4d3cb2a1) { le = true; nano = true; }
    else throw new Error("Not a pcap/pcapng file (unknown magic number).");
    const link = dv.getUint32(20, le) & 0xffff;
    const out = [];
    let o = 24;
    while (o + 16 <= b.length) {
      const sec = dv.getUint32(o, le), frac = dv.getUint32(o + 4, le);
      const incl = dv.getUint32(o + 8, le), orig = dv.getUint32(o + 12, le);
      o += 16;
      if (incl > 262144 || o + incl > b.length) break;
      out.push({ ts: sec + frac / (nano ? 1e9 : 1e6), link, data: b.subarray(o, o + incl), orig });
      o += incl;
    }
    return { format: nano ? "pcap (ns)" : "pcap", link, packets: out };
  }

  function parsePcapng(b, dv) {
    const out = [];
    let o = 0, le = true;
    let ifaces = [];
    let guard = 0;
    while (o + 12 <= b.length && guard++ < 5e6) {
      let type = dv.getUint32(o, le);
      if (type === 0x0a0d0d0a) {
        const bom = dv.getUint32(o + 8, true);
        le = bom === 0x1a2b3c4d;
        ifaces = [];
      }
      const len = dv.getUint32(o + 4, le);
      if (len < 12 || o + len > b.length) break;
      type = dv.getUint32(o, le);
      if (type === 1) { // IDB
        const link = dv.getUint16(o + 8, le);
        let res = 1e6;
        let p = o + 16;
        while (p + 4 <= o + len - 4) {
          const code = dv.getUint16(p, le), olen = dv.getUint16(p + 2, le);
          if (code === 0) break;
          if (code === 9 && olen >= 1) {
            const v = b[p + 4];
            res = v & 0x80 ? Math.pow(2, v & 0x7f) : Math.pow(10, v);
          }
          p += 4 + ((olen + 3) & ~3);
        }
        ifaces.push({ link, res });
      } else if (type === 6) { // EPB
        const ifid = dv.getUint32(o + 8, le);
        const hi = dv.getUint32(o + 12, le), lo = dv.getUint32(o + 16, le);
        const cap = dv.getUint32(o + 20, le), orig = dv.getUint32(o + 24, le);
        const ifc = ifaces[ifid] || { link: 1, res: 1e6 };
        const ts = (hi * 4294967296 + lo) / ifc.res;
        out.push({ ts, link: ifc.link, data: b.subarray(o + 28, o + 28 + Math.min(cap, len - 28)), orig });
      } else if (type === 3) { // SPB
        const orig = dv.getUint32(o + 8, le);
        const ifc = ifaces[0] || { link: 1 };
        out.push({ ts: 0, link: ifc.link, data: b.subarray(o + 12, o + 12 + Math.min(orig, len - 16)), orig });
      } else if (type === 2) { // obsolete PB
        const ifid = dv.getUint16(o + 8, le);
        const hi = dv.getUint32(o + 12, le), lo = dv.getUint32(o + 16, le);
        const cap = dv.getUint32(o + 20, le), orig = dv.getUint32(o + 24, le);
        const ifc = ifaces[ifid] || { link: 1, res: 1e6 };
        out.push({ ts: (hi * 4294967296 + lo) / ifc.res, link: ifc.link, data: b.subarray(o + 28, o + 28 + cap), orig });
      }
      o += len;
    }
    return { format: "pcapng", link: ifaces[0] ? ifaces[0].link : 1, packets: out };
  }

  /* ---------------- dissectors ---------------- */
  function dissect(pkt) {
    const b = pkt.data;
    const r = { src: "", dst: "", proto: "other", info: "", layers: [], sport: null, dport: null, flags: "" };
    r.layers.push({ name: `Frame: ${pkt.orig} bytes on wire, ${b.length} bytes captured`, fields: [["Arrival (epoch)", pkt.ts.toFixed(6)], ["Link type", pkt.link]] });
    try {
      let et = null, o = 0;
      switch (pkt.link) {
        case 1: { // Ethernet
          if (b.length < 14) break;
          et = u16(b, 12); o = 14;
          const L = { name: `Ethernet II, Src: ${mac(b, 6)}, Dst: ${mac(b, 0)}`, fields: [["Destination", mac(b, 0)], ["Source", mac(b, 6)]] };
          while ((et === 0x8100 || et === 0x88a8) && o + 4 <= b.length) { L.fields.push(["802.1Q VLAN", u16(b, o) & 0xfff]); et = u16(b, o + 2); o += 4; }
          L.fields.push(["Type", "0x" + hex(et, 4)]);
          r.layers.push(L);
          r.src = mac(b, 6); r.dst = mac(b, 0);
          break;
        }
        case 113: et = u16(b, 14); o = 16; r.layers.push({ name: "Linux cooked capture v1", fields: [["Protocol", "0x" + hex(et, 4)]] }); break;
        case 276: et = u16(b, 0); o = 20; r.layers.push({ name: "Linux cooked capture v2", fields: [["Protocol", "0x" + hex(et, 4)]] }); break;
        case 0: case 108: { const fam = b[0] === 2 || b[3] === 2 ? 4 : 6; et = fam === 4 ? 0x0800 : 0x86dd; o = 4; r.layers.push({ name: "Null/Loopback", fields: [["Family", fam === 4 ? "IPv4" : "IPv6"]] }); break; }
        case 101: case 12: case 14: case 228: case 229: et = (b[0] >> 4) === 6 ? 0x86dd : 0x0800; o = 0; break;
        default: r.info = `Unsupported link type ${pkt.link}`; return r;
      }
      if (et === 0x0800) return ipv4(b, o, r);
      if (et === 0x86dd) return ipv6(b, o, r);
      if (et === 0x0806) return arp(b, o, r);
      r.proto = "other"; r.info = `Ethertype 0x${hex(et, 4)}`;
    } catch (e) { r.info = r.info || "Malformed packet"; }
    return r;
  }

  function arp(b, o, r) {
    const op = u16(b, o + 6);
    const sha = mac(b, o + 8), spa = ip4(b, o + 14), tpa = ip4(b, o + 24);
    r.proto = "ARP";
    r.info = op === 1 ? `Who has ${tpa}? Tell ${spa}` : `${spa} is at ${sha}`;
    r.layers.push({ name: `Address Resolution Protocol (${op === 1 ? "request" : "reply"})`, fields: [["Opcode", op], ["Sender MAC", sha], ["Sender IP", spa], ["Target MAC", mac(b, o + 18)], ["Target IP", tpa]] });
    return r;
  }

  function ipv4(b, o, r) {
    const ihl = (b[o] & 15) * 4, total = u16(b, o + 2), ttl = b[o + 8], p = b[o + 9];
    const fragOff = u16(b, o + 6);
    r.src = ip4(b, o + 12); r.dst = ip4(b, o + 16);
    r.layers.push({ name: `Internet Protocol Version 4, Src: ${r.src}, Dst: ${r.dst}`, fields: [["Header length", ihl + " bytes"], ["DSCP/ECN", "0x" + hex(b[o + 1])], ["Total length", total], ["Identification", "0x" + hex(u16(b, o + 4), 4)], ["Flags", (fragOff & 0x4000 ? "DF " : "") + (fragOff & 0x2000 ? "MF" : "")], ["Fragment offset", fragOff & 0x1fff], ["TTL", ttl], ["Protocol", p], ["Header checksum", "0x" + hex(u16(b, o + 10), 4)]] });
    const end = Math.min(b.length, o + (total || b.length - o));
    return l4(b, o + ihl, end, p, r);
  }

  function ipv6(b, o, r) {
    let nh = b[o + 6]; const plen = u16(b, o + 4);
    r.src = ip6(b, o + 8); r.dst = ip6(b, o + 24);
    r.layers.push({ name: `Internet Protocol Version 6, Src: ${r.src}, Dst: ${r.dst}`, fields: [["Payload length", plen], ["Next header", nh], ["Hop limit", b[o + 7]], ["Flow label", "0x" + hex(u32(b, o) & 0xfffff, 5)]] });
    let p = o + 40;
    const end = Math.min(b.length, p + plen);
    while ([0, 43, 60, 51].includes(nh) && p + 2 <= end) { const n2 = b[p]; p += nh === 51 ? (b[p + 1] + 2) * 4 : (b[p + 1] + 1) * 8; nh = n2; }
    if (nh === 44 && p + 8 <= end) { nh = b[p]; p += 8; }
    return l4(b, p, end, nh, r);
  }

  function l4(b, o, end, p, r) {
    if (p === 6) return tcp(b, o, end, r);
    if (p === 17) return udp(b, o, end, r);
    if (p === 1 || p === 58) {
      const t = b[o], c = b[o + 1];
      r.proto = p === 1 ? "ICMP" : "ICMPv6";
      const names = p === 1 ? ICMP_T : ICMP6_T;
      r.info = `${names[t] || "Type " + t}${c ? " (code " + c + ")" : ""}`;
      if ((p === 1 && (t === 0 || t === 8)) || (p === 58 && (t === 128 || t === 129))) r.info += `  id=0x${hex(u16(b, o + 4), 4)}, seq=${u16(b, o + 6)}`;
      r.layers.push({ name: p === 1 ? "Internet Control Message Protocol" : "Internet Control Message Protocol v6", fields: [["Type", `${t} (${names[t] || "?"})`], ["Code", c], ["Checksum", "0x" + hex(u16(b, o + 2), 4)]] });
      return r;
    }
    r.proto = { 2: "IGMP", 47: "GRE", 50: "ESP", 89: "OSPF", 132: "SCTP" }[p] || `IP/${p}`;
    r.info = `IP protocol ${p}`;
    return r;
  }

  function tcp(b, o, end, r) {
    const sp = u16(b, o), dp = u16(b, o + 2), seq = u32(b, o + 4), ack = u32(b, o + 8);
    const off = (b[o + 12] >> 4) * 4, fl = b[o + 13], win = u16(b, o + 14);
    const names = []; if (fl & 2) names.push("SYN"); if (fl & 16) names.push("ACK"); if (fl & 1) names.push("FIN"); if (fl & 4) names.push("RST"); if (fl & 8) names.push("PSH"); if (fl & 32) names.push("URG");
    r.sport = sp; r.dport = dp; r.proto = "TCP"; r.flags = names.join(",");
    const pay = b.subarray(o + off, end);
    r.layers.push({ name: `Transmission Control Protocol, Src Port: ${sp}, Dst Port: ${dp}, Len: ${pay.length}`, fields: [["Source port", sp], ["Destination port", dp], ["Sequence number (raw)", seq], ["Acknowledgment (raw)", ack], ["Header length", off + " bytes"], ["Flags", `0x${hex(fl, 3)} [${r.flags}]`], ["Window", win], ["Checksum", "0x" + hex(u16(b, o + 16), 4)]] });
    r.info = `${sp} → ${dp} [${r.flags}] Seq=${seq} ${fl & 16 ? "Ack=" + ack + " " : ""}Win=${win} Len=${pay.length}`;
    if (fl & 4) r.proto = "TCP", r.mark = "RST";
    else if ((fl & 2) && !(fl & 16)) r.mark = "SYN";
    if (pay.length) app(pay, sp, dp, r, "tcp");
    return r;
  }

  function udp(b, o, end, r) {
    const sp = u16(b, o), dp = u16(b, o + 2), len = u16(b, o + 4);
    r.sport = sp; r.dport = dp; r.proto = "UDP";
    const pay = b.subarray(o + 8, Math.min(end, o + Math.max(8, len)));
    r.layers.push({ name: `User Datagram Protocol, Src Port: ${sp}, Dst Port: ${dp}`, fields: [["Source port", sp], ["Destination port", dp], ["Length", len], ["Checksum", "0x" + hex(u16(b, o + 6), 4)]] });
    r.info = `${sp} → ${dp} Len=${pay.length}`;
    if (pay.length) app(pay, sp, dp, r, "udp");
    return r;
  }

  function app(p, sp, dp, r, t) {
    const has = (x) => sp === x || dp === x;
    if (has(53) || has(5353)) return dns(t === "tcp" ? p.subarray(2) : p, r, has(5353));
    if (t === "tcp" && p[0] === 0x16 && p[1] === 3) return tls(p, r);
    if (t === "tcp" && (p[0] === 0x17 || p[0] === 0x15 || p[0] === 0x14) && p[1] === 3) {
      r.proto = "TLS"; r.info = { 0x17: "Application Data", 0x15: "Alert", 0x14: "Change Cipher Spec" }[p[0]];
      r.layers.push({ name: "Transport Layer Security", fields: [["Content type", r.info], ["Version", tlsVer(u16(p, 1))], ["Length", u16(p, 3)]] });
      return;
    }
    const head = ascii(p, 0, 8);
    if (t === "tcp" && /^(GET|POST|PUT|HEAD|DELETE|OPTIONS|PATCH|HTTP\/1)/.test(head)) {
      const text = ascii(p, 0, Math.min(p.length, 2048));
      const lines = text.split("\r\n");
      r.proto = "HTTP"; r.info = lines[0];
      const fields = lines.slice(0, 14).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 && !l.startsWith("HTTP/") && !/^[A-Z]+ \//.test(l) ? [l.slice(0, i), l.slice(i + 1).trim()] : ["", l]; });
      r.layers.push({ name: "Hypertext Transfer Protocol", fields });
      return;
    }
    if (t === "udp" && has(443) && p.length > 5) {
      const long = p[0] & 0x80;
      r.proto = "QUIC";
      if (long) {
        const ver = u32(p, 1), pt = (p[0] >> 4) & 3;
        const typ = ver === 0 ? "Version Negotiation" : ["Initial", "0-RTT", "Handshake", "Retry"][pt];
        const dcidLen = p[5];
        const dcid = Array.from(p.subarray(6, 6 + dcidLen), (x) => hex(x)).join("");
        r.info = `${typ}, DCID=${dcid ? dcid.slice(0, 16) + (dcid.length > 16 ? "…" : "") : "(empty)"}, Version 0x${hex(ver, 8)}`;
        r.layers.push({ name: "QUIC IETF", fields: [["Header form", "Long"], ["Packet type", typ], ["Version", "0x" + hex(ver, 8) + (ver === 1 ? " (RFC 9000)" : "")], ["DCID length", dcidLen], ["DCID", dcid], ["UDP payload", p.length + " bytes" + (typ === "Initial" ? (p.length >= 1200 ? "  ✓ padded ≥1200 (RFC 9000 §14.1)" : "  ✗ under 1200 bytes") : "")]] });
      } else {
        r.info = "Protected Payload (short header)";
        r.layers.push({ name: "QUIC IETF", fields: [["Header form", "Short (1-RTT)"], ["Spin bit", (p[0] >> 5) & 1]] });
      }
      return;
    }
    const svc = PORTS[dp] || PORTS[sp];
    if (svc && svc !== "HTTPS") r.proto = r.proto === "TCP" || r.proto === "UDP" ? r.proto : r.proto;
    if (svc) r.info += `  (${svc})`;
  }

  function readName(p, o, depth = 0) {
    const labels = []; let jumped = false, next = o, guard = 0;
    while (o < p.length && guard++ < 64) {
      const len = p[o];
      if (len === 0) { o++; break; }
      if ((len & 0xc0) === 0xc0) {
        if (!jumped) next = o + 2;
        o = ((len & 0x3f) << 8) | p[o + 1]; jumped = true;
        if (depth++ > 10) break;
        continue;
      }
      labels.push(ascii(p, o + 1, len)); o += len + 1;
    }
    return { name: labels.join(".") || "<root>", end: jumped ? next : o };
  }

  function dns(p, r, m) {
    if (p.length < 12) return;
    const id = u16(p, 0), fl = u16(p, 2), qd = u16(p, 4), an = u16(p, 6);
    const resp = !!(fl & 0x8000), rcode = fl & 15;
    r.proto = m ? "mDNS" : "DNS";
    const fields = [["Transaction ID", "0x" + hex(id, 4)], ["Flags", "0x" + hex(fl, 4) + (resp ? " (response)" : " (query)")], ["Questions", qd], ["Answer RRs", an]];
    let o = 12, qs = [], ans = [];
    for (let i = 0; i < qd && o < p.length; i++) {
      const n = readName(p, o); o = n.end;
      const qt = u16(p, o); o += 4;
      qs.push(`${DNS_T[qt] || qt} ${n.name}`); fields.push(["Query", `${n.name}: type ${DNS_T[qt] || qt}`]);
    }
    for (let i = 0; i < an && o + 10 <= p.length; i++) {
      const n = readName(p, o); o = n.end;
      const t = u16(p, o), ttl = u32(p, o + 4), rl = u16(p, o + 8); o += 10;
      let v = "";
      if (t === 1 && rl === 4) v = ip4(p, o);
      else if (t === 28 && rl === 16) v = ip6(p, o);
      else if (t === 5 || t === 2 || t === 12) v = readName(p, o).name;
      else v = `${rl} bytes`;
      ans.push(`${DNS_T[t] || t} ${v}`); fields.push(["Answer", `${n.name}: ${DNS_T[t] || t} ${v} (TTL ${ttl})`]);
      o += rl;
    }
    const rc = ["", " No error", " Format error", " Server failure", " No such name"][rcode] || "";
    r.info = `Standard query${resp ? " response" : ""} 0x${hex(id, 4)} ${qs.join(", ")}${ans.length ? " " + ans.join(" ") : ""}${resp && rcode ? " —" + rc : ""}`;
    r.layers.push({ name: `Domain Name System (${resp ? "response" : "query"})`, fields });
  }

  const tlsVer = (v) => ({ 0x0301: "TLS 1.0", 0x0302: "TLS 1.1", 0x0303: "TLS 1.2", 0x0304: "TLS 1.3" }[v] || "0x" + hex(v, 4));
  function tls(p, r) {
    r.proto = "TLS";
    const hs = p[5];
    const names = { 1: "Client Hello", 2: "Server Hello", 11: "Certificate", 12: "Server Key Exchange", 14: "Server Hello Done", 16: "Client Key Exchange", 4: "New Session Ticket" };
    r.info = names[hs] || "Handshake";
    const fields = [["Record version", tlsVer(u16(p, 1))], ["Handshake type", `${hs} (${r.info})`]];
    if (hs === 1 || hs === 2) {
      try {
        let o = 9; fields.push(["Version", tlsVer(u16(p, o))]); o += 2 + 32;
        o += 1 + p[o]; // session id
        if (hs === 1) {
          const cs = u16(p, o); fields.push(["Cipher suites", cs / 2]); o += 2 + cs;
          o += 1 + p[o];
        } else { fields.push(["Cipher suite", "0x" + hex(u16(p, o), 4)]); o += 3; }
        const extEnd = o + 2 + u16(p, o); o += 2;
        const alpn = [];
        while (o + 4 <= Math.min(extEnd, p.length)) {
          const et = u16(p, o), el = u16(p, o + 2);
          if (et === 0 && hs === 1) { const sni = ascii(p, o + 9, u16(p, o + 7)); fields.push(["Server Name (SNI)", sni]); r.info += ` (SNI=${sni})`; r.sni = sni; }
          if (et === 16) { let q = o + 6; while (q < o + 4 + el) { alpn.push(ascii(p, q + 1, p[q])); q += 1 + p[q]; } }
          if (et === 43 && hs === 2) fields.push(["Negotiated version", tlsVer(u16(p, o + 4))]);
          o += 4 + el;
        }
        if (alpn.length) fields.push(["ALPN", alpn.join(", ")]);
      } catch (e) { /* truncated */ }
    }
    r.layers.push({ name: "Transport Layer Security", fields });
  }

  /* ---------------- sample capture generator ---------------- */
  function sample() {
    const frames = [];
    let t = 1760700000.0;
    const ME = [0x02, 0x42, 0xac, 0x11, 0x00, 0x05], GW = [0x00, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e];
    const me = [192, 168, 1, 5], gw = [192, 168, 1, 1];
    const be16 = (n) => [(n >> 8) & 255, n & 255];
    const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const str = (s) => Array.from(s, (c) => c.charCodeAt(0));
    const eth = (dst, src, type, body) => [...dst, ...src, ...be16(type), ...body];
    function cks(arr) { let s = 0; for (let i = 0; i < arr.length; i += 2) s += (arr[i] << 8) + (arr[i + 1] || 0); while (s >> 16) s = (s & 0xffff) + (s >> 16); return (~s) & 0xffff; }
    let ipid = 0x1c46;
    function ip(src, dst, proto, body) {
      const h = [0x45, 0, ...be16(20 + body.length), ...be16(ipid++), 0x40, 0, 64, proto, 0, 0, ...src, ...dst];
      const c = cks(h); h[10] = c >> 8; h[11] = c & 255;
      return [...h, ...body];
    }
    const udpP = (sp, dp, body) => [...be16(sp), ...be16(dp), ...be16(8 + body.length), 0, 0, ...body];
    const tcpP = (sp, dp, seq, ack, flags, body = []) => [...be16(sp), ...be16(dp), ...be32(seq), ...be32(ack), 0x50, flags, ...be16(64240), 0, 0, 0, 0, ...body];
    const name = (n) => [...n.split(".").flatMap((l) => [l.length, ...str(l)]), 0];
    function dnsQ(id, host, type = 1) { return [...be16(id), 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, ...name(host), ...be16(type), 0, 1]; }
    function dnsR(id, host, ips) {
      const ans = ips.flatMap((a) => [0xc0, 12, 0, 1, 0, 1, ...be32(300), 0, 4, ...a]);
      return [...be16(id), 0x81, 0x80, 0, 1, ...be16(ips.length), 0, 0, 0, 0, ...name(host), 0, 1, 0, 1, ...ans];
    }
    function clientHello(sni) {
      const sniExt = [0, 0, ...be16(sni.length + 5), ...be16(sni.length + 3), 0, ...be16(sni.length), ...str(sni)];
      const alpn = [0, 16, 0, 14, 0, 12, 2, ...str("h2"), 8, ...str("http/1.1")];
      const sv = [0, 43, 0, 3, 2, 3, 4];
      const exts = [...sniExt, ...alpn, ...sv];
      const body = [3, 3, ...Array(32).fill(0).map((_, i) => (i * 37) & 255), 0, 0, 6, 0x13, 0x01, 0x13, 0x02, 0xc0, 0x2f, 1, 0, ...be16(exts.length), ...exts];
      const hs = [1, 0, ...be16(body.length), ...body];
      return [0x16, 3, 1, ...be16(hs.length), ...hs];
    }
    const push = (bytes, dt = 0.003) => { t += dt; frames.push({ t, bytes }); };
    const out = (dstIp, proto, body, dt) => push(eth(GW, ME, 0x0800, ip(me, dstIp, proto, body)), dt);
    const inn = (srcIp, proto, body, dt) => push(eth(ME, GW, 0x0800, ip(srcIp, me, proto, body)), dt);

    // ARP
    push(eth([255, 255, 255, 255, 255, 255], ME, 0x0806, [0, 1, 8, 0, 6, 4, 0, 1, ...ME, ...me, 0, 0, 0, 0, 0, 0, ...gw]), 0);
    push(eth(ME, GW, 0x0806, [0, 1, 8, 0, 6, 4, 0, 2, ...GW, ...gw, ...ME, ...me]), 0.0011);
    // DNS example.com
    const dnsS = [1, 1, 1, 1];
    out(dnsS, 17, udpP(53211, 53, dnsQ(0x3a7f, "example.com")), 0.002);
    inn(dnsS, 17, udpP(53, 53211, dnsR(0x3a7f, "example.com", [[93, 184, 215, 14]])), 0.018);
    // HTTP
    const web = [93, 184, 215, 14];
    out(web, 6, tcpP(49822, 80, 1000, 0, 0x02), 0.001);
    inn(web, 6, tcpP(80, 49822, 5000, 1001, 0x12), 0.042);
    out(web, 6, tcpP(49822, 80, 1001, 5001, 0x10), 0.0002);
    const req = str("GET / HTTP/1.1\r\nHost: example.com\r\nUser-Agent: N3Core/1.0\r\nAccept: */*\r\n\r\n");
    out(web, 6, tcpP(49822, 80, 1001, 5001, 0x18, req), 0.0004);
    const resp = str("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Length: 38\r\nServer: ECAcc\r\n\r\n<html><h1>Example Domain</h1></html>\r\n");
    inn(web, 6, tcpP(80, 49822, 5001, 1001 + req.length, 0x18, resp), 0.044);
    out(web, 6, tcpP(49822, 80, 1001 + req.length, 5001 + resp.length, 0x11), 0.001);
    inn(web, 6, tcpP(80, 49822, 5001 + resp.length, 1002 + req.length, 0x11), 0.04);
    // DNS github.com + TLS
    out(dnsS, 17, udpP(53212, 53, dnsQ(0x91c2, "github.com")), 0.12);
    inn(dnsS, 17, udpP(53, 53212, dnsR(0x91c2, "github.com", [[140, 82, 121, 4]])), 0.015);
    const gh = [140, 82, 121, 4];
    out(gh, 6, tcpP(49830, 443, 7000, 0, 0x02), 0.001);
    inn(gh, 6, tcpP(443, 49830, 9000, 7001, 0x12), 0.031);
    out(gh, 6, tcpP(49830, 443, 7001, 9001, 0x10), 0.0002);
    const ch = clientHello("github.com");
    out(gh, 6, tcpP(49830, 443, 7001, 9001, 0x18, ch), 0.0006);
    const sh = (() => { const body = [3, 3, ...Array(32).fill(7), 0, 0x13, 0x01, 0, 0, 6, 0, 43, 0, 2, 3, 4]; const hs = [2, 0, ...be16(body.length), ...body]; return [0x16, 3, 3, ...be16(hs.length), ...hs]; })();
    inn(gh, 6, tcpP(443, 49830, 9001, 7001 + ch.length, 0x18, sh), 0.033);
    inn(gh, 6, tcpP(443, 49830, 9001 + sh.length, 7001 + ch.length, 0x18, [0x17, 3, 3, 0, 32, ...Array(32).fill(0xab)]), 0.001);
    out(gh, 6, tcpP(49830, 443, 7001 + ch.length, 9038 + sh.length, 0x18, [0x17, 3, 3, 0, 48, ...Array(48).fill(0x5c)]), 0.004);
    // QUIC initial to google
    const gq = [142, 250, 183, 78];
    const dcid = [0x83, 0x94, 0xc8, 0xf0, 0x3e, 0x51, 0x57, 0x08];
    const quic = [0xc3, 0, 0, 0, 1, 8, ...dcid, 0, 0x44, 0xd0, ...Array(1188).fill(0)];
    out(gq, 17, udpP(61344, 443, quic), 0.08);
    inn(gq, 17, udpP(443, 61344, [0xc1, 0, 0, 0, 1, 0, 8, ...dcid.reverse(), 0x40, 0x75, ...Array(117).fill(0x11)]), 0.022);
    inn(gq, 17, udpP(443, 61344, [0x43, ...dcid, ...Array(60).fill(0x22)]), 0.002);
    // ICMP ping
    const cf = [1, 1, 1, 1];
    const ping = (type, seq) => { const p = [type, 0, 0, 0, 0x00, 0x2a, ...be16(seq), ...str("abcdefghijklmnopqrstuvwabcdefghi")]; const c = cks(p); p[2] = c >> 8; p[3] = c & 255; return p; };
    out(cf, 1, ping(8, 1), 0.3); inn(cf, 1, ping(0, 1), 0.011);
    out(cf, 1, ping(8, 2), 0.99); inn(cf, 1, ping(0, 2), 0.012);
    // Port probe -> RST (scan detection demo)
    const tgt = [192, 168, 1, 20];
    out(tgt, 6, tcpP(50001, 23, 1, 0, 0x02), 0.2);
    inn(tgt, 6, tcpP(23, 50001, 0, 2, 0x14), 0.0009);
    out(tgt, 6, tcpP(50002, 3389, 1, 0, 0x02), 0.0004);
    inn(tgt, 6, tcpP(3389, 50002, 0, 2, 0x14), 0.0008);
    // mDNS
    push(eth([0x01, 0, 0x5e, 0, 0, 0xfb], ME, 0x0800, ip(me, [224, 0, 0, 251], 17, udpP(5353, 5353, dnsQ(0, "_googlecast._tcp.local", 12)))), 0.5);

    // serialise as classic pcap
    const total = 24 + frames.reduce((s, f) => s + 16 + f.bytes.length, 0);
    const buf = new ArrayBuffer(total), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint32(0, 0xa1b2c3d4, true); dv.setUint16(4, 2, true); dv.setUint16(6, 4, true); dv.setUint32(16, 65535, true); dv.setUint32(20, 1, true);
    let o = 24;
    for (const f of frames) {
      const sec = Math.floor(f.t), us = Math.round((f.t - sec) * 1e6);
      dv.setUint32(o, sec, true); dv.setUint32(o + 4, us, true); dv.setUint32(o + 8, f.bytes.length, true); dv.setUint32(o + 12, f.bytes.length, true);
      u8.set(f.bytes, o + 16); o += 16 + f.bytes.length;
    }
    return buf;
  }

  /* ---------------- filtering ---------------- */
  function compileFilter(q) {
    q = (q || "").trim().toLowerCase();
    if (!q) return () => true;
    const groups = q.split(/\s*(?:\|\||\bor\b)\s*/).map((g) => g.split(/\s*(?:&&|\band\b)\s*|\s+/).filter(Boolean));
    const test = (p, term) => {
      let neg = false;
      if (term.startsWith("!")) { neg = true; term = term.slice(1); }
      if (term.startsWith("not")) term = term.slice(3);
      let field = null, val = term;
      const m = term.match(/^([a-z0-9._]+)\s*(==|=|contains)\s*(.+)$/);
      if (m) { field = m[1]; val = m[3].replace(/^"|"$/g, ""); }
      const proto = p.proto.toLowerCase();
      let hit;
      if (field) {
        if (/port$/.test(field)) hit = String(p.sport) === val || String(p.dport) === val;
        else if (field === "ip.src" || field === "src") hit = p.src.toLowerCase() === val;
        else if (field === "ip.dst" || field === "dst") hit = p.dst.toLowerCase() === val;
        else if (/addr|host|ip$/.test(field)) hit = p.src.toLowerCase() === val || p.dst.toLowerCase() === val;
        else hit = (proto + " " + p.info.toLowerCase()).includes(val);
      } else if (["tcp", "udp"].includes(val)) {
        hit = proto === val || p.layers.some((l) => l.name.toLowerCase().startsWith(val === "tcp" ? "transmission" : "user datagram"));
      } else if (["ip", "ipv4"].includes(val)) hit = p.layers.some((l) => l.name.includes("Version 4"));
      else if (val === "ipv6") hit = p.layers.some((l) => l.name.includes("Version 6"));
      else if (val === "syn" || val === "rst" || val === "fin") hit = p.flags.toLowerCase().split(",").includes(val);
      else if (/^\d+$/.test(val)) hit = String(p.sport) === val || String(p.dport) === val || String(p.no) === val;
      else hit = proto === val || p.src.toLowerCase().includes(val) || p.dst.toLowerCase().includes(val) || p.info.toLowerCase().includes(val);
      return neg ? !hit : hit;
    };
    return (p) => groups.some((g) => g.every((t) => test(p, t)));
  }

  function hexdump(b) {
    const lines = [];
    for (let i = 0; i < b.length; i += 16) {
      const row = b.subarray(i, i + 16);
      const h = Array.from(row, (x) => hex(x)).join(" ").padEnd(47, " ");
      const a = Array.from(row, (x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : ".")).join("");
      lines.push(`<span class="off">${hex(i, 4)}</span>  ${h}  <span class="asc">${a.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>`);
      if (lines.length > 256) { lines.push("…"); break; }
    }
    return lines.join("\n");
  }

  /* ---------------- UI ---------------- */
  function init() {
    const $ = (id) => document.getElementById(id);
    const file = $("pcapFile"), drop = $("pcapDrop"), body = $("pcapBody"), rows = $("pcapRows");
    const tree = $("pcapTree"), hexEl = $("pcapHex"), filter = $("pcapFilter"), count = $("pcapCount"), stats = $("pcapStats");
    if (!file) return;
    let packets = [], shown = [], selected = null;
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    function load(buf, label) {
      let parsed;
      try { parsed = parseFile(buf); }
      catch (e) { window.toast && window.toast(e.message); return; }
      const t0 = parsed.packets.length ? parsed.packets[0].ts : 0;
      packets = parsed.packets.map((p, i) => Object.assign(dissect(p), { no: i + 1, t: p.ts - t0, len: p.orig, data: p.data }));
      drop.hidden = true; body.hidden = false;
      const by = {};
      packets.forEach((p) => (by[p.proto] = (by[p.proto] || 0) + 1));
      const bytes = packets.reduce((s, p) => s + p.len, 0);
      const dur = packets.length ? packets[packets.length - 1].t : 0;
      stats.innerHTML = `<span class="st" title="file">📄 ${esc(label)} · ${parsed.format}</span><span class="st">${packets.length} pkts · ${(bytes / 1024).toFixed(1)} KB · ${dur.toFixed(2)} s</span>` +
        Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="st" data-f="${esc(k.toLowerCase())}">${esc(k)} ${((v / packets.length) * 100).toFixed(0)}%</span>`).join("");
      selected = null; tree.innerHTML = "<em>Select a packet to inspect it.</em>"; hexEl.innerHTML = "";
      render();
      if (packets.length) select(packets[0]);
    }

    function render() {
      const f = compileFilter(filter.value);
      shown = packets.filter(f);
      const cap = 3000;
      rows.innerHTML = shown.slice(0, cap).map((p) =>
        `<tr data-no="${p.no}" class="p-${p.mark || (["TCP","UDP","DNS","TLS","HTTP","ICMP","ICMPv6","ARP","QUIC","mDNS"].includes(p.proto) ? (p.proto === "mDNS" ? "DNS" : p.proto) : "other")}${selected && selected.no === p.no ? " sel" : ""}"><td>${p.no}</td><td>${p.t.toFixed(6)}</td><td>${esc(p.src)}</td><td>${esc(p.dst)}</td><td>${esc(p.proto)}</td><td>${p.len}</td><td>${esc(p.info)}</td></tr>`).join("");
      count.textContent = `Displayed: ${shown.length} / ${packets.length}${shown.length > cap ? " (first " + cap + ")" : ""}`;
    }

    function select(p) {
      selected = p;
      rows.querySelectorAll("tr.sel").forEach((tr) => tr.classList.remove("sel"));
      const tr = rows.querySelector(`tr[data-no="${p.no}"]`); if (tr) tr.classList.add("sel");
      tree.innerHTML = p.layers.map((l, i) => `<details ${i === p.layers.length - 1 ? "open" : ""}><summary>${esc(l.name)}</summary>${l.fields.map(([k, v]) => `<div>${k ? esc(k) + ": " : ""}${esc(v)}</div>`).join("")}</details>`).join("");
      hexEl.innerHTML = hexdump(p.data);
    }

    rows.addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) select(packets[+tr.dataset.no - 1]); });
    rows.parentElement.parentElement.addEventListener("keydown", (e) => {
      if (!selected || !["ArrowDown", "ArrowUp"].includes(e.key)) return;
      const i = shown.indexOf(selected) + (e.key === "ArrowDown" ? 1 : -1);
      if (shown[i]) { e.preventDefault(); select(shown[i]); const tr = rows.querySelector(`tr[data-no="${shown[i].no}"]`); tr && tr.scrollIntoView({ block: "nearest" }); }
    });
    rows.parentElement.parentElement.tabIndex = 0;
    filter.addEventListener("input", render);
    stats.addEventListener("click", (e) => { const s = e.target.closest("[data-f]"); if (s) { filter.value = s.dataset.f; render(); } });
    file.addEventListener("change", () => { const f = file.files[0]; if (f) f.arrayBuffer().then((b) => load(b, f.name)); file.value = ""; });
    $("pcapSample").addEventListener("click", () => load(sample(), "n3core-sample.pcap"));
    const lab = $("lab");
    ["dragenter", "dragover"].forEach((ev) => lab.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => lab.addEventListener(ev, (e) => { e.preventDefault(); if (ev === "dragleave" && lab.contains(e.relatedTarget)) return; drop.classList.remove("over"); }));
    lab.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) f.arrayBuffer().then((b) => load(b, f.name)); });
  }

  window.PcapLab = { parseFile, dissect, sample, compileFilter, init };
})();
