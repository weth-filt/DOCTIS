const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeAttachments, attachmentParts, serializeAttachment, MAX_ATTACHMENT_BYTES } = require("../services/aiAttachments");
const file = (mimeType, data, name = "sample") => ({ name, mimeType, data: Buffer.from(data).toString("base64") });

test("AI attachments validate real bytes, names and metadata without retaining client identity fields", () => {
  const [value] = normalizeAttachments([{ ...file("image/png", [137,80,78,71,13,10,26,10], "../../a\u0000.png"), size: 999, userId: "forged" }]);
  assert.equal(value.name, "a.png");
  assert.equal(value.size, 8);
  assert.equal(value.sha256.length, 64);
  assert.ok(Buffer.isBuffer(value.data));
  assert.equal(value.userId, undefined);
  assert.deepEqual(serializeAttachment({ ...value, _id: "safe-id" }), { id: "safe-id", name: "a.png", mimeType: "image/png", size: 8, contentUrl: "/ai/attachments/safe-id/content" });
});

test("AI attachments accept supported PDF/JPEG/WebP and valid UTF8 plain text/CSV", () => {
  const examples = [file("application/pdf", "%PDF-1.7\n"), file("image/jpeg", [255,216,255,224]), file("image/webp", "RIFF0000WEBP"), file("text/plain", "Dữ liệu kiểm thử"), file("text/csv", "a,b\n1,2")];
  for (const value of examples) assert.equal(normalizeAttachments([value]).length, 1);
});

test("AI attachments reject spoofed MIME, data URLs, invalid base64, null and invalid UTF8", () => {
  for (const value of [file("image/png", "not-png"), file("text/html", "<script>"), { name: "x", mimeType: "text/plain", data: "data:text/plain;base64,eA==" }, { name: "x", mimeType: "text/plain", data: "eA$=" }, { name: "x", mimeType: "text/plain", data: "eB==" }, file("text/plain", [0]), file("text/plain", [255])]) {
    assert.throws(() => normalizeAttachments([value]), error => error.status === 400 && error.code.startsWith("AI_"));
  }
});

test("AI attachments bound file count, encoded allocation and aggregate decoded bytes", () => {
  assert.throws(() => normalizeAttachments(Array.from({length: 5}, () => file("text/plain", "a"))), { code: "AI_INVALID_ATTACHMENT" });
  assert.throws(() => normalizeAttachments([file("text/plain", Buffer.alloc(MAX_ATTACHMENT_BYTES + 1, 65))]), { code: "AI_ATTACHMENT_TOO_LARGE", status: 413 });
  assert.throws(() => normalizeAttachments([file("text/plain", Buffer.alloc(MAX_ATTACHMENT_BYTES, 65)), file("text/plain", "x")]), { code: "AI_ATTACHMENT_TOO_LARGE", status: 413 });
  assert.equal(normalizeAttachments([file("text/plain", Buffer.alloc(MAX_ATTACHMENT_BYTES, 65))])[0].size, MAX_ATTACHMENT_BYTES);
});

test("Gemini parts use inline_data for binary and clearly labelled data for text", () => {
  const binary = normalizeAttachments([file("application/pdf", "%PDF-1.7\n")]);
  assert.deepEqual(attachmentParts(binary), [{ inline_data: { mime_type: "application/pdf", data: binary[0].data.toString("base64") } }]);
  const parts = attachmentParts(normalizeAttachments([file("text/plain", "TEST_DATA", "note.txt")]));
  assert.match(parts[0].text, /DỮ LIỆU/);
  assert.match(parts[0].text, /TEST_DATA/);
  const longText = attachmentParts(normalizeAttachments([file("text/plain", "A".repeat(14000))]))[0].text;
  assert.ok(longText.length < 13000);
  assert.match(longText, /12.000 ký tự đầu/);
  assert.ok(!longText.includes("A".repeat(12001)));
});
