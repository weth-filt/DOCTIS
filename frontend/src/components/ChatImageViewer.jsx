import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { FaCompress, FaDownload, FaExpand, FaTimes } from "react-icons/fa";
import useWorkspaceDialog from "./useWorkspaceDialog";
import "../CSS/chat-image-viewer.css";

export default function ChatImageViewer({ attachment, onClose, onDownload, theme = "light" }) {
  const [originalSize, setOriginalSize] = useState(false);
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const source = attachment?.dataUrl || attachment?.url || attachment?.fileUrl || attachment?.src || "";
  const allowed = /^(data:image\/|blob:|https?:\/\/|\/(?!\/))/i.test(source);
  const dialog = useWorkspaceDialog(Boolean(attachment), onClose);
  useEffect(() => { setOriginalSize(false); setFailed(false); }, [source]);
  if (!attachment) return null;
  const name = attachment.name || "Ảnh đính kèm";

  // Base64 image sources belong in <img>, not in a new tab's top-level URL.
  // This portal also avoids transformed/overflow-clipped workspace ancestors.
  return createPortal(<div className="chat-image-viewer-shade" data-studio-theme={theme}
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="chat-image-viewer" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header>
        <h2 id={titleId} title={name}>{name}</h2>
        <div className="chat-image-viewer-tools">
          <button type="button" onClick={() => setOriginalSize(value => !value)} disabled={failed || !allowed} aria-pressed={originalSize}>
            {originalSize ? <FaCompress aria-hidden="true" /> : <FaExpand aria-hidden="true" />}
            {originalSize ? "Vừa màn hình" : "Kích thước gốc"}
          </button>
          {onDownload && <button type="button" onClick={() => onDownload(attachment)}><FaDownload aria-hidden="true" /> Tải xuống</button>}
        </div>
        <button className="chat-image-viewer-close" type="button" onClick={onClose} aria-label="Đóng ảnh"><FaTimes aria-hidden="true" /></button>
      </header>
      <div className={`chat-image-viewer-stage${originalSize ? " is-original" : ""}`}>
        {failed || !allowed ? <p role="alert">Chưa hiển thị được ảnh. Vui lòng đóng và thử mở lại.</p>
          : <img src={source} alt={name} onError={() => setFailed(true)} />}
      </div>
      <footer>{originalSize ? "Cuộn để xem các phần của ảnh. Nhấn Esc để đóng." : "Nhấn Kích thước gốc để xem ảnh chi tiết. Nhấn Esc để đóng."}</footer>
    </section>
  </div>, document.body);
}
