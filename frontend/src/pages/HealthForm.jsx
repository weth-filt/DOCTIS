import React from "react";
import { FaHeartbeat, FaHistory, FaSave } from "react-icons/fa";

export default function HealthForm() {
  return (
    <div className="doctis-main-container" style={{ maxWidth: "1000px" }}>
      <header style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 700, color: "var(--doc-heading)", marginBottom: "6px" }}>
          Thông tin chỉ số sức khỏe
        </h1>
        <p style={{ color: "var(--doc-subtext)", fontSize: "15px" }}>
          Theo dõi định kỳ các chỉ số sinh hiệu để đánh giá nguy cơ và nhận gợi ý y khoa kịp thời
        </p>
      </header>

      {/* Card nhập chỉ số */}
      <div className="doc-card" style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--doc-heading)", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <FaHeartbeat style={{ color: "var(--doc-primary)" }} /> Cập nhật chỉ số hôm nay
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <div className="doc-field">
            <label className="doc-label">Glucose (Đường huyết lúc đói)</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 105" type="number" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>mg/dL</span>
            </div>
          </div>

          <div className="doc-field">
            <label className="doc-label">Chỉ số BMI</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 22.5" type="number" step="0.1" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>kg/m²</span>
            </div>
          </div>

          <div className="doc-field">
            <label className="doc-label">Huyết áp (Tâm thu / Tâm trương)</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 120/80" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>mmHg</span>
            </div>
          </div>

          <div className="doc-field">
            <label className="doc-label">Nhịp tim khi nghỉ</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 75" type="number" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>bpm</span>
            </div>
          </div>

          <div className="doc-field">
            <label className="doc-label">Chỉ số HbA1c (nếu có)</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 6.2" type="number" step="0.1" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>%</span>
            </div>
          </div>

          <div className="doc-field">
            <label className="doc-label">Cholesterol toàn phần</label>
            <div className="doc-input-wrapper">
              <input className="doc-input" placeholder="Ví dụ: 180" type="number" />
              <span style={{ position: "absolute", right: "14px", color: "var(--doc-muted)", fontSize: "13px" }}>mg/dL</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
          <button className="doc-btn doc-btn-primary">
            <FaSave /> Lưu dữ liệu sức khỏe
          </button>
        </div>
      </div>

      {/* Lịch sử sức khỏe */}
      <div className="doctis-table-card">
        <div className="doctis-table-header">
          <h2 className="doctis-table-title">
            <FaHistory style={{ color: "var(--doc-primary)" }} /> Lịch sử đo gần đây
          </h2>
        </div>

        <div className="doctis-table-scroll">
          <table className="doctis-table">
            <thead>
              <tr>
                <th>Ngày ghi nhận</th>
                <th>Glucose (mg/dL)</th>
                <th>Chỉ số BMI</th>
                <th>Huyết áp (mmHg)</th>
                <th>Nhịp tim (bpm)</th>
                <th>Đánh giá AI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} style={{ padding: "28px 16px", textAlign: "center", color: "var(--doc-muted)" }}>
                  Chưa có dữ liệu sức khỏe để hiển thị.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
