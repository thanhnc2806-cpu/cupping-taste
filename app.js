/**
 * Trang người nếm — nối state/api/wheel/i18n vào DOM. Mọi chuỗi dữ liệu đi qua esc().
 * Vẽ lại toàn bộ #app sau mỗi thao tác (màn nhỏ, đơn giản hơn cập nhật từng phần).
 */
(function () {
  "use strict";
  var root = document.getElementById("app");
  var toastEl = document.getElementById("toast");
  var S = {
    lang: storeGet("cupping:lang", "vi") === "en" ? "en" : "vi",
    theme: storeGet("cupping:theme", "dark") === "light" ? "light" : "dark",
    sid: null, token: null, sess: null, identity: null, table: null,
    screen: "loading", errorCode: "", errorRetryable: false,
    role: "staff", pickStaff: null, guestNameDraft: "",
    sheet: "", zoom: [], pending: null, q: 0, noteDraft: "",
    toastTimer: null, offline: false, lastWheel: null,
    soloCount: 5, joinDraft: ""
  };

  var ICON = {
    score: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h11M4 18h14"/></svg>',
    card: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>',
    plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    defect: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
    done: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    undo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    redo: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>'
  };

  // ---------- tiện ích ----------
  function T(key) { return t(S.lang, key); }
  function isGuest() { return S.identity && S.identity.type === "guest"; }
  function draft() { return S.table.drafts[S.table.cur]; }
  function fmt1(x) { var s = (Math.round(x * 10) / 10).toFixed(1); return S.lang === "en" ? s : s.replace(".", ","); }
  function dots(n) { return "●●●●●".slice(0, n) + "○○○○○".slice(0, 5 - n); }
  function fieldName(key) { var f = FIELDS.filter(function (x) { return x.key === key; })[0]; return S.lang === "en" ? f.en : f.vi; }
  function sampleCode(id) {
    var s = (S.sess.samples || []).filter(function (x) { return x.sample_id === id; })[0];
    return s ? s.blind_code : "?";
  }
  function nodeByCode(code) {
    var parts = code.split("."), nodes = S.sess.taxonomy, node = null, path = [];
    for (var i = 0; i < parts.length; i++) {
      var want = parts.slice(0, i + 1).join(".");
      node = nodes.filter(function (n) { return n.code === want; })[0];
      if (!node) return null;
      path.push(node);
      nodes = node.children;
    }
    return { node: node, path: path };
  }
  function label(code) { var f = nodeByCode(code); return f ? f.node[S.lang] : code; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }
  function persist() { storeSet("cupping:table:" + S.sid, { drafts: S.table.drafts, saved: S.table.saved }); }
  // Toast sống trong #toast, NGOÀI #app — render() vẽ lại toàn bộ #app nên nếu toast còn
  // nằm trong đó, mỗi lần hiện/ẩn nó sẽ cướp mất ô đang gõ hoặc đóng sheet đang mở (spec F5).
  // toast() vì vậy KHÔNG BAO GIỜ gọi render()/softRender() — người gọi tự render() riêng
  // nếu bản thân thao tác đó cũng đổi state khác (xem sync() nhánh "rejected").
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    if (S.toastTimer) clearTimeout(S.toastTimer);
    S.toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2400);
  }
  function closeOverlay() { S.sheet = ""; S.zoom = []; S.pending = null; }
  function edit(mutator) { S.table = editCurrent(S.table, mutator); persist(); render(); }

  // ---------- khởi động ----------
  function parseSessionInput(str) {
    if (!str) return null;
    str = ("" + str).trim();
    if (!str) return null;
    var hashIndex = str.indexOf("#");
    var queryString = hashIndex >= 0 ? str.slice(hashIndex + 1) : (str.indexOf("s=") >= 0 ? str : "");
    if (queryString) {
      var p = new URLSearchParams(queryString.replace(/^#/, ""));
      var s = p.get("s"), tk = p.get("t");
      if (s && tk) return { s: s, t: tk };
    }
    var parts = str.split(/[:\s]+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { s: parts[0], t: parts[1] };
    }
    return null;
  }

  function readLink() {
    var p = new URLSearchParams(location.hash.replace(/^#/, ""));
    var s = p.get("s"), tk = p.get("t");
    if (s && tk) {
      storeSet("cupping:last", { s: s, t: tk, name: s });
      history.replaceState(null, "", location.pathname + location.search); // xoá token khỏi thanh địa chỉ
      return { s: s, t: tk };
    }
    return null;
  }

  function startTable() {
    var ids = S.sess.samples.map(function (x) { return x.sample_id; });
    if (S.table) S.table = addSamples(S.table, ids);
    else {
      var saved = storeGet("cupping:table:" + S.sid, null);
      S.table = createTable(ids, saved && saved.drafts, saved && saved.saved);
    }
    S.screen = S.identity ? "table" : "entry";
  }

  function showError(code, retryable) { S.screen = "error"; S.errorCode = code; S.errorRetryable = !!retryable; render(); }

  function openSession(sid, token) {
    S.sid = sid; S.token = token;
    S.identity = storeGet("cupping:id:" + S.sid, null);
    var cached = storeGet("cupping:sess:" + S.sid, null);
    if (cached) {
      S.sess = cached;
      startTable();
      render();
    } else {
      S.screen = "loading";
      render();
    }
    if (token === "solo") {
      if (!S.sess) startSoloSession(S.soloCount || 5);
    } else {
      fetchSession();
    }
  }

  function startSoloSession(sampleCount) {
    var count = sampleCount || S.soloCount || 5;
    var now = new Date();
    var day = now.getDate() < 10 ? "0" + now.getDate() : now.getDate();
    var month = (now.getMonth() + 1) < 10 ? "0" + (now.getMonth() + 1) : (now.getMonth() + 1);
    var dateStr = day + "/" + month;
    var sid = "solo_" + Date.now();
    var samples = [];
    for (var i = 1; i <= count; i++) {
      var code = "A" + (i < 10 ? "0" + i : i);
      samples.push({ sample_id: "s_" + i, blind_code: code });
    }
    var tax = (typeof TAXONOMY_DEFAULT !== "undefined" && Array.isArray(TAXONOMY_DEFAULT) && TAXONOMY_DEFAULT.length)
      ? TAXONOMY_DEFAULT
      : (S.sess && S.sess.taxonomy ? S.sess.taxonomy : []);
    var taxVer = typeof TAXONOMY_VERSION !== "undefined" ? TAXONOMY_VERSION : "sca-2024";

    var sessName = (S.lang === "en" ? "Solo Cupping · " : "Cupping tự do · ") + dateStr;
    S.sid = sid;
    S.token = "solo";
    S.sess = {
      session: {
        id: sid,
        name: sessName,
        purpose: "QC nội bộ"
      },
      samples: samples,
      staff: [
        { id: "thanh", name: "Thanh (Head of Roaster)" },
        { id: "minh", name: "Minh" },
        { id: "an", name: "An" },
        { id: "vinh", name: "Vinh" }
      ],
      taxonomy: tax,
      taxonomy_version: taxVer
    };
    storeSet("cupping:sess:" + sid, S.sess);
    storeSet("cupping:last", { s: sid, t: "solo", name: sessName });

    var savedId = storeGet("cupping:id:solo", null);
    S.identity = savedId || { type: "staff", staff_id: "thanh", name: "Thanh" };
    storeSet("cupping:id:" + sid, S.identity);

    startTable();
    render();
  }

  function boot() {
    document.body.classList.toggle("light-mode", S.theme === "light");
    var link = readLink();
    if (link) {
      openSession(link.s, link.t);
    } else {
      S.screen = "hub";
      render();
    }
    window.addEventListener("online", sync);
    window.addEventListener("online", function () {
      if (S.screen === "error" && S.errorRetryable) fetchSession();
    });
    setInterval(sync, 15000);
    setInterval(refreshSamples, 30000);
  }

  // Gọi getSession — tách khỏi boot() để gọi lại được (nút "Thử lại" hoặc sự kiện online).
  function fetchSession() {
    apiPost("getSession", S.sid, S.token).then(function (r) {
      if (r.ok) {
        S.sess = { session: r.session, samples: r.samples, staff: r.staff, taxonomy: r.taxonomy, taxonomy_version: r.taxonomy_version };
        storeSet("cupping:sess:" + S.sid, S.sess);
        startTable(); render(); sync();
      } else if (r.error === "NETWORK" && S.sess) {
        S.offline = true; render();
      } else if (isRetryable(r.error) && !S.sess) {
        // Chưa có cache để hiện tạm — màn lỗi phải cho người dùng đường thoát rõ ràng,
        // không chỉ hứa suông "sẽ tự gửi lại" (spec F3).
        showError(r.error, true);
      } else {
        showError(r.error);
      }
    });
  }

  function softRender() { if (S.sheet !== "card" && S.screen !== "entry") render(); } // không cướp ô đang gõ

  function refreshSamples() {
    if (!S.sess || S.screen !== "table" || S.token === "solo") return;
    apiPost("listSamples", S.sid, S.token).then(function (r) {
      if (!r.ok) return;
      S.sess.samples = r.samples;
      storeSet("cupping:sess:" + S.sid, S.sess);
      S.table = addSamples(S.table, r.samples.map(function (x) { return x.sample_id; }));
      persist(); softRender();
    });
  }

  function sync() {
    flushQueue(function (ev) {
      if (ev.type === "offline") S.offline = true;
      if (ev.type === "saved" || ev.type === "idle") S.offline = false;
      if (ev.type === "rejected" && ev.session_id === S.sid && S.table) {
        S.table = unmarkSaved(S.table, ev.sample_id, ev.revision);
        persist();
        softRender(); // gỡ dấu ✓ giả trên chip mẫu — tách khỏi toast, toast tự vẽ ở lớp riêng
        toast(sampleCode(ev.sample_id) + ": " + errorText(S.lang, ev.error));
        return;
      }
      softRender();
    });
  }

  // ---------- màn ----------
  function langToggle() {
    return '<div class="top-controls">' +
      '<button type="button" class="theme-btn" data-act="theme" aria-label="' + esc(T("toggleTheme")) + '">' + (S.theme === "light" ? "🌙" : "☀️") + '</button>' +
      '<div class="lang">' +
      '<button type="button" data-act="lang" data-v="vi" aria-pressed="' + (S.lang === "vi") + '" class="' + (S.lang === "vi" ? "on" : "") + '">VI</button>' +
      '<button type="button" data-act="lang" data-v="en" aria-pressed="' + (S.lang === "en") + '" class="' + (S.lang === "en" ? "on" : "") + '">EN</button></div>' +
      '</div>';
  }

  function renderRadarSvg(scores, isLight) {
    var cx = 140, cy = 90, maxR = 64;
    var n = SCORE_FIELDS.length;
    var html = '';
    var ringColor = isLight ? '#DDD6CC' : '#2A303C';
    var textColor = isLight ? '#555555' : '#C5BCB2';
    for (var r = 1; r <= 3; r++) {
      var curR = (maxR / 3) * r;
      var pts = [];
      for (var i = 0; i < n; i++) {
        var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        pts.push((cx + curR * Math.cos(angle)).toFixed(1) + "," + (cy + curR * Math.sin(angle)).toFixed(1));
      }
      html += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + ringColor + '" stroke-width="1" />';
    }
    SCORE_FIELDS.forEach(function (f, i) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var x = cx + maxR * Math.cos(angle);
      var y = cy + maxR * Math.sin(angle);
      html += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + ringColor + '" stroke-width="1" />';
      var tx = cx + (maxR + 15) * Math.cos(angle);
      var ty = cy + (maxR + 11) * Math.sin(angle);
      var fieldObj = FIELDS.filter(function (x) { return x.key === f; })[0];
      var lbl = fieldObj ? (S.lang === "en" ? fieldObj.short_en : fieldObj.short_vi) : f;
      html += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" fill="' + textColor + '" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="middle">' + esc(lbl) + '</text>';
    });
    var hasAny = false;
    var dataPts = [];
    SCORE_FIELDS.forEach(function (f, i) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var val = typeof scores[f] === "number" ? scores[f] : 0;
      if (val > 0) hasAny = true;
      var valR = (val / 9) * maxR;
      dataPts.push((cx + valR * Math.cos(angle)).toFixed(1) + "," + (cy + valR * Math.sin(angle)).toFixed(1));
    });
    if (hasAny) {
      html += '<polygon points="' + dataPts.join(' ') + '" fill="rgba(82, 183, 136, 0.28)" stroke="#52B788" stroke-width="2" />';
      SCORE_FIELDS.forEach(function (f, i) {
        if (typeof scores[f] === "number") {
          var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
          var valR = (scores[f] / 9) * maxR;
          html += '<circle cx="' + (cx + valR * Math.cos(angle)).toFixed(1) + '" cy="' + (cy + valR * Math.sin(angle)).toFixed(1) + '" r="3.5" fill="#52B788" stroke="#FFF" stroke-width="1.2" />';
        }
      });
    }
    return '<svg viewBox="0 0 280 180" class="radar-svg" role="img" aria-label="CVA Radar Chart">' + html + '</svg>';
  }

  var SAMPLE_COLORS = ["#52B788", "#E5A970", "#6BA8F2", "#9B5DE5", "#E76F51", "#F4A261", "#2A9D8F"];

  function renderMultiRadarSvg(samples, isLight) {
    var cx = 140, cy = 90, maxR = 64;
    var n = SCORE_FIELDS.length;
    var html = '';
    var ringColor = isLight ? '#DDD6CC' : '#2A303C';
    var textColor = isLight ? '#555555' : '#C5BCB2';
    for (var r = 1; r <= 3; r++) {
      var curR = (maxR / 3) * r;
      var pts = [];
      for (var i = 0; i < n; i++) {
        var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        pts.push((cx + curR * Math.cos(angle)).toFixed(1) + "," + (cy + curR * Math.sin(angle)).toFixed(1));
      }
      html += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="' + ringColor + '" stroke-width="1" />';
    }
    SCORE_FIELDS.forEach(function (f, i) {
      var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
      var x = cx + maxR * Math.cos(angle);
      var y = cy + maxR * Math.sin(angle);
      html += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + ringColor + '" stroke-width="1" />';
      var tx = cx + (maxR + 15) * Math.cos(angle);
      var ty = cy + (maxR + 11) * Math.sin(angle);
      var fieldObj = FIELDS.filter(function (x) { return x.key === f; })[0];
      var lbl = fieldObj ? (S.lang === "en" ? fieldObj.short_en : fieldObj.short_vi) : f;
      html += '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" fill="' + textColor + '" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="middle">' + esc(lbl) + '</text>';
    });

    samples.slice(0, 5).forEach(function (s, sIdx) {
      var color = SAMPLE_COLORS[sIdx % SAMPLE_COLORS.length];
      var dataPts = [];
      var hasAny = false;
      SCORE_FIELDS.forEach(function (f, i) {
        var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
        var val = typeof s.scores[f] === "number" ? s.scores[f] : 0;
        if (val > 0) hasAny = true;
        var valR = (val / 9) * maxR;
        dataPts.push((cx + valR * Math.cos(angle)).toFixed(1) + "," + (cy + valR * Math.sin(angle)).toFixed(1));
      });
      if (hasAny) {
        html += '<polygon points="' + dataPts.join(' ') + '" fill="' + color + '" fill-opacity="0.16" stroke="' + color + '" stroke-width="2" />';
        SCORE_FIELDS.forEach(function (f, i) {
          if (typeof s.scores[f] === "number") {
            var angle = (Math.PI * 2 / n) * i - Math.PI / 2;
            var valR = (s.scores[f] / 9) * maxR;
            html += '<circle cx="' + (cx + valR * Math.cos(angle)).toFixed(1) + '" cy="' + (cy + valR * Math.sin(angle)).toFixed(1) + '" r="3" fill="' + color + '" stroke="#FFF" stroke-width="1" />';
          }
        });
      }
    });

    return '<svg viewBox="0 0 280 180" class="radar-svg" role="img" aria-label="CVA Multi Radar Chart">' + html + '</svg>';
  }

  function getRankedSamples() {
    if (!S.table || !S.table.order) return [];
    var list = S.table.order.map(function (id) {
      var saved = S.table.saved && S.table.saved[id];
      var d = saved ? saved.draft : (S.table.drafts[id] || emptyDraft());
      var avg = saved ? saved.avg : liveAverage(d);
      var isSaved = !!saved;
      var hasDefect = Object.keys(d.defects || {}).length > 0;
      return {
        id: id,
        code: sampleCode(id),
        draft: d,
        scores: d.scores || {},
        descriptors: d.descriptors || {},
        defects: d.defects || {},
        note: d.note || "",
        vibe: d.vibe || "",
        avg: avg,
        isSaved: isSaved,
        hasDefect: hasDefect
      };
    });
    list.sort(function (a, b) {
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });
    return list;
  }

  function generateReportText() {
    var ranked = getRankedSamples();
    var lines = [];
    var now = new Date();
    var dateStr = (now.getDate() < 10 ? "0" + now.getDate() : now.getDate()) + "/" +
                  ((now.getMonth() + 1) < 10 ? "0" + (now.getMonth() + 1) : (now.getMonth() + 1)) + "/" +
                  now.getFullYear();
    lines.push("☕ KẾT QUẢ CUPPING · INTENSO ROASTERY");
    lines.push("Phiên: " + (S.sess ? S.sess.session.name : "Cupping"));
    lines.push("Người nếm: " + (S.identity ? S.identity.name : "Thợ rang"));
    lines.push("Ngày: " + dateStr);
    lines.push("----------------------------------");
    var medals = ["🥇", "🥈", "🥉"];
    ranked.forEach(function (s, idx) {
      var badge = idx < 3 ? medals[idx] : "•";
      var scoreStr = s.avg !== null ? fmt1(s.avg) + " điểm" : "Chưa chấm";
      var vibeStr = s.vibe === "like" ? " (Thích 😍)" : (s.vibe === "dislike" ? " (Lệch 😕)" : (s.vibe === "neutral" ? " (Vừa 😐)" : ""));
      lines.push(badge + " " + s.code + ": " + scoreStr + vibeStr);
      var descs = Object.keys(s.descriptors).map(function (c) {
        return label(c) + " (" + s.descriptors[c] + "/5)";
      });
      if (descs.length) lines.push("   Hương vị: " + descs.join(", "));
      var defs = Object.keys(s.defects).map(label);
      if (defs.length) lines.push("   ⚠️ Lỗi: " + defs.join(", "));
      if (s.note) lines.push("   Ghi chú: " + s.note);
    });
    lines.push("----------------------------------");
    var completed = ranked.filter(function (x) { return x.avg !== null; });
    if (completed.length) {
      var avgAll = completed.reduce(function (sum, x) { return sum + x.avg; }, 0) / completed.length;
      lines.push("Điểm TB toàn phiên: " + fmt1(avgAll));
    }
    return lines.join("\n");
  }

  function copyReportToClipboard() {
    var text = generateReportText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast(T("reportCopied"));
      }).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast(T("reportCopied"));
    } catch (e) {
      toast("Không thể sao chép");
    }
  }

  function viewEntry() {
    var staff = S.sess.staff || [];
    var h = '<div class="toprow"><button type="button" class="nav-hub-btn" data-act="goHub">‹ ' + esc(T("goHub")) + '</button>' + langToggle() + '</div>' +
      '<p class="kicker">' + esc(purposeText(S.lang, S.sess.session.purpose)) + '</p>' +
      '<h1 class="title">' + esc(S.sess.session.name) + '</h1>' +
      '<p class="muted">' + esc(T("blindNote")) + '</p>' +
      '<div class="label">' + esc(T("whoAreYou")) + '<div class="seg2">' +
      '<button type="button" class="role' + (S.role === "staff" ? " on" : "") + '" data-act="role" data-v="staff" aria-pressed="' + (S.role === "staff") + '">' + esc(T("staff")) + '</button>' +
      '<button type="button" class="role' + (S.role === "guest" ? " on" : "") + '" data-act="role" data-v="guest" aria-pressed="' + (S.role === "guest") + '">' + esc(T("guest")) + '</button></div></div>';
    if (S.role === "staff") {
      h += '<div class="label">' + esc(T("pickName")) + '</div>';
      h += staff.length ? staff.map(function (p) {
        var on = S.pickStaff === p.id;
        return '<button type="button" class="pick' + (on ? " on" : "") + '" data-act="pickStaff" data-id="' + esc(p.id) + '" aria-pressed="' + on + '">' + esc(p.name) + '</button>';
      }).join("") : '<p class="muted">' + esc(T("noStaff")) + '</p>';
    } else {
      h += '<label class="label">' + esc(T("yourName")) +
        '<input id="guestName" type="text" maxlength="40" autocomplete="off" value="' + esc(S.guestNameDraft) + '" placeholder="' + esc(T("namePh")) + '"></label>' +
        '<p class="muted small">' + esc(T("guestHint")) + '</p>';
    }
    h += '<button type="button" class="cta" data-act="enter">' + esc(T("enter")) + '</button>';
    return '<main class="screen entry">' + h + '</main>';
  }

  function syncPill() {
    if (S.token === "solo") {
      return '<span class="sync">☕ ' + esc(T("soloLocal")) + '</span>';
    }
    var n = queueCount(S.sid);
    if (!n) return '<span class="sync">' + esc(T("synced")) + '</span>';
    if (S.offline) return '<span class="sync off">' + esc(T("offline")) + ' (' + n + ')</span>';
    return '<span class="sync busy">' + esc(T("saving")) + ' (' + n + ')</span>';
  }

  function viewTable() {
    var d = draft(), guest = isGuest();
    if (!S.table.order.length) {
      return '<main class="screen"><div class="toprow">' + syncPill() + '<button type="button" class="nav-hub-btn" data-act="goHub">‹ ' + esc(T("goHub")) + '</button>' + langToggle() + '</div><p class="muted">' + esc(T("noSamples")) + '</p></main>';
    }
    var chips = S.table.order.map(function (id) {
      var st = sampleStatus(S.table, id), on = id === S.table.cur;
      var curDraft = S.table.drafts[id] || {};
      var hasDefect = Object.keys(curDraft.defects || {}).length > 0;
      var statusClass = hasDefect ? "chip-defect" : (st === "saved" ? "chip-finished" : (st === "wip" ? "chip-inprogress" : "chip-uncupped"));
      var sub = hasDefect ? "⚠️ " + T("defect") : (st === "saved" ? fmt1(S.table.saved[id].avg) + " ✓" : (st === "wip" ? "● " + T("inProgress") : T("unCupped")));
      return '<button type="button" class="chip ' + statusClass + (st === "saved" ? " saved" : "") + (on ? " on" : "") + '" data-act="sample" data-id="' + esc(id) + '" aria-pressed="' + on + '">' +
        '<b>' + esc(sampleCode(id)) + '</b><span>' + esc(sub) + '</span></button>';
    }).join("");
    var la = liveAverage(d), scored = 7 - missingScores(d).length;
    var avgText = la === null ? "—" : fmt1(la) + (scored < 7 ? " (" + scored + "/7)" : "");
    var mini = FIELDS.map(function (f) {
      var v = d.scores[f.key], has = typeof v === "number";
      return '<div><b class="' + (has ? "" : "empty") + '">' + (has ? v : "–") + '</b>' + esc(S.lang === "en" ? f.short_en : f.short_vi) + '</div>';
    }).join("");
    var descCodes = Object.keys(d.descriptors);
    var tags = descCodes.map(function (c) {
      return '<span class="tag" style="background:' + WHEEL_COLORS[c.split(".")[0]] + '">' + esc(label(c)) + ' <span>' + dots(d.descriptors[c]) + '</span></span>';
    }).join("");
    var defCodes = Object.keys(d.defects);

    var vibe = d.vibe || "";
    var smileBar = '<div class="smile-card">' +
      '<span class="smile-label">' + esc(T("quickImpression")) + '</span>' +
      '<div class="smile-options">' +
      '<button type="button" class="smile-btn' + (vibe === "like" ? " active" : "") + '" data-act="vibe" data-v="like" aria-label="' + esc(T("vibeLike")) + '">😍 ' + esc(T("vibeLike")) + '</button>' +
      '<button type="button" class="smile-btn' + (vibe === "neutral" ? " active" : "") + '" data-act="vibe" data-v="neutral" aria-label="' + esc(T("vibeNeutral")) + '">😐 ' + esc(T("vibeNeutral")) + '</button>' +
      '<button type="button" class="smile-btn' + (vibe === "dislike" ? " active" : "") + '" data-act="vibe" data-v="dislike" aria-label="' + esc(T("vibeDislike")) + '">😕 ' + esc(T("vibeDislike")) + '</button>' +
      '</div></div>';

    var allDone = S.table.order.length > 0 && S.table.order.every(function (id) {
      return S.table.saved && S.table.saved[id];
    });
    var banner = allDone ? '<div class="all-done-banner" data-act="goSummary">🎉 ' + esc(T("allDoneBanner")) + '</div>' : '';

    var h = '<div class="toprow">' + syncPill() +
      '<button type="button" class="who" data-act="changeUser">' + esc(S.identity.name) + ' · ' + esc(T("changeUser")) + '</button>' +
      '<button type="button" class="nav-hub-btn" data-act="goSummary" aria-label="' + esc(T("summary")) + '">📊 ' + esc(T("summary")) + '</button>' +
      '<button type="button" class="nav-hub-btn" data-act="goHub" aria-label="' + esc(T("goHub")) + '">🏠 ' + esc(T("goHub")) + '</button>' +
      langToggle() + '</div>' +
      banner +
      '<div class="chips">' + chips + '</div>' +
      '<div class="headline"><div><p class="kicker">' + esc(T("blind")) + ' · ' + esc(guest ? T("guest") : T("staff")) + '</p>' +
      '<span class="code">' + esc(sampleCode(S.table.cur)) + '</span><span class="liveavg">' + esc(T("avg")) + ' ' + esc(avgText) + '</span></div>' +
      '<div class="icons"><button type="button" class="icon" data-act="undo" aria-label="' + esc(T("undo")) + '"' + (S.table.undo.length ? "" : " disabled") + '>' + ICON.undo + '</button>' +
      '<button type="button" class="icon" data-act="redo" aria-label="' + esc(T("redo")) + '"' + (S.table.redo.length ? "" : " disabled") + '>' + ICON.redo + '</button></div></div>' +
      smileBar +
      '<button type="button" class="card radar-card" data-act="open" data-v="score"><h2>' + esc(T("cvaProfile")) + ' · ' + scored + '/7<em>' + esc(T("edit")) + ' ›</em></h2>' +
      '<div class="radar-wrap">' + renderRadarSvg(d.scores, S.theme === "light") + '</div>' +
      '<div class="mini">' + mini + '</div></button>' +
      '<div class="card"><h2>' + esc(T("flavors")) + ' · ' + descCodes.length + '</h2>' +
      (descCodes.length ? '<div class="tags">' + tags + '</div>' : '<span class="muted">' + esc(T("emptyFlavor")) + '</span>') + '</div>';
    if (!guest) {
      h += '<div class="card"><h2>' + esc(T("defects")) + ' · ' + defCodes.length + '</h2>' +
        (defCodes.length ? '<div class="tags">' + defCodes.map(function (c) { return '<span class="tag def">' + esc(label(c)) + '</span>'; }).join("") + '</div>' : '<span class="muted">' + esc(T("none")) + '</span>') + '</div>';
    }
    h += '<div class="card dashed">' + esc(d.note || T("noteEmpty")) + '</div>';

    var tab = function (act, v, icon, text, extra) {
      return '<button type="button" class="tab' + (extra || "") + '" data-act="' + act + '"' + (v ? ' data-v="' + v + '"' : "") + '>' + icon + '<span>' + esc(text) + '</span></button>';
    };
    h += '<nav class="bar"><div class="half">' + tab("open", "score", ICON.score, T("score")) + tab("open", "card", ICON.card, T("card")) + '</div>' +
      '<div class="mid"><button type="button" class="fab" data-act="open" data-v="wheel" aria-label="' + esc(T("addFlavor")) + '">' + ICON.plus + '</button></div>' +
      '<div class="half">' + (guest ? "" : tab("open", "defects", ICON.defect, T("defects"))) + tab("finish", "", ICON.done, T("done"), " go") + '</div></nav>';

    if (S.sheet === "wheel") h += viewWheel();
    else if (S.sheet) h += '<div class="scrim" data-act="close"></div><section class="sheet" role="dialog" aria-modal="true">' + viewSheet() + '</section>';
    return '<main class="screen">' + h + '</main>';
  }

  function nineButtons(field, big) {
    var cur = draft().scores[field], h = '<div class="nine' + (big ? " big" : "") + '">';
    for (var n = 1; n <= 9; n++) {
      h += '<button type="button" class="' + (cur === n ? "on" : "") + '" data-act="' + (big ? "qscore" : "score") + '" data-f="' + field + '" data-n="' + n + '" aria-pressed="' + (cur === n) + '" aria-label="' + esc(fieldName(field)) + ' ' + n + '">' + n + '</button>';
    }
    return h + '</div>';
  }

  function viewSheet() {
    var d = draft(), code = sampleCode(S.table.cur), h;
    var head = function (title) { return '<div class="sheet-head"><span>' + esc(title) + ' · ' + esc(code) + '</span><button type="button" data-act="close" aria-label="' + esc(T("close")) + '">×</button></div>'; };
    if (S.sheet === "score" && !isGuest()) {
      h = head(T("scoreTitle")) + '<p class="muted small">' + esc(T("avgNote")) + '</p>';
      FIELDS.forEach(function (f) {
        h += '<div><div class="row-label">' + esc(S.lang === "en" ? f.en : f.vi) + '<span>' + esc(S.lang === "en" ? f.vi : f.en) + '</span></div>' + nineButtons(f.key, false) + '</div>';
      });
      return h + '<div class="ends"><span>' + esc(T("scaleLo")) + '</span><span>' + esc(T("scaleHi")) + '</span></div>';
    }
    if (S.sheet === "score") {
      var f = FIELDS[S.q];
      h = head(T("guestTitle")) + '<p class="kicker">' + esc(T("question")) + ' ' + (S.q + 1) + '/7</p>' +
        '<div class="qtext">' + esc(S.lang === "en" ? f.q_en : f.q_vi) + '</div>' + nineButtons(f.key, true) +
        '<div class="ends"><span>' + esc(T("like0")) + '</span><span>' + esc(T("like1")) + '</span></div><div class="qdots">';
      FIELDS.forEach(function (x, i) { h += '<i class="' + (i === S.q ? "cur" : (typeof d.scores[x.key] === "number" ? "done" : "")) + '"></i>'; });
      return h + '</div><button type="button" class="ghost" data-act="prevQ"' + (S.q === 0 ? " disabled" : "") + '>' + esc(T("prevQ")) + '</button>';
    }
    if (S.sheet === "card") {
      h = head(T("cardTitle"));
      var codes = Object.keys(d.descriptors);
      if (!codes.length) h += '<p class="muted">' + esc(T("emptyFlavor")) + '</p>';
      codes.forEach(function (c) {
        var found = nodeByCode(c), path = found ? found.path.slice(0, -1).map(function (n) { return n[S.lang]; }).join(" › ") : "";
        h += '<div class="crow"><span class="dot" style="background:' + WHEEL_COLORS[c.split(".")[0]] + '"></span>' +
          '<span class="nm">' + esc(label(c)) + '<span>' + esc(path) + '</span></span>';
        for (var n = 1; n <= 5; n++) {
          h += '<button type="button" class="lv" data-act="intensity" data-code="' + esc(c) + '" data-n="' + n + '" aria-label="' + esc(label(c)) + ' ' + esc(T("intensity")) + ' ' + n + '/5"><i class="' + (n <= d.descriptors[c] ? "on" : "") + '"></i></button>';
        }
        h += '<button type="button" class="rm" data-act="rmDesc" data-code="' + esc(c) + '" aria-label="' + esc(T("removed")) + ' ' + esc(label(c)) + '">×</button></div>';
      });
      return h + '<label class="note">' + esc(T("note")) + '<textarea id="note" rows="3" maxlength="500" placeholder="' + esc(T("notePh")) + '">' + esc(S.noteDraft) + '</textarea></label>';
    }
    // defects
    h = head(T("defTitle"));
    var other = S.sess.taxonomy.filter(function (g) { return g.code === "other"; })[0];
    other.children.forEach(function (sub) {
      h += '<div class="defgrp"><p>' + esc(sub[S.lang]) + '</p><div class="tags">' + sub.children.map(function (x) {
        var on = !!d.defects[x.code];
        return '<button type="button" class="defbtn' + (on ? " on" : "") + '" data-act="defect" data-code="' + esc(x.code) + '" aria-pressed="' + on + '">' + esc(x[S.lang]) + '</button>';
      }).join("") + '</div></div>';
    });
    return h;
  }

  function viewWheel() {
    var v = wheelView(S.sess.taxonomy, { mode: isGuest() ? "guest" : "staff", zoom: S.zoom, pending: S.pending, selected: draft().descriptors, lang: S.lang });
    S.lastWheel = v;
    var paths = v.segments.map(function (s, i) {
      return '<path d="' + s.d + '" fill="' + s.fill + '" class="' + (s.selected ? "sel" : "") + '" data-act="seg" data-i="' + i + '"></path>';
    }).join("");
    var texts = v.segments.map(function (s) {
      return '<text x="' + s.tx + '" y="' + s.ty + '" transform="rotate(' + s.rot + ' ' + s.tx + ' ' + s.ty + ')" text-anchor="middle" dominant-baseline="middle" font-size="' + s.fs + '" font-weight="' + (s.selected ? 700 : 600) + '">' + esc(s.label) + '</text>';
    }).join("");
    var pill = v.pill.kind === "pick" ? '<button type="button" class="pill" data-act="pickNode">' + esc(T("choose")) + ' «' + esc(v.pill.name) + '»</button>'
      : v.pill.kind === "info" ? '<div class="pill info">' + esc(v.pill.name) + ' — ' + esc(T("strength")) + '</div>'
      : '<div class="pill hint">' + esc(T("tapGroup")) + '</div>';
    return '<div class="scrim" data-act="close"></div><div class="wheelwrap">' + pill +
      '<svg viewBox="0 0 400 200" role="img" aria-label="' + esc(T("wheelAria")) + '">' + paths + texts + '</svg></div>' +
      '<button type="button" class="hub" data-act="wheelBack" aria-label="' + esc(v.center === "close" ? T("closeWheel") : T("back")) + '">' + (v.center === "close" ? "×" : "‹") + '</button>';
  }

  function viewHub() {
    var last = storeGet("cupping:last", null);
    var resumeCard = "";
    if (last && last.s && last.t) {
      var lastName = last.name || last.s;
      resumeCard = '<div class="card hub-card resume-card">' +
        '<div class="hub-head">' +
        '<span class="hub-badge">🔄 ' + esc(T("resumeLast")) + '</span>' +
        '<h3>' + esc(lastName) + '</h3>' +
        '</div>' +
        '<button type="button" class="btn-resume" data-act="resumeLast">' + esc(T("resumeBtn")) + '</button>' +
        '</div>';
    }

    var counts = [3, 5, 8, 10];
    var countBtns = counts.map(function (c) {
      var on = (S.soloCount || 5) === c;
      return '<button type="button" class="count-btn' + (on ? " on" : "") + '" data-act="setSoloCount" data-v="' + c + '">' + c + ' ' + esc(T("samplesUnit")) + '</button>';
    }).join("");

    var h = '<div class="toprow">' +
      '<div class="hub-brand"><span>INTENSO ROASTERY</span><b>' + esc(T("hubTitle")) + '</b></div>' +
      langToggle() + '</div>' +
      '<div class="hub-hero">' +
      '<p class="kicker">LAB NẾM THỬ CÀ PHÊ</p>' +
      '<h1 class="title">' + esc(T("hubTitle")) + '</h1>' +
      '<p class="muted">' + esc(T("hubSub")) + '</p>' +
      '</div>' +
      resumeCard +
      '<div class="card hub-card solo-card">' +
      '<div class="hub-head">' +
      '<span class="hub-badge primary">☕ ' + esc(T("startSolo")) + '</span>' +
      '<p class="muted small">' + esc(T("soloDesc")) + '</p>' +
      '</div>' +
      '<div class="solo-settings">' +
      '<label class="label">' + esc(T("samplesCount")) +
      '<div class="count-row">' + countBtns + '</div></label>' +
      '</div>' +
      '<button type="button" class="cta-solo" data-act="startSolo">' + esc(T("startBtn")) + '</button>' +
      '</div>' +
      '<div class="card hub-card join-card">' +
      '<div class="hub-head">' +
      '<span class="hub-badge secondary">🔗 ' + esc(T("joinTitle")) + '</span>' +
      '<p class="muted small">' + esc(T("joinDesc")) + '</p>' +
      '</div>' +
      '<div class="join-row">' +
      '<input type="text" id="joinInput" value="' + esc(S.joinDraft) + '" placeholder="' + esc(T("joinPh")) + '" autocomplete="off">' +
      '<button type="button" class="btn-join" data-act="joinSession">' + esc(T("joinBtn")) + '</button>' +
      '</div>' +
      '</div>';
    return '<main class="screen hub-screen">' + h + '</main>';
  }

  function viewSummary() {
    var ranked = getRankedSamples();
    var completed = ranked.filter(function (x) { return x.avg !== null; });
    var sessName = S.sess ? S.sess.session.name : "";
    var tasterName = S.identity ? S.identity.name : "";

    var sessionAvg = completed.length ? (completed.reduce(function (acc, x) { return acc + x.avg; }, 0) / completed.length) : null;
    var topSample = completed.length ? completed[0].code : "—";

    var legendItems = ranked.slice(0, 5).map(function (s, idx) {
      var color = SAMPLE_COLORS[idx % SAMPLE_COLORS.length];
      var scoreStr = s.avg !== null ? fmt1(s.avg) : "–";
      return '<span class="legend-item"><span class="legend-dot" style="background:' + color + '"></span>' +
        esc(s.code) + ' (' + scoreStr + ')</span>';
    }).join("");

    var medals = ["🥇", "🥈", "🥉"];
    var rankingRows = ranked.map(function (s, idx) {
      var rankBadge = idx < 3 ? medals[idx] : '#' + (idx + 1);
      var scoreStr = s.avg !== null ? fmt1(s.avg) : "–";
      var vibeIcon = s.vibe === "like" ? " 😍" : (s.vibe === "neutral" ? " 😐" : (s.vibe === "dislike" ? " 😕" : ""));
      var descKeys = Object.keys(s.descriptors);
      var tagsHtml = descKeys.slice(0, 3).map(function (c) {
        return '<span class="tag" style="background:' + WHEEL_COLORS[c.split(".")[0]] + ';padding:2px 8px;font-size:11px;">' +
          esc(label(c)) + '</span>';
      }).join("");
      var defectTag = s.hasDefect ? '<span class="tag def" style="padding:2px 8px;font-size:11px;">⚠️ ' + esc(T("defect")) + '</span>' : '';

      return '<div class="ranking-row">' +
        '<div class="ranking-left">' +
        '<span class="ranking-rank">' + rankBadge + '</span>' +
        '<div>' +
        '<div style="display:flex;align-items:center;gap:6px;"><span class="ranking-code">' + esc(s.code) + '</span>' + vibeIcon + '</div>' +
        '<div class="ranking-tags">' + tagsHtml + defectTag + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="ranking-right">' +
        '<span class="ranking-score">' + scoreStr + '</span>' +
        '<span class="small muted">' + (s.isSaved ? "✓ " + esc(T("done")) : esc(T("unCupped"))) + '</span>' +
        '</div>' +
        '</div>';
    }).join("");

    var allDesc = {};
    ranked.forEach(function (s) {
      Object.keys(s.descriptors).forEach(function (code) {
        allDesc[code] = (allDesc[code] || 0) + 1;
      });
    });
    var descList = Object.keys(allDesc).map(function (code) {
      return { code: code, count: allDesc[code] };
    });
    descList.sort(function (a, b) { return b.count - a.count; });
    var topDescHtml = descList.length ? descList.slice(0, 8).map(function (d) {
      var group = d.code.split(".")[0];
      return '<span class="consensus-pill">' +
        '<span class="legend-dot" style="background:' + WHEEL_COLORS[group] + '"></span>' +
        esc(label(d.code)) + ' <b>' + d.count + ' ' + esc(T("votes")) + '</b></span>';
    }).join("") : '<span class="muted small">' + esc(T("emptyFlavor")) + '</span>';

    var h = '<div class="toprow">' +
      '<button type="button" class="nav-hub-btn" data-act="backToTable">‹ ' + esc(T("backToTable")) + '</button>' +
      langToggle() + '</div>' +
      '<div class="summary-hero">' +
      '<p class="kicker">INTENSO ROASTERY · CUPPING LAB</p>' +
      '<h1 class="title">' + esc(T("summaryTitle")) + '</h1>' +
      '<p class="muted">' + esc(sessName) + (tasterName ? ' · ' + esc(tasterName) : '') + '</p>' +
      '</div>' +
      '<div class="summary-stats">' +
      '<div class="stat-box">' +
      '<span class="stat-num">' + (sessionAvg !== null ? fmt1(sessionAvg) : "—") + '</span>' +
      '<span class="stat-label">' + esc(T("sessionAvg")) + '</span></div>' +
      '<div class="stat-box">' +
      '<span class="stat-num">' + completed.length + '/' + ranked.length + '</span>' +
      '<span class="stat-label">' + esc(T("samplesCupped")) + '</span></div>' +
      '<div class="stat-box highlight">' +
      '<span class="stat-num">' + esc(topSample) + '</span>' +
      '<span class="stat-label">' + esc(T("topSample")) + '</span></div>' +
      '</div>' +
      '<div class="card summary-radar-card">' +
      '<div style="width:100%;"><h2 style="margin:0 0 6px;">' + esc(T("radarCompare")) + '</h2></div>' +
      '<div class="radar-wrap">' + renderMultiRadarSvg(ranked, S.theme === "light") + '</div>' +
      '<div class="radar-legend">' + legendItems + '</div>' +
      '</div>' +
      '<div class="card">' +
      '<h2 style="margin:0 0 8px;">' + esc(T("sampleRanking")) + '</h2>' +
      '<div class="ranking-list">' + rankingRows + '</div>' +
      '</div>' +
      '<div class="card">' +
      '<h2 style="margin:0 0 8px;">' + esc(T("consensusFlavors")) + '</h2>' +
      '<div class="consensus-tags">' + topDescHtml + '</div>' +
      '</div>' +
      '<button type="button" class="cta-copy" data-act="copyReport">📋 ' + esc(T("copyReport")) + '</button>';

    return '<main class="screen summary-screen">' + h + '</main>';
  }

  function viewError() {
    var retryBtn = S.errorRetryable ? '<button type="button" class="cta" data-act="retryBoot">' + esc(T("retry")) + '</button>' : "";
    var hubBtn = '<button type="button" class="ghost" data-act="goHub" style="margin-top:10px;width:100%;">🏠 ' + esc(T("goHub")) + '</button>';
    return '<div class="center"><div><p>' + esc(errorText(S.lang, S.errorCode)) + '</p>' + retryBtn + hubBtn + '<div style="margin-top:16px;">' + langToggle() + '</div></div></div>';
  }

  function render() {
    var h = S.screen === "hub" ? viewHub()
      : S.screen === "summary" ? viewSummary()
      : S.screen === "error" ? viewError()
      : S.screen === "loading" ? '<div class="center muted">' + esc(T("loading")) + '</div>'
      : S.screen === "entry" ? viewEntry() : viewTable();
    root.innerHTML = h;
  }

  // ---------- thao tác ----------
  function finish() {
    var d = draft(), miss = missingScores(d);
    if (miss.length) {
      S.sheet = "score"; S.q = SCORE_FIELDS.indexOf(miss[0]);
      render(); // mở sheet điểm còn thiếu — toast() không tự vẽ lại nữa (F5 round 2)
      toast(T("missing") + miss.map(fieldName).join(", "));
      return;
    }
    var rev = nextRevision(storeGet("cupping:rev", 0), Date.now());
    storeSet("cupping:rev", rev);
    if (S.token !== "solo") {
      enqueue({ session_id: S.sid, token: S.token, entry: buildEntry(d, S.identity, S.table.cur, rev) });
    }
    var code = sampleCode(S.table.cur), avg = liveAverage(d);
    S.table = markSaved(S.table, S.table.cur, rev);
    S.table = selectSample(S.table, nextUnsaved(S.table));
    persist(); closeOverlay();
    render(); // phản hồi ngay tại chỗ — không chờ sync() (network round trip) mới thấy chip đổi (F5 round 2)
    toast(T("queued").replace("{code}", code) + " · " + T("avg") + " " + fmt1(avg));
    if (S.token !== "solo") sync();
  }

  function enter() {
    if (S.role === "staff") {
      var p = (S.sess.staff || []).filter(function (x) { return x.id === S.pickStaff; })[0];
      if (!p) { toast(T("needStaff")); return; }
      S.identity = { type: "staff", staff_id: p.id, name: p.name };
    } else {
      var name = (S.guestNameDraft || "").trim();
      if (!name) { toast(T("needName")); return; }
      S.identity = { type: "guest", guest_id: uuid(), name: name.slice(0, 40) }; // mã MỚI cho mỗi khách (spec §5.1)
    }
    storeSet("cupping:id:" + S.sid, S.identity);
    S.screen = "table";
    S.table = selectSample(S.table, nextUnsaved(S.table));
    render();
  }

  function changeUser() {
    if (!window.confirm(T("changeConfirm"))) return;
    storeDel("cupping:id:" + S.sid);
    storeDel("cupping:table:" + S.sid); // lượt đã bấm Xong vẫn nằm trong cupping:queue và vẫn được gửi
    S.identity = null; S.table = null; S.pickStaff = null; S.guestNameDraft = "";
    closeOverlay(); startTable(); render();
  }

  root.addEventListener("input", function (e) {
    if (e.target.id === "guestName") S.guestNameDraft = e.target.value;
    if (e.target.id === "note") S.noteDraft = e.target.value;
    if (e.target.id === "joinInput") S.joinDraft = e.target.value;
  });
  // Ghi chú: 1 lần Undo cho cả đoạn. KHÔNG vẽ lại ở đây — "change" bắn lúc ô mất focus, tức
  // ngay trước cú chạm vào nút ×; vẽ lại lúc đó sẽ thay nút dưới ngón tay và nuốt mất cú chạm.
  root.addEventListener("change", function (e) {
    if (e.target.id === "note" && e.target.value !== draft().note) {
      S.table = editCurrent(S.table, setNote(e.target.value));
      persist();
    }
  });

  root.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act"), v = el.getAttribute("data-v");
    switch (act) {
      case "lang": S.lang = v === "en" ? "en" : "vi"; storeSet("cupping:lang", S.lang); render(); break;
      case "theme":
        S.theme = S.theme === "light" ? "dark" : "light";
        storeSet("cupping:theme", S.theme);
        document.body.classList.toggle("light-mode", S.theme === "light");
        render();
        break;
      case "goHub": S.screen = "hub"; render(); break;
      case "goSummary": S.screen = "summary"; render(); break;
      case "backToTable": S.screen = "table"; render(); break;
      case "copyReport": copyReportToClipboard(); break;
      case "setSoloCount": S.soloCount = +v; render(); break;
      case "startSolo": startSoloSession(S.soloCount || 5); break;
      case "resumeLast":
        var last = storeGet("cupping:last", null);
        if (last && last.s && last.t) openSession(last.s, last.t);
        break;
      case "joinSession":
        var inputEl = document.getElementById("joinInput");
        var val = inputEl ? inputEl.value : S.joinDraft;
        var parsed = parseSessionInput(val);
        if (parsed) {
          openSession(parsed.s, parsed.t);
        } else {
          toast(T("needValidLinkOrCode"));
        }
        break;
      case "vibe": edit(setVibe(draft().vibe === v ? "" : v)); break;
      case "retryBoot": fetchSession(); break;
      case "role": S.role = v; render(); break;
      case "pickStaff": S.pickStaff = el.getAttribute("data-id"); render(); break;
      case "enter": enter(); break;
      case "changeUser": changeUser(); break;
      case "sample": S.table = selectSample(S.table, el.getAttribute("data-id")); closeOverlay(); render(); break;
      case "undo": S.table = undo(S.table); persist(); render(); break;
      case "redo": S.table = redo(S.table); persist(); render(); break;
      case "open":
        S.sheet = v; S.zoom = []; S.pending = null;
        if (v === "score") { var m = missingScores(draft()); S.q = m.length ? SCORE_FIELDS.indexOf(m[0]) : 0; }
        if (v === "card") S.noteDraft = draft().note;
        render(); break;
      case "close":
        var noteEl = document.getElementById("note");
        if (noteEl && noteEl.value !== draft().note) { S.table = editCurrent(S.table, setNote(noteEl.value)); persist(); }
        closeOverlay(); render(); break;
      case "score": edit(setScore(el.getAttribute("data-f"), +el.getAttribute("data-n"))); break;
      case "qscore":
        S.table = editCurrent(S.table, setScore(el.getAttribute("data-f"), +el.getAttribute("data-n"))); persist();
        if (S.q < 6) { S.q += 1; render(); }
        else { render(); setTimeout(function () { closeOverlay(); render(); }, 250); }
        break;
      case "prevQ": S.q = Math.max(0, S.q - 1); render(); break;
      case "intensity": edit(setDescriptor(el.getAttribute("data-code"), +el.getAttribute("data-n"))); break;
      case "rmDesc": edit(removeDescriptor(el.getAttribute("data-code"))); break;
      case "defect": edit(toggleDefect(el.getAttribute("data-code"))); break;
      case "finish": finish(); break;
      case "seg":
        var a = S.lastWheel.segments[+el.getAttribute("data-i")].action;
        if (a.type === "zoom") { S.zoom = a.zoom; render(); }
        else if (a.type === "pending") { S.pending = a.code; render(); }
        else {
          var code = S.pending;
          S.table = editCurrent(S.table, setDescriptor(code, a.value)); persist();
          closeOverlay(); // bánh xe đóng sau mỗi lần chọn (bản mẫu đã duyệt)
          render(); // đóng bánh xe/scrim ngay — toast() không còn tự vẽ lại (F5 round 2)
          toast("+ " + label(code) + " " + dots(a.value));
        }
        break;
      case "pickNode": S.pending = S.zoom[S.zoom.length - 1]; render(); break;
      case "wheelBack":
        if (S.pending) S.pending = null;
        else if (S.zoom.length) S.zoom = S.zoom.slice(0, -1);
        else closeOverlay();
        render(); break;
    }
  });

  boot();
})();
