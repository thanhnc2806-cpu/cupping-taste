/** Chữ giao diện VI/EN + câu hỏi khách + mã lỗi → chữ. Thuần. */
var STRINGS = {
  vi: {
    loading: "Đang tải phiên…", synced: "Đã lưu hết", saving: "Đang lưu", offline: "Chờ đồng bộ — mất mạng",
    blind: "Nếm mù", staff: "Nhân viên", guest: "Khách", avg: "TB", score: "Điểm", card: "Thẻ",
    defects: "Lỗi", done: "Xong", edit: "Sửa", flavors: "Hương vị", none: "Không có", note: "Ghi chú",
    notePh: "Ghi chú thêm (không bắt buộc)…", noteEmpty: "Chưa có ghi chú — bấm Thẻ để viết.",
    emptyFlavor: "Chưa có mô tả — bấm + để mở bánh xe.", undo: "Hoàn tác", redo: "Làm lại", close: "Đóng",
    avgNote: "Điểm trung bình nội bộ — không phải điểm CVA/SCA chính thức.", scaleLo: "1 · Rất thấp", scaleHi: "9 · Rất cao",
    like0: "Rất không thích", like1: "Rất thích", prevQ: "‹ Câu trước", question: "Câu",
    missing: "Còn thiếu: ", queued: "Đã ghi {code} — đang gửi", choose: "Chọn", strength: "cường độ? 1 thoảng nhẹ · 5 rất rõ",
    tapGroup: "Chạm một nhóm để mở ra", removed: "Bỏ", addFlavor: "Thêm mô tả hương vị", wheelAria: "Bánh xe hương vị",
    back: "Quay lại", closeWheel: "Đóng bánh xe", scoreTitle: "7 mục cảm nhận", guestTitle: "Cảm nhận của bạn",
    cardTitle: "Thẻ nếm", defTitle: "Lỗi phát hiện", intensity: "cường độ",
    blindNote: "Nếm mù — bạn chỉ thấy mã mẫu (A01, A02…), không thấy tên cà phê.", whoAreYou: "Bạn là",
    pickName: "Chọn tên của bạn", noStaff: "Chưa có danh sách nhân viên — nhờ người điều phối thêm vào Sheet.",
    yourName: "Tên của bạn", namePh: "Ví dụ: Lan", guestHint: "Không cần đăng nhập Google. Tên chỉ để ghi nhận điểm của bạn.",
    enter: "Vào bàn cupping →", needName: "Nhập tên của bạn trước.", needStaff: "Chọn tên của bạn trước.",
    changeUser: "Đổi người chấm", changeConfirm: "Đổi người chấm trên máy này? Bản nháp chưa bấm Xong sẽ bị xoá.",
    noSamples: "Phiên chưa có mẫu — chờ người điều phối thêm mẫu."
  },
  en: {
    loading: "Loading session…", synced: "All saved", saving: "Saving", offline: "Waiting to sync — offline",
    blind: "Blind", staff: "Staff", guest: "Guest", avg: "Avg", score: "Score", card: "Card",
    defects: "Defects", done: "Done", edit: "Edit", flavors: "Flavors", none: "None", note: "Note",
    notePh: "Extra notes (optional)…", noteEmpty: "No note yet — tap Card to write one.",
    emptyFlavor: "No descriptors yet — tap + to open the wheel.", undo: "Undo", redo: "Redo", close: "Close",
    avgNote: "Internal average — not an official CVA/SCA score.", scaleLo: "1 · Very low", scaleHi: "9 · Very high",
    like0: "Dislike extremely", like1: "Like extremely", prevQ: "‹ Previous", question: "Question",
    missing: "Missing: ", queued: "{code} recorded — sending", choose: "Pick", strength: "intensity? 1 faint · 5 very clear",
    tapGroup: "Tap a group to open it", removed: "Remove", addFlavor: "Add flavor descriptor", wheelAria: "Flavor wheel",
    back: "Back", closeWheel: "Close wheel", scoreTitle: "7 affective scores", guestTitle: "Your impression",
    cardTitle: "Tasting card", defTitle: "Defects found", intensity: "intensity",
    blindNote: "Blind tasting — you only see sample codes (A01, A02…), never the coffee name.", whoAreYou: "You are",
    pickName: "Pick your name", noStaff: "No staff list yet — ask the host to add it in the Sheet.",
    yourName: "Your name", namePh: "e.g. Lan", guestHint: "No Google login needed. Your name only labels your scores.",
    enter: "Go to the cupping table →", needName: "Enter your name first.", needStaff: "Pick your name first.",
    changeUser: "Change taster", changeConfirm: "Change the taster on this phone? Unsent drafts will be cleared.",
    noSamples: "No samples yet — wait for the host to add them."
  }
};

