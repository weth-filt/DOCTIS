const { CITY } = require("./coordinationUtils");

// Keep imported catalog entries visible to admins while explaining why an
// entry cannot yet receive patients. A catalog row is never verified here.
function hospitalAvailability(hospital, ward) {
  const issues = [];
  if (!hospital.active) issues.push({ code: "INACTIVE", message: "Cơ sở đang ngừng hoạt động trên hệ thống." });
  if (!hospital.verified) issues.push({ code: "UNVERIFIED", message: "Chưa đối chiếu và xác minh thông tin cơ sở." });
  if (!hospital.wardId) issues.push({ code: "WARD_REQUIRED", message: "Chưa cập nhật phường hiện tại của bệnh viện." });
  else if (!ward || !ward.active || !ward.verified || ward.city !== CITY) issues.push({ code: "WARD_UNAVAILABLE", message: "Phường của bệnh viện chưa thuộc danh mục phục vụ đang hoạt động." });
  if (!String(hospital.phone || "").trim()) issues.push({ code: "PHONE_REQUIRED", message: "Chưa cập nhật số điện thoại bệnh viện." });
  if (!hospital.acceptingPatients) issues.push({ code: "NOT_ACCEPTING", message: "Admin chưa bật tiếp nhận bệnh nhân tại cơ sở này." });
  return { coordinationEligible: issues.length === 0, coordinationIssues: issues };
}

module.exports = { hospitalAvailability };
