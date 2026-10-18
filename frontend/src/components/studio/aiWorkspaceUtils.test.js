import {
  attachmentMime, conversationTitle, groupConversations, MAX_AI_ATTACHMENT_BYTES,
  prepareAIAttachment, requestBytes, sortConversations, validateAIRequest, validateAttachmentTotals,
} from "./aiWorkspaceUtils";

test("history is latest first and grouped on the Vietnam calendar boundary", () => {
  const rows = [
    { id: "old", title: "Cũ", updatedAt: "2026-09-01T10:00:00Z" },
    { id: "yesterday", updatedAt: "2026-10-17T16:00:00Z" },
    { id: "today", updatedAt: "2026-10-17T18:00:00Z" },
    { id: "week", updatedAt: "2026-10-12T10:00:00Z" },
  ];
  expect(sortConversations(rows).map(item => item.id)).toEqual(["today", "yesterday", "week", "old"]);
  expect(groupConversations(rows, new Date("2026-10-17T19:00:00Z")).map(group => [group.label, group.items[0].id])).toEqual([
    ["Hôm nay", "today"], ["Hôm qua", "yesterday"], ["7 ngày trước", "week"], ["Cũ hơn", "old"],
  ]);
  expect(rows[0].id).toBe("old");
});

test("titles are compact, limited to 50 Unicode characters and have a neutral empty label", () => {
  expect(conversationTitle("  Một\n câu hỏi  ")).toBe("Một câu hỏi");
  expect(Array.from(conversationTitle("❤️".repeat(60))).length).toBe(50);
  expect(conversationTitle("")).toBe("Cuộc trò chuyện mới");
  expect(conversationTitle("   ")).toBe("Cuộc trò chuyện mới");
});

test("attachment MIME allowlist rejects unsupported formats and handles CSV browsers", () => {
  expect(attachmentMime({ type: "image/heic", name: "image.heic" })).toBe("");
  expect(attachmentMime({ type: "image/svg+xml", name: "image.svg" })).toBe("");
  expect(attachmentMime({ type: "application/vnd.ms-excel", name: "data.csv" })).toBe("text/csv");
  expect(attachmentMime({ type: "", name: "notes.txt" })).toBe("text/plain");
});

test("raw totals and actual JSON bytes remain under bounded request limits", () => {
  expect(() => validateAttachmentTotals(Array.from({ length: 5 }, () => ({ size: 1 })))).toThrow(/4 tệp/);
  expect(() => validateAttachmentTotals([{ size: MAX_AI_ATTACHMENT_BYTES }, { size: 1 }])).toThrow(/2 MB/);
  expect(() => validateAttachmentTotals([{ size: 1000 }, { size: 2000 }])).not.toThrow();
  expect(requestBytes({ message: "ế" })).toBeGreaterThan(JSON.stringify({ message: "ế" }).length);
  expect(() => validateAIRequest({ data: "a".repeat(4 * 1024 * 1024) })).toThrow(/4 MB/);
});

test("small PDF data is kept raw and an oversized PDF is rejected before reading", async () => {
  const file = new File(["%PDF-1.7\nfixture"], "test.pdf", { type: "application/pdf" });
  const prepared = await prepareAIAttachment(file);
  expect(prepared.mimeType).toBe("application/pdf");
  expect(prepared.size).toBe(file.size);
  expect(prepared.previewUrl).toBe("");
  expect(atob(prepared.data)).toBe("%PDF-1.7\nfixture");
  await expect(prepareAIAttachment(new File([new Uint8Array(MAX_AI_ATTACHMENT_BYTES + 1)], "large.pdf", { type: "application/pdf" }))).rejects.toThrow(/2 MB/);
});

test("photos resize their longest side to 1600 at JPEG quality .8 and release the decoded image", async () => {
  const originalBitmap = global.createImageBitmap;
  const originalCreateURL = URL.createObjectURL;
  const bitmap = { width: 3200, height: 2000, close: jest.fn() };
  global.createImageBitmap = jest.fn().mockResolvedValue(bitmap);
  URL.createObjectURL = jest.fn().mockReturnValue("blob:preview");
  const fillRect = jest.fn();
  const drawImage = jest.fn();
  const context = jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillRect, drawImage });
  const encode = jest.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function create(callback, mime, quality) {
    expect(this.width).toBe(1600); expect(this.height).toBe(1000);
    expect(mime).toBe("image/jpeg"); expect(quality).toBe(.8);
    callback(new Blob(["image bytes"], { type: mime }));
  });
  try {
    const prepared = await prepareAIAttachment(new File(["fixture"], "photo.png", { type: "image/png" }));
    expect(prepared.name).toBe("photo.jpg");
    expect(prepared.mimeType).toBe("image/jpeg");
    expect(prepared.previewUrl).toBe("blob:preview");
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1000);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  } finally {
    context.mockRestore(); encode.mockRestore(); global.createImageBitmap = originalBitmap; URL.createObjectURL = originalCreateURL;
  }
});
