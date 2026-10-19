// READ ONLY. Never loads dotenv, runs model.init(), creates indexes or applies
// migrations. The operator must explicitly supply a URI through a dedicated
// environment variable; its value is never printed.
const { MongoClient } = require("mongoose").mongo;

async function audit(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const [users, assignments, intakes, wards, hospitals] = await Promise.all([
      db.collection("users").find({}, { projection: { _id: 1, role: 1, doctorId: 1, hospitalId: 1, wardId: 1, city: 1 } }).toArray(),
      db.collection("doctorassignments").find({ status: "active" }, { projection: { patientId: 1, doctorId: 1, hospitalId: 1, supportRequestId: 1 } }).toArray(),
      db.collection("supportrequests").find({}, { projection: { patientId: 1, status: 1, hospitalId: 1, assignedDoctorId: 1 } }).toArray(),
      db.collection("wards").find({}, { projection: { _id: 1, active: 1, verified: 1, city: 1 } }).toArray(),
      db.collection("hospitals").find({}, { projection: { _id: 1, active: 1, verified: 1 } }).toArray(),
    ]);
    const key = value => String(value || "");
    const userMap = new Map(users.map(value => [key(value._id), value]));
    const validWards = new Set(wards.filter(value => value.active && value.verified && value.city === "Đà Nẵng").map(value => key(value._id)));
    const validHospitals = new Set(hospitals.filter(value => value.active && value.verified).map(value => key(value._id)));
    const counts = new Map(); assignments.forEach(value => counts.set(key(value.patientId), (counts.get(key(value.patientId)) || 0) + 1));
    return { mode: "dry-run-read-only", applied: false, counts: {
      patients: users.filter(value => value.role === "user").length,
      patientsRequiringWardReview: users.filter(value => value.role === "user" && (!validWards.has(key(value.wardId)) || value.city !== "Đà Nẵng")).length,
      doctorsWithoutVerifiedHospital: users.filter(value => value.role === "doctor" && !validHospitals.has(key(value.hospitalId))).length,
      legacyActiveAssignments: assignments.filter(value => !value.supportRequestId || !value.hospitalId).length,
      duplicateActivePatients: [...counts.values()].filter(value => value > 1).length,
      activeAssignmentsWithInvalidDoctorRole: assignments.filter(value => userMap.get(key(value.doctorId))?.role !== "doctor").length,
      stalePatientDoctorPointers: assignments.filter(value => key(userMap.get(key(value.patientId))?.doctorId) !== key(value.doctorId)).length,
      intakes: intakes.length,
    }, nextSteps: ["Đối chiếu và nhập danh mục phường/bệnh viện có nguồn đã xác minh.", "Bổ sung địa chỉ bằng tài khoản bệnh nhân; không tự gán bệnh viện/bác sĩ cho dữ liệu cũ.", "Nếu có nhiều phân công active cho một bệnh nhân, admin phải kiểm tra lịch sử và xử lý rõ trước khi tạo unique index.", "Chưa áp dụng thay đổi dữ liệu hoặc thay đổi index. Không có chế độ --apply trong script này."] };
  } finally { await client.close(); }
}
if (require.main === module) {
  if (!process.argv.includes("--dry-run") || !process.env.DOCTIS_MIGRATION_MONGO_URI) { process.stderr.write("Cần --dry-run và biến DOCTIS_MIGRATION_MONGO_URI do người vận hành cấu hình; không dán URI vào lệnh hoặc log.\n"); process.exitCode = 1; }
  else audit(process.env.DOCTIS_MIGRATION_MONGO_URI).then(value => process.stdout.write(JSON.stringify(value, null, 2) + "\n")).catch(() => { process.stderr.write("Không thể hoàn thành audit chỉ đọc. Kiểm tra cấu hình kết nối riêng; URI và chi tiết kết nối không được ghi log.\n"); process.exitCode = 1; });
}
module.exports = { audit };
