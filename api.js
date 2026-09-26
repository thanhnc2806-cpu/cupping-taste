/** localStorage an toàn + gọi Apps Script + xả hàng đợi. Phụ thuộc: config.js, state.js. */
var QUEUE_KEY = "cupping:queue";

// localStorage có thể ném lỗi (chế độ riêng tư, bộ nhớ đầy) — không bao giờ làm sập trang.
function storeGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* bỏ qua */ }
}
function storeDel(key) {
  try { localStorage.removeItem(key); } catch (e) { /* bỏ qua */ }
}

// text/plain = "yêu cầu đơn giản" → không preflight CORS. credentials:"omit" = không gửi
// cookie Google chéo miền → tránh đúng lỗi "không thể mở tệp" của máy nhiều tài khoản.
function apiPost(action, sessionId, token, extra) {
  var body = Object.assign({ action: action, session_id: sessionId, token: token }, extra || {});
  return fetch(CUPPING_API_URL, {
    method: "POST", redirect: "follow", credentials: "omit",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body)
  })
    .then(function (r) { return r.json(); })
    .then(function (j) { return j && typeof j === "object" ? j : { ok: false, error: "SERVER_ERROR" }; })
    .catch(function () { return { ok: false, error: "NETWORK" }; });
}

function enqueue(item) { storeSet(QUEUE_KEY, queueUpsert(storeGet(QUEUE_KEY, []), item)); }

function queueCount(sessionId) {
  return storeGet(QUEUE_KEY, []).filter(function (q) { return q.session_id === sessionId; }).length;
}

var flushing_ = false;
// Gửi lần lượt từ đầu hàng đợi. Lỗi mạng/máy chủ bận → dừng, giữ nguyên để lần sau gửi lại.
// Lỗi dữ liệu (phiên đóng, token sai…) → bỏ mục đó, báo "rejected" để trang gỡ dấu ✓.
function flushQueue(onEvent) {
  if (flushing_) return;
  flushing_ = true;
  (function next() {
    var q = storeGet(QUEUE_KEY, []);
    if (!q.length) { flushing_ = false; onEvent({ type: "idle" }); return; }
    var item = q[0], e = item.entry;
    apiPost("submitEntry", item.session_id, item.token, { entry: e }).then(function (r) {
      if (!r.ok && isRetryable(r.error)) { flushing_ = false; onEvent({ type: "offline", error: r.error }); return; }
      storeSet(QUEUE_KEY, queueAck(storeGet(QUEUE_KEY, []), item.session_id, e.sample_id, e.client_revision));
      if (r.ok) onEvent({ type: "saved", session_id: item.session_id, sample_id: e.sample_id, status: r.status });
      else onEvent({ type: "rejected", session_id: item.session_id, sample_id: e.sample_id, revision: e.client_revision, error: r.error });
      next();
    });
  })();
}
