import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import API from "../../services/api";
import CareTeamPanel from "./CareTeamPanel";
import AdminCoordination from "./AdminCoordination";
import AdminCatalogManager from "./AdminCatalogManager";
import LegacyUnassignDialog from "./LegacyUnassignDialog";
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
const ward = { id: "ward-fixture", code: "TEST", name: "Phường kiểm thử", city: "Đà Nẵng", active: true, verified: true };
const hospital = { id: "hospital-fixture", name: "Bệnh viện kiểm thử", address: "Địa chỉ kiểm thử", phone: "0000", wardId: ward.id, active: true, verified: true, acceptingPatients: true };
const patient = { _id: "patient-fixture", fullName: "Bệnh nhân kiểm thử", email: "patient@example.test", address: "Địa chỉ thử nghiệm", wardId: ward.id, city: "Đà Nẵng" };
const intake = { id: "intake-fixture", patient, ward, status: "waiting_hospital", revision: 2, createdAt: "2026-10-19T08:00:00Z", history: [] };
const care = { status: "hospital_selected", intake: { ...intake, hospital }, hospital, doctor: null, address: { address: patient.address, wardId: ward.id, ward, city: "Đà Nẵng" }, requiresAddressUpdate: false };
beforeEach(() => {
  jest.clearAllMocks();
  API.get.mockImplementation(path => {
    if (path === "/care-team") return Promise.resolve({ data: care });
    if (path === "/public/wards" || path === "/admin/catalog/wards") return Promise.resolve({ data: { wards: [ward] } });
    if (path === "/admin/catalog/hospitals") return Promise.resolve({ data: { hospitals: [hospital] } });
    if (path === "/admin/intakes") return Promise.resolve({ data: { intakes: [intake] } });
    if (path === "/admin/assignments/doctors") return Promise.resolve({ data: [{ _id: "doctor-fixture", fullName: "Bác sĩ kiểm thử", role: "doctor", hospitalId: hospital.id }, { _id: "outsider", fullName: "Ngoài bệnh viện", role: "doctor", hospitalId: "other-hospital" }] });
    if (path === "/admin/intakes/intake-fixture") return Promise.resolve({ data: { intake } });
    return Promise.reject(new Error("Unmocked test read"));
  });
  API.post.mockResolvedValue({ data: { intake: { ...intake, hospital, status: "hospital_selected", revision: 3 }, msg: "Đã cập nhật bệnh viện kiểm thử" } });
  API.patch.mockResolvedValue({ data: { ...care, requiresAddressUpdate: false, msg: "Đã lưu địa chỉ kiểm thử" } });
});
test("patient sees only a real hospital, awaiting doctor, and no appointment is invented", async () => {
  render(<CareTeamPanel />);
  await screen.findByRole("heading", { name: hospital.name });
  expect(screen.getByRole("heading", { name: "Chờ bác sĩ phụ trách" })).toBeTruthy();
  expect(screen.getByText(/chưa phải lịch hẹn khám/)).toBeTruthy(); expect(API.post).not.toHaveBeenCalled();
});
test("legacy address repair uses the existing account and persisted care-team endpoint", async () => {
  API.get.mockImplementation(path => Promise.resolve({ data: path === "/care-team" ? { ...care, hospital: null, status: "waiting_hospital", requiresAddressUpdate: true, address: {} } : { wards: [ward] } }));
  render(<CareTeamPanel />);
  await screen.findByRole("option", { name: ward.name });
  fireEvent.change(screen.getByLabelText("Phường *"), { target: { value: ward.id } });
  fireEvent.change(screen.getByLabelText("Địa chỉ chi tiết *"), { target: { value: "Địa chỉ bổ sung" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));
  await screen.findByText("Đã lưu địa chỉ kiểm thử");
  expect(API.patch).toHaveBeenCalledWith("/care-team/address", { address: "Địa chỉ bổ sung", wardId: ward.id, city: "Đà Nẵng" });
  expect(API.post).not.toHaveBeenCalled();
});
test("editing a valid address keeps the draft and focus when notification data refreshes", async () => {
  const { rerender } = render(<CareTeamPanel refreshKey={0} />);
  fireEvent.click(await screen.findByRole("button", { name: "Cập nhật địa chỉ" }));
  await screen.findByRole("option", { name: ward.name });
  const address = screen.getByLabelText("Địa chỉ chi tiết *"); address.focus();
  fireEvent.change(address, { target: { value: "Bản nháp địa chỉ mới" } });
  rerender(<CareTeamPanel refreshKey={1} />);
  await waitFor(() => expect(API.get.mock.calls.filter(([path]) => path === "/care-team")).toHaveLength(2));
  expect(screen.getByLabelText("Địa chỉ chi tiết *").value).toBe("Bản nháp địa chỉ mới");
  expect(document.activeElement).toBe(address);
});
test("hospital selection is its own mutation and never auto-assigns a doctor", async () => {
  render(<AdminCoordination />);
  fireEvent.click(await screen.findByRole("button", { name: /Bệnh nhân kiểm thử/ }));
  const hospitalSelect = screen.getByLabelText("Bệnh viện hỗ trợ");
  fireEvent.change(hospitalSelect, { target: { value: hospital.id } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bệnh viện hỗ trợ" }));
  await screen.findByText("Đã cập nhật bệnh viện kiểm thử");
  expect(API.post).toHaveBeenCalledWith("/admin/intakes/intake-fixture/hospital", { hospitalId: hospital.id, reason: "", revision: 2 });
  expect(API.post.mock.calls.some(([path]) => /assign$/.test(path))).toBe(false);
  expect(screen.getByRole("button", { name: "Ghi nhận phân công" }).disabled).toBe(true);
});
test("accepted hospital constrains doctor options and keeps the record revision in the mutation", async () => {
  const accepted = { ...intake, hospital, status: "accepted", revision: 5 };
  const previous = API.get.getMockImplementation();
  API.get.mockImplementation((path, config) => path === "/admin/intakes" ? Promise.resolve({ data: { intakes: [accepted] } }) : previous(path, config));
  render(<AdminCoordination />);
  fireEvent.click(await screen.findByRole("button", { name: /Bệnh nhân kiểm thử/ }));
  await screen.findByRole("option", { name: "Bác sĩ kiểm thử" });
  expect(screen.queryByRole("option", { name: "Ngoài bệnh viện" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Bác sĩ thuộc bệnh viện tiếp nhận"), { target: { value: "doctor-fixture" } });
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận phân công" }));
  await waitFor(() => expect(API.post).toHaveBeenCalledWith("/admin/intakes/intake-fixture/assign", { doctorId: "doctor-fixture", reason: "", revision: 5 }));
});
test("notification focus opens the exact intake even when it is outside the list filter", async () => {
  render(<AdminCoordination focusIntakeId="intake-fixture" />);
  await screen.findByRole("heading", { name: "Bệnh nhân kiểm thử" });
  expect(API.get).toHaveBeenCalledWith("/admin/intakes/intake-fixture", expect.objectContaining({ signal: expect.anything() }));
});
test("catalogs stay empty without verified data and source verification is required before writing", async () => {
  API.get.mockResolvedValue({ data: { wards: [], hospitals: [] } });
  render(<AdminCatalogManager />);
  await screen.findByText(/Chưa có dữ liệu. Nhập thông tin từ nguồn chính thức/);
  fireEvent.change(screen.getByLabelText("Tên phường *"), { target: { value: "Phường kiểm thử" } });
  fireEvent.change(screen.getByLabelText("Mã phường chính thức *"), { target: { value: "TEST" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu danh mục" }));
  expect(API.post).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain("nguồn HTTPS");
});
test("an address update error retains the user's draft and does not show success", async () => {
  API.patch.mockRejectedValue({ response: { data: { msg: "Lỗi lưu kiểm thử" } } });
  render(<CareTeamPanel />); fireEvent.click(await screen.findByRole("button", { name: "Cập nhật địa chỉ" }));
  await screen.findByRole("option", { name: ward.name });
  fireEvent.change(screen.getByLabelText("Địa chỉ chi tiết *"), { target: { value: "Địa chỉ chưa lưu" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu địa chỉ" }));
  await screen.findByText("Lỗi lưu kiểm thử"); expect(screen.getByLabelText("Địa chỉ chi tiết *").value).toBe("Địa chỉ chưa lưu");
  expect(screen.queryByText("Đã lưu địa chỉ kiểm thử")).toBeNull();
  await act(async () => {});
});
test("intake pagination exposes older records without duplicate list entries", async () => {
  const previous = API.get.getMockImplementation();
  API.get.mockImplementation((path, config) => path === "/admin/intakes" ? Promise.resolve({ data: config?.params?.before ? { intakes: [intake, { ...intake, id: "older-intake", patient: { ...patient, fullName: "Hồ sơ cũ kiểm thử" } }], hasMore: false } : { intakes: [intake], hasMore: true, nextCursor: "cursor-fixture" } }) : previous(path, config));
  render(<AdminCoordination />); fireEvent.click(await screen.findByRole("button", { name: "Tải thêm hồ sơ" }));
  await screen.findByRole("button", { name: /Hồ sơ cũ kiểm thử/ });
  expect(screen.getAllByRole("button", { name: /Bệnh nhân kiểm thử/ })).toHaveLength(1);
  expect(API.get).toHaveBeenCalledWith("/admin/intakes", { params: { search: "", wardId: "", status: "", before: "cursor-fixture" } });
});
test("legacy unassignment requires a reason and retains the old record until the API confirms", async () => {
  const onSaved = jest.fn(), onClose = jest.fn();
  render(<LegacyUnassignDialog patient={{ ...patient, legacyAssignment: true }} onSaved={onSaved} onClose={onClose} />);
  expect(screen.getByRole("button", { name: "Kết thúc phân công cũ" }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Đối chiếu phân công kiểm thử" } });
  fireEvent.click(screen.getByRole("button", { name: "Kết thúc phân công cũ" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(API.post).toHaveBeenCalledWith("/admin/assignments/unassign", { patientId: patient._id, reason: "Đối chiếu phân công kiểm thử" });
  expect(onClose).toHaveBeenCalled();
});
