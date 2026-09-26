/**
 * Bánh xe hương vị nửa vòng — dữ liệu hiển thị THUẦN (không DOM). Góc tính theo độ:
 * 0° = mép trái, 90° = đỉnh, 180° = mép phải; tâm ở giữa cạnh dưới viewBox 400×200.
 * Màu pastel theo nhóm — chuyện giao diện nên ở đây, không nằm trong Taxonomy.js (spec §4.4).
 */
var WHEEL_GEOM = { cx: 200, cy: 200, r0: 46, rm: 116, r1: 196 };
var WHEEL_COLORS = {
  fruity: "#F4A9A8", sour_fermented: "#F3D98E", green_vegetative: "#B9DFA6", other: "#B7CFE3",
  roasted: "#E7B48F", spices: "#D7A7C9", nutty_cocoa: "#CDB8A5", sweet: "#F7C8B2", floral: "#D8C6F0"
};

function mixColor(hex, k) {
  var target = k >= 0 ? 255 : 0, a = Math.abs(k);
  return "#" + [1, 3, 5].map(function (i) {
    var v = parseInt(hex.substr(i, 2), 16);
    return ("0" + Math.round(v + (target - v) * a).toString(16)).slice(-2);
  }).join("");
}

function wheelPoint_(r, a) {
  var rad = a * Math.PI / 180;
  return (WHEEL_GEOM.cx - r * Math.cos(rad)).toFixed(2) + " " + (WHEEL_GEOM.cy - r * Math.sin(rad)).toFixed(2);
}

function wheelArc_(r0, r1, a0, a1) {
  if (a1 - a0 >= 180) a1 = a0 + 179.99; // cung đúng 180° là mơ hồ với SVG
  return "M " + wheelPoint_(r1, a0) + " A " + r1 + " " + r1 + " 0 0 1 " + wheelPoint_(r1, a1) +
    " L " + wheelPoint_(r0, a1) + " A " + r0 + " " + r0 + " 0 0 0 " + wheelPoint_(r0, a0) + " Z";
}

function wheelSeg_(code, r0, r1, a0, a1, fill, label, baseFs, selected, action) {
  var mid = (a0 + a1) / 2, rm = (r0 + r1) / 2, rad = mid * Math.PI / 180;
  var x = WHEEL_GEOM.cx - rm * Math.cos(rad), y = WHEEL_GEOM.cy - rm * Math.sin(rad);
  var arcW = rm * (a1 - a0) * Math.PI / 180;
  // Chữ chạy theo bán kính: vừa chiều dài vòng (r1-r0) và vừa bề ngang cung.
  var fs = Math.max(7.5, Math.min(baseFs, (r1 - r0 - 12) / (Math.max(3, label.length) * 0.56), arcW * 0.72));
  return {
    code: code, d: wheelArc_(r0, r1, a0, a1), fill: fill, label: label,
    fs: Math.round(fs * 10) / 10, tx: Math.round(x * 10) / 10, ty: Math.round(y * 10) / 10,
    rot: Math.round((mid <= 90 ? mid : mid - 180) * 10) / 10,
    a0: a0, a1: a1, selected: !!selected, action: action
  };
}

function wheelFind_(nodes, code) {
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].code === code) return nodes[i];
    var hit = wheelFind_(nodes[i].children, code);
    if (hit) return hit;
  }
  return null;
}

function wheelView(tree, opts) {
  var G = WHEEL_GEOM, guest = opts.mode === "guest", sel = opts.selected || {}, zoom = opts.zoom || [];
  var lang = opts.lang === "en" ? "en" : "vi";
  function name(n) { return n[lang]; }
  var segs = [], i, step;

  if (opts.pending) {
    var p = wheelFind_(tree, opts.pending);
    var base = WHEEL_COLORS[opts.pending.split(".")[0]] || "#CCCCCC";
    var shades = [0.55, 0.38, 0.18, 0, -0.14];
    for (i = 0; i < 5; i++) {
      segs.push(wheelSeg_(opts.pending, G.r0, 156, i * 36, (i + 1) * 36, mixColor(base, shades[i]), String(i + 1), 22,
        sel[opts.pending] === i + 1, { type: "intensity", value: i + 1 }));
    }
    return { segments: segs, pill: { kind: "info", name: name(p) }, center: "back" };
  }

  if (!zoom.length) {
    var groups = tree.filter(function (g) { return !(guest && g.guest_hidden); });
    step = 180 / groups.length;
    groups.forEach(function (g, k) {
      segs.push(wheelSeg_(g.code, G.r0, G.r1, k * step, (k + 1) * step, WHEEL_COLORS[g.code], name(g), 13, !!sel[g.code], { type: "zoom", zoom: [g.code] }));
    });
    return { segments: segs, pill: { kind: "hint" }, center: "close" };
  }

  var group = wheelFind_(tree, zoom[0]), color = WHEEL_COLORS[group.code];

  if (zoom.length === 2) {
    var sub = wheelFind_(tree, zoom[1]);
    step = 180 / sub.children.length;
    sub.children.forEach(function (d, k) {
      segs.push(wheelSeg_(d.code, G.r0, G.r1, k * step, (k + 1) * step, mixColor(color, k % 2 ? 0.28 : 0.08), name(d), 13, !!sel[d.code], { type: "pending", code: d.code }));
    });
    return { segments: segs, pill: { kind: "pick", code: sub.code, name: name(sub) }, center: "back" };
  }

  if (guest) {
    step = 180 / group.children.length;
    group.children.forEach(function (s, k) {
      segs.push(wheelSeg_(s.code, G.r0, G.r1, k * step, (k + 1) * step, mixColor(color, k % 2 ? 0.3 : 0.06), name(s), 13, !!sel[s.code], { type: "pending", code: s.code }));
    });
    return { segments: segs, pill: { kind: "pick", code: group.code, name: name(group) }, center: "back" };
  }

  // Nhân viên, phóng to 1 nhóm: vòng trong = danh mục con, vòng ngoài = mô tả.
  var leaves = group.children.reduce(function (n, s) { return n + Math.max(1, s.children.length); }, 0);
  step = 180 / leaves;
  var a = 0;
  group.children.forEach(function (s, si) {
    var start = a, sFill = mixColor(color, si % 2 ? -0.06 : 0.14);
    if (s.children.length) {
      s.children.forEach(function (d, di) {
        segs.push(wheelSeg_(d.code, G.rm, G.r1, a, a + step, mixColor(color, (di + si) % 2 ? 0.42 : 0.26), name(d), 11, !!sel[d.code], { type: "pending", code: d.code }));
        a += step;
      });
      segs.push(wheelSeg_(s.code, G.r0, G.rm, start, a, sFill, name(s), 12, !!sel[s.code], { type: "zoom", zoom: [group.code, s.code] }));
    } else {
      a += step;
      segs.push(wheelSeg_(s.code, G.r0, G.r1, start, a, sFill, name(s), 11, !!sel[s.code], { type: "pending", code: s.code }));
    }
  });
  // Làm tròn cộng dồn có thể lệch 180 một chút — chốt mép phải đúng 180.
  segs.forEach(function (sg) { if (Math.abs(sg.a1 - 180) < 1e-6) sg.a1 = 180; });
  return { segments: segs, pill: { kind: "pick", code: group.code, name: name(group) }, center: "back" };
}

if (typeof module !== "undefined") {
  module.exports = { WHEEL_GEOM: WHEEL_GEOM, WHEEL_COLORS: WHEEL_COLORS, mixColor: mixColor, wheelView: wheelView };
}
