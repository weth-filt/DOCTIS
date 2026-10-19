import "../CSS/prescription-panel.css";

// Presentation only: the caller supplies prescriptions already confirmed by a doctor.
export default function PrescriptionPanel({ prescriptions = [], loading = false }) {
  return <section className="prescription-panel prescription-panel-v6" aria-labelledby="confirmed-prescriptions-title">
    <div className="prescription-panel-header">
      <div><span className="care-section-kicker">BÁC SĨ</span><h3 id="confirmed-prescriptions-title">Đơn thuốc đã xác nhận</h3><p>Chỉ đơn đã được xác nhận mới được tự động đưa vào thời khóa biểu.</p></div>
      <span>{loading ? "Đang tải..." : `${prescriptions.length} đơn đã xác nhận`}</span>
    </div>
    {prescriptions.length ? prescriptions.map((rx, index) => <article className="prescription-card prescription-card-v6" key={rx._id || rx.id || index}>
      <div className="prescription-med-icon" aria-hidden="true">💊</div>
      <div className="prescription-copy"><strong>{rx.title || rx.name || `Đơn thuốc ${index + 1}`}</strong><span>{rx.doctorId?.fullName || rx.doctor?.fullName || "Bác sĩ điều trị"}</span>
        <ul className="prescription-medicines">{(rx.medicines || rx.items || []).map((med, medIndex) => <li key={med._id || medIndex}>
          <strong>{med.name || med.medicineName || med.drugName || "Thuốc theo đơn"}</strong>
          <p>{[med.dosage || med.dose, med.frequency, (med.times || (med.time ? [med.time] : [])).join(", "), med.mealRelation === "AFTER_MEAL" ? "Sau ăn" : med.mealRelation === "BEFORE_MEAL" ? "Trước ăn" : ""].filter(Boolean).join(" • ")}</p>
          {med.note && <p>{med.note}</p>}
        </li>)}</ul>
        {rx.note && <p className="prescription-note">{rx.note}</p>}
      </div>
      <div className="prescription-status">✓ Đã xác nhận</div>
    </article>) : <div className="prescription-empty prescription-empty-v6" role="status">
      <span aria-hidden="true">💊</span><div><strong>{loading ? "Đang tải đơn thuốc" : "Chưa có đơn thuốc đã xác nhận"}</strong><p>{loading ? "Vui lòng chờ trong giây lát." : "Khi bác sĩ kê và xác nhận đơn, thuốc sẽ tự động xuất hiện trong lịch ăn uống + vận động."}</p></div>
    </div>}
  </section>;
}