var FIELDS = [
  { key: "fragrance_aroma", vi: "Hương khô/ướt", en: "Fragrance/Aroma", short_vi: "Hương", short_en: "Aroma",
    q_vi: "Mùi thơm của ly này — lúc ngửi bột và lúc rót nước — bạn thích đến đâu?", q_en: "How much do you like the smell?" },
  { key: "flavor", vi: "Hương vị", en: "Flavor", short_vi: "Vị", short_en: "Flavor",
    q_vi: "Vị khi uống vào, bạn thích đến đâu?", q_en: "How much do you like the taste?" },
  { key: "aftertaste", vi: "Hậu vị", en: "Aftertaste", short_vi: "Hậu", short_en: "After",
    q_vi: "Sau khi nuốt, vị còn đọng lại trong miệng dễ chịu đến đâu?", q_en: "How pleasant is the aftertaste?" },
  { key: "acidity", vi: "Vị chua", en: "Acidity", short_vi: "Chua", short_en: "Acid",
    q_vi: "Độ chua (tươi, sáng như trái cây) có hợp với bạn không?", q_en: "How do you like the acidity (bright, fruity)?" },
  { key: "sweetness", vi: "Vị ngọt", en: "Sweetness", short_vi: "Ngọt", short_en: "Sweet",
    q_vi: "Độ ngọt tự nhiên của ly này thế nào?", q_en: "How do you like the sweetness?" },
  { key: "mouthfeel", vi: "Cảm giác miệng", en: "Mouthfeel", short_vi: "Miệng", short_en: "Body",
    q_vi: "Cảm giác trong miệng (đậm hay nhẹ, mượt hay ráp) có dễ chịu không?", q_en: "How do you like the mouthfeel (body, texture)?" },
  { key: "overall", vi: "Tổng thể", en: "Overall", short_vi: "Tổng", short_en: "Overall",
    q_vi: "Tổng thể, bạn thích ly này đến đâu?", q_en: "Overall, how much do you like this cup?" }
];

var PURPOSES_EN = { "QC nội bộ": "Internal QC", "hiệu chỉnh đội ngũ": "Team calibration", "trải nghiệm khách": "Guest experience", "R&D": "R&D" };

var ERRORS = {
  vi: {
    BAD_REQUEST: "Yêu cầu không hợp lệ — tải lại trang.", BODY_TOO_LARGE: "Dữ liệu quá lớn — bớt mô tả hoặc ghi chú.",
    UNKNOWN_ACTION: "Yêu cầu không hợp lệ — tải lại trang.", SESSION_NOT_FOUND: "Không tìm thấy phiên — quét lại QR.",
    BAD_TOKEN: "Link không hợp lệ — quét lại QR mới.", SESSION_CLOSED: "Phiên đã đóng — lượt chấm này không được lưu.",
    SESSION_NOT_OPEN: "Phiên chưa mở — chờ người điều phối.", SAMPLE_NOT_IN_SESSION: "Mẫu không thuộc phiên này.",
    BAD_TASTER_TYPE: "Chưa chọn Nhân viên hay Khách.", UNKNOWN_STAFF: "Tên nhân viên không còn trong danh sách — bấm Đổi người chấm.",
    BAD_GUEST_ID: "Thông tin người chấm hỏng — bấm Đổi người chấm.", BAD_GUEST_NAME: "Tên cần từ 1 đến 40 ký tự.",
    BAD_SCORES: "Cần đủ 7 điểm, mỗi điểm từ 1 đến 9.", BAD_DESCRIPTORS: "Mô tả hương vị không hợp lệ (tối đa 40).",
    GUEST_DESCRIPTOR_NOT_ALLOWED: "Mô tả này không dành cho khách.", BAD_DEFECTS: "Danh sách lỗi không hợp lệ.",
    GUEST_DEFECTS_NOT_ALLOWED: "Khách không ghi lỗi.", NOTE_TOO_LONG: "Ghi chú tối đa 500 ký tự.",
    BAD_REVISION: "Dữ liệu hỏng — tải lại trang.", SERVER_ERROR: "Máy chủ đang bận — sẽ tự gửi lại.",
    NETWORK: "Mất mạng — sẽ tự gửi lại khi có mạng.", BAD_LINK: "Thiếu link phiên hợp lệ — quét lại QR.",
    UNKNOWN: "Có lỗi không rõ — thử lại."
  },
  en: {
    BAD_REQUEST: "Invalid request — reload the page.", BODY_TOO_LARGE: "Too much data — trim descriptors or notes.",
    UNKNOWN_ACTION: "Invalid request — reload the page.", SESSION_NOT_FOUND: "Session not found — scan the QR again.",
    BAD_TOKEN: "Invalid link — scan the new QR.", SESSION_CLOSED: "Session closed — this entry was not saved.",
    SESSION_NOT_OPEN: "Session not open yet — wait for the host.", SAMPLE_NOT_IN_SESSION: "Sample is not in this session.",
    BAD_TASTER_TYPE: "Choose Staff or Guest.", UNKNOWN_STAFF: "Staff name no longer listed — tap Change taster.",
    BAD_GUEST_ID: "Taster info is broken — tap Change taster.", BAD_GUEST_NAME: "Name must be 1–40 characters.",
    BAD_SCORES: "All 7 scores are needed, each 1 to 9.", BAD_DESCRIPTORS: "Invalid flavor descriptors (max 40).",
    GUEST_DESCRIPTOR_NOT_ALLOWED: "This descriptor is not for guests.", BAD_DEFECTS: "Invalid defect list.",
    GUEST_DEFECTS_NOT_ALLOWED: "Guests don't record defects.", NOTE_TOO_LONG: "Notes are limited to 500 characters.",
    BAD_REVISION: "Corrupted data — reload the page.", SERVER_ERROR: "Server busy — will retry automatically.",
    NETWORK: "Offline — will send when back online.", BAD_LINK: "Missing a valid session link — scan the QR again.",
    UNKNOWN: "Unknown error — try again."
  }
};

function lang_(lang) { return lang === "en" ? "en" : "vi"; }
function t(lang, key) { var v = STRINGS[lang_(lang)][key]; return v === undefined ? key : v; }
function errorText(lang, code) { var m = ERRORS[lang_(lang)]; return m[code] || m.UNKNOWN; }
function purposeText(lang, purpose) { return lang_(lang) === "en" && PURPOSES_EN[purpose] ? PURPOSES_EN[purpose] : purpose; }
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

if (typeof module !== "undefined") {
  module.exports = { STRINGS: STRINGS, FIELDS: FIELDS, ERRORS: ERRORS, t: t, errorText: errorText, purposeText: purposeText, esc: esc };
}
