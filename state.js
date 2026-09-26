/**
 * Trạng thái bàn cupping — THUẦN (không DOM, không localStorage), test bằng node --test.
 * Mọi hàm trả object MỚI, không sửa đầu vào → Undo/Redo giữ được bản cũ.
 */
var SCORE_FIELDS = ["fragrance_aroma", "flavor", "aftertaste", "acidity", "sweetness", "mouthfeel", "overall"];

function clone_(x) { return JSON.parse(JSON.stringify(x)); }

// JSON có khoá SẮP XẾP — để so hai bản nháp không phụ thuộc thứ tự thêm khoá.
function canon_(x) {
  if (Array.isArray(x)) return "[" + x.map(canon_).join(",") + "]";
  if (x && typeof x === "object") {
    return "{" + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ":" + canon_(x[k]); }).join(",") + "}";
  }
  return JSON.stringify(x);
}

function emptyDraft() { return { scores: {}, descriptors: {}, defects: {}, note: "" }; }

function createTable(sampleIds, drafts, saved) {
  var d = {}, s = {};
  sampleIds.forEach(function (id) { d[id] = drafts && drafts[id] ? clone_(drafts[id]) : emptyDraft(); });
  if (saved) Object.keys(saved).forEach(function (id) { if (d[id]) s[id] = clone_(saved[id]); });
  return { order: sampleIds.slice(), cur: sampleIds.length ? sampleIds[0] : null, drafts: d, saved: s, undo: [], redo: [] };
}

function addSamples(t, sampleIds) {
  var n = clone_(t);
  sampleIds.forEach(function (id) { if (!n.drafts[id]) { n.drafts[id] = emptyDraft(); n.order.push(id); } });
  if (!n.cur && n.order.length) n.cur = n.order[0];
  return n;
}

function editCurrent(t, mutate) {
  var n = clone_(t);
  n.undo.push(clone_(n.drafts[n.cur]));
  mutate(n.drafts[n.cur]);
  n.redo = [];
  return n;
}

function undo(t) {
  if (!t.undo.length) return t;
  var n = clone_(t);
  n.redo.push(n.drafts[n.cur]);
  n.drafts[n.cur] = n.undo.pop();
  return n;
}

function redo(t) {
  if (!t.redo.length) return t;
  var n = clone_(t);
  n.undo.push(n.drafts[n.cur]);
  n.drafts[n.cur] = n.redo.pop();
  return n;
}

function selectSample(t, id) {
  if (!t.drafts[id]) return t;
  var n = clone_(t);
  n.cur = id; n.undo = []; n.redo = [];
  return n;
}

function setScore(field, value) { return function (d) { d.scores[field] = value; }; }
function setDescriptor(code, intensity) { return function (d) { d.descriptors[code] = intensity; }; }
function removeDescriptor(code) { return function (d) { delete d.descriptors[code]; }; }
function toggleDefect(code) { return function (d) { if (d.defects[code]) delete d.defects[code]; else d.defects[code] = true; }; }
function setNote(text) { return function (d) { d.note = String(text || "").slice(0, 500); }; }

function missingScores(d) {
  return SCORE_FIELDS.filter(function (f) { return typeof d.scores[f] !== "number"; });
}

function liveAverage(d) {
  var v = SCORE_FIELDS.map(function (f) { return d.scores[f]; }).filter(function (x) { return typeof x === "number"; });
  return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
}

function hasData_(d) {
  return Object.keys(d.scores).length > 0 || Object.keys(d.descriptors).length > 0 || Object.keys(d.defects).length > 0 || !!d.note;
}

function sampleStatus(t, id) {
  var d = t.drafts[id];
  if (t.saved[id] && canon_(t.saved[id].draft) === canon_(d)) return "saved";
  return hasData_(d) ? "wip" : "new";
}

function markSaved(t, id, revision) {
  var n = clone_(t);
  n.saved[id] = { draft: clone_(n.drafts[id]), avg: liveAverage(n.drafts[id]), revision: revision };
  return n;
}

function unmarkSaved(t, id, revision) {
  if (!t.saved[id] || t.saved[id].revision !== revision) return t;
  var n = clone_(t);
  delete n.saved[id];
  return n;
}

function nextUnsaved(t) {
  for (var i = 0; i < t.order.length; i++) if (sampleStatus(t, t.order[i]) !== "saved") return t.order[i];
  return t.cur;
}

function buildEntry(d, identity, sampleId, revision) {
  var e = { sample_id: sampleId };
  if (identity.type === "staff") { e.taster_type = "Nhân viên"; e.staff_id = identity.staff_id; }
  else { e.taster_type = "Khách"; e.guest_id = identity.guest_id; e.guest_name = identity.name; }
  e.scores = {};
  SCORE_FIELDS.forEach(function (f) { e.scores[f] = d.scores[f]; });
  e.descriptors = Object.keys(d.descriptors).sort().map(function (c) { return { code: c, intensity: d.descriptors[c] }; });
  e.defects = Object.keys(d.defects).filter(function (c) { return d.defects[c]; }).sort();
  e.note = d.note || "";
  e.client_revision = revision;
  return e;
}

function nextRevision(last, now) { return Math.max(now, (last || 0) + 1); }

function tasterOf_(entry) { return entry.staff_id ? "NV:" + entry.staff_id : "K:" + entry.guest_id; }

function queueUpsert(queue, item) {
  return queue.filter(function (q) {
    return !(q.session_id === item.session_id && q.entry.sample_id === item.entry.sample_id && tasterOf_(q.entry) === tasterOf_(item.entry));
  }).concat([item]);
}

function queueAck(queue, sessionId, sampleId, revision) {
  return queue.filter(function (q) {
    return !(q.session_id === sessionId && q.entry.sample_id === sampleId && q.entry.client_revision === revision);
  });
}

function isRetryable(code) { return code === "NETWORK" || code === "SERVER_ERROR"; }

if (typeof module !== "undefined") {
  module.exports = {
    SCORE_FIELDS: SCORE_FIELDS, emptyDraft: emptyDraft, createTable: createTable, addSamples: addSamples,
    editCurrent: editCurrent, undo: undo, redo: redo, selectSample: selectSample,
    setScore: setScore, setDescriptor: setDescriptor, removeDescriptor: removeDescriptor, toggleDefect: toggleDefect, setNote: setNote,
    missingScores: missingScores, liveAverage: liveAverage, sampleStatus: sampleStatus,
    markSaved: markSaved, unmarkSaved: unmarkSaved, nextUnsaved: nextUnsaved,
    buildEntry: buildEntry, nextRevision: nextRevision,
    queueUpsert: queueUpsert, queueAck: queueAck, isRetryable: isRetryable
  };
}
