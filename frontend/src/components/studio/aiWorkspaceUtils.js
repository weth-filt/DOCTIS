export const MAX_AI_ATTACHMENTS = 4;
export const MAX_AI_ATTACHMENT_BYTES = 2 * 1024 * 1024;
export const MAX_AI_REQUEST_BYTES = 4 * 1024 * 1024;
export const MAX_AI_MESSAGE_LENGTH = 1200;
export const AI_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.txt,.csv";
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain", "text/csv"]);

export function conversationId(value) {
  return typeof value?.id === "string" ? value.id : typeof value?._id === "string" ? value._id : "";
}

export function conversationTitle(value) {
  const title = String(value || "").trim().replace(/\s+/g, " ") || "Cuộc trò chuyện mới";
  return Array.from(title).slice(0, 50).join("");
}

function dateNumber(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? time : 0;
}

export function sortConversations(values) {
  return [...(Array.isArray(values) ? values : [])].filter(item => conversationId(item)).sort((a, b) =>
    dateNumber(b.updatedAt || b.lastMessageAt || b.createdAt) - dateNumber(a.updatedAt || a.lastMessageAt || a.createdAt));
}

export function upsertConversation(values, item) {
  const id = conversationId(item);
  return id ? sortConversations([item, ...values.filter(value => conversationId(value) !== id)]) : values;
}

const vietnamDay = time => Math.floor((time + 7 * 60 * 60 * 1000) / 86400000);
export function groupConversations(values, now = new Date()) {
  const today = vietnamDay(now.getTime());
  const groups = [
    { label: "Hôm nay", items: [] }, { label: "Hôm qua", items: [] },
    { label: "7 ngày trước", items: [] }, { label: "Cũ hơn", items: [] },
  ];
  sortConversations(values).forEach(item => {
    const stamp = dateNumber(item.updatedAt || item.lastMessageAt || item.createdAt);
    const days = stamp ? today - vietnamDay(stamp) : Infinity;
    groups[days <= 0 ? 0 : days === 1 ? 1 : days <= 7 ? 2 : 3].items.push(item);
  });
  return groups.filter(group => group.items.length);
}

export function aiDateLabel(value, includeDate = false) {
  if (!dateNumber(value)) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    ...(includeDate ? { day: "2-digit", month: "2-digit" } : {}),
  }).format(new Date(value));
}

export function formatAttachmentSize(bytes) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function attachmentMime(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (MIME_TYPES.has(type)) return type;
  if ((!type || type === "application/vnd.ms-excel") && /\.csv$/i.test(file?.name || "")) return "text/csv";
  if (!type && /\.txt$/i.test(file?.name || "")) return "text/plain";
  return "";
}

function safeName(name) {
  return Array.from(String(name || "tep-dinh-kem"), character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 || character === "/" || character === "\\" ? "_" : character).join("").slice(0, 120);
}

function readDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Không đọc được tệp. Bạn hãy chọn lại tệp nhé."));
    reader.readAsDataURL(blob);
  });
}

async function decodedImage(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error("Không mở được ảnh. Hãy chọn ảnh JPG, PNG hoặc WebP khác."));
      node.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight, dispose: () => URL.revokeObjectURL(url) };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
}

async function resizeImage(file) {
  let decoded;
  try {
    decoded = await decodedImage(file);
    if (!decoded.width || !decoded.height) throw new Error("Ảnh không có kích thước hợp lệ.");
    const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const drawing = canvas.getContext("2d");
    if (!drawing) throw new Error("Trình duyệt chưa xử lý được ảnh này. Bạn hãy thử ảnh JPG khác.");
    drawing.fillStyle = "#ffffff";
    drawing.fillRect(0, 0, canvas.width, canvas.height);
    drawing.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Không tối ưu được ảnh. Bạn hãy thử lại.")), "image/jpeg", 0.8));
    return blob;
  } finally { decoded?.dispose(); }
}

export function validateAttachmentTotals(attachments) {
  if (attachments.length > MAX_AI_ATTACHMENTS) throw new Error("Mỗi tin nhắn chỉ đính kèm tối đa 4 tệp.");
  if (attachments.reduce((sum, item) => sum + item.size, 0) > MAX_AI_ATTACHMENT_BYTES) throw new Error("Tổng tệp sau khi tối ưu cần dưới 2 MB. Hãy giảm số tệp hoặc chọn tệp nhỏ hơn.");
}

export function requestBytes(payload) {
  const json = JSON.stringify(payload);
  return typeof TextEncoder === "function" ? new TextEncoder().encode(json).byteLength : new Blob([json]).size;
}

export function validateAIRequest(payload) {
  if (requestBytes(payload) >= MAX_AI_REQUEST_BYTES) throw new Error("Nội dung gửi vượt giới hạn 4 MB. Hãy giảm dung lượng hoặc số tệp đính kèm.");
  return payload;
}

export async function prepareAIAttachment(file) {
  const mime = attachmentMime(file);
  if (!mime) throw new Error("Chỉ nhận ảnh JPG, PNG, WebP, PDF, TXT hoặc CSV. Ảnh HEIC cần chuyển sang JPG trước khi gửi.");
  if (!file.size) throw new Error("Tệp đang trống. Bạn hãy chọn tệp khác.");
  if (mime.startsWith("image/") && file.size > 20 * 1024 * 1024) throw new Error("Ảnh gốc quá lớn. Hãy chọn ảnh dưới 20 MB để trình duyệt tối ưu.");
  if (!mime.startsWith("image/") && file.size > MAX_AI_ATTACHMENT_BYTES) throw new Error("PDF hoặc tệp văn bản cần nhỏ hơn 2 MB.");
  const image = mime.startsWith("image/");
  let blob;
  try { blob = image ? await resizeImage(file) : file; }
  catch { throw new Error("Không xử lý được ảnh. Bạn hãy chọn ảnh JPG, PNG hoặc WebP khác."); }
  if (blob.size > MAX_AI_ATTACHMENT_BYTES) throw new Error("Tệp sau khi tối ưu vẫn vượt 2 MB. Hãy chọn tệp nhỏ hơn.");
  const dataURL = await readDataURL(blob);
  const name = image ? safeName(file.name).replace(/\.[^.]*$/, "") + ".jpg" : safeName(file.name);
  return {
    localId: typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name, mimeType: image ? "image/jpeg" : mime, size: blob.size,
    data: dataURL.slice(dataURL.indexOf(",") + 1), previewUrl: image ? URL.createObjectURL(blob) : "",
  };
}

export function releaseAttachment(attachment) {
  if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}
