export const entityId = value => typeof value === "string" ? value : value?.id || value?._id || "";
export const personName = value => value?.fullName || value?.username || "Chưa có tên";
export const INTAKE_LABELS = Object.freeze({ waiting_hospital: "Chờ cập nhật bệnh viện", hospital_selected: "Chờ bệnh viện tiếp nhận", accepted: "Đã tiếp nhận · chờ bác sĩ", assigned: "Đã có bác sĩ phụ trách" });
export const intakeLabel = status => INTAKE_LABELS[status] || "Cần admin kiểm tra hồ sơ";
export function localDate(value) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Chưa có thời điểm";
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}
export const errorText = (error, fallback) => error?.response?.data?.msg || error?.response?.data?.message || fallback;
export const validSource = value => { try { const url = new URL(value); return url.protocol === "https:"; } catch { return false; } };
export const verifiedActive = item => item?.active !== false && item?.verified === true;
export function hospitalIssues(hospital, wards = []) {
  if (!hospital) return ["Chưa chọn bệnh viện"];
  if (Array.isArray(hospital.coordinationIssues)) return hospital.coordinationIssues.map(issue => issue.message || issue).filter(Boolean);
  const ward = wards.find(item => entityId(item) === entityId(hospital.wardId)) || hospital.ward;
  return [
    hospital.active === false && "Đã ngừng hoạt động trong danh mục",
    !hospital.verified && "Chờ đối chiếu thông tin",
    !entityId(hospital.wardId) && "Chưa xác định phường hiện tại",
    ward && !verifiedActive(ward) && "Phường chưa sẵn sàng phục vụ",
    !hospital.acceptingPatients && "Chưa bật tiếp nhận bệnh nhân",
  ].filter(Boolean);
}
export const hospitalReady = (hospital, wards) => Boolean(hospital) && hospitalIssues(hospital, wards).length === 0;
export function hospitalMembershipIssues(hospital, wards = []) {
  if (!hospital) return ["Chưa chọn bệnh viện"];
  if (Array.isArray(hospital.coordinationIssues)) return hospital.coordinationIssues.filter(issue => issue.code !== "NOT_ACCEPTING").map(issue => issue.message || issue).filter(Boolean);
  return [...hospitalIssues(hospital, wards).filter(issue => issue !== "Chưa bật tiếp nhận bệnh nhân"), ...(!hospital.phone?.trim() ? ["Chưa có số liên hệ bệnh viện"] : [])];
}
export const createRequestKey = () => typeof window.crypto?.randomUUID === "function" ? window.crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => { const random = Math.floor(Math.random() * 16); return (character === "x" ? random : (random & 3) | 8).toString(16); });
