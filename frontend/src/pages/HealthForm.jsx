import React from "react";

export default function HealthForm(){

  return(
    <div className="main-content">

      <h1 className="section-title">
        Thêm thông tin sức khỏe
      </h1>

      <div className="big-card health-form">

        <div className="form-grid">

          <input placeholder="Glucose" />

          <input placeholder="BMI" />

          <input placeholder="Huyết áp" />

          <input placeholder="Nhịp tim" />

          <input placeholder="HbA1c" />

          <input placeholder="Cholesterol" />

        </div>

        <button className="save-btn">
          Lưu dữ liệu sức khỏe
        </button>

      </div>

      <div className="big-card">
        <h2>Lịch sử sức khỏe</h2>

        <table className="history-table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Glucose</th>
              <th>BMI</th>
              <th>Huyết áp</th>
              <th>AI</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>12/05/2026</td>
              <td>110</td>
              <td>24</td>
              <td>120/80</td>
              <td>Tốt</td>
            </tr>
          </tbody>

        </table>
      </div>

    </div>
  )
}