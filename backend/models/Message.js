const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Tệp đính kèm" },
    type: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    dataUrl: { type: String, required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["doctor", "patient"],
      required: true,
    },
    // Không còn required: cho phép tin nhắn chỉ có tệp/ảnh, không cần chữ
    content: { type: String, default: "", trim: true },
    // Field bị thiếu trước đây khiến Mongoose tự xóa attachment khi lưu
    attachment: { type: attachmentSchema, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Validate: phải có content hoặc attachment, không được cả hai đều rỗng
// Dùng async function không nhận tham số next để tương thích với mọi
// phiên bản Mongoose (một số bản mới không truyền next dạng callback).
messageSchema.pre("validate", async function () {
  const hasContent = this.content && this.content.trim().length > 0;
  const hasAttachment = this.attachment && this.attachment.dataUrl;

  if (!hasContent && !hasAttachment) {
    throw new Error("Tin nhắn phải có nội dung hoặc tệp đính kèm.");
  }
});

module.exports = mongoose.model("Message", messageSchema);