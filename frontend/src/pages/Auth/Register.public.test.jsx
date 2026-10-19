import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Register from "./Register";
import API from "../../services/api";
const mockNavigate = jest.fn();
jest.mock("../../services/api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../../components/Auth3DVisual", () => () => null);
jest.mock("framer-motion", () => ({ motion: { div: ({ children, initial, animate, transition, ...props }) => <div {...props}>{children}</div> } }));
const ward = { id: "ward-fixture", code: "TEST", name: "Phường kiểm thử", city: "Đà Nẵng" };
beforeEach(() => { jest.clearAllMocks(); API.get.mockResolvedValue({ data: { wards: [ward], city: "Đà Nẵng", configured: true } }); API.post.mockResolvedValue({ data: { msg: "Đăng ký kiểm thử thành công" } }); });
function fill() {
  fireEvent.change(screen.getByLabelText("Số CCCD / Định danh"), { target: { value: "000000000001" } });
  fireEvent.change(screen.getByLabelText("Tên người dùng"), { target: { value: "test-patient" } });
  fireEvent.change(screen.getByLabelText("Địa chỉ Email"), { target: { value: "patient@example.test" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "fixture-pass" } });
  fireEvent.change(screen.getByLabelText("Xác nhận"), { target: { value: "fixture-pass" } });
  fireEvent.change(screen.getByLabelText("Địa chỉ chi tiết *"), { target: { value: "Địa chỉ thử nghiệm" } });
}
test("loads shared wards, fixes the city and submits all existing fields plus a verified catalog selection", async () => {
  render(<Register />); await screen.findByRole("option", { name: ward.name }); fill();
  expect(screen.getByLabelText("Thành phố").readOnly).toBe(true);
  fireEvent.change(screen.getByLabelText("Phường *"), { target: { value: ward.id } });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất đăng ký" }));
  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  expect(API.post).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ cccd: "000000000001", username: "test-patient", email: "patient@example.test", password: "fixture-pass", confirmPassword: "fixture-pass", address: "Địa chỉ thử nghiệm", wardId: ward.id, city: "Đà Nẵng", requestId: expect.any(String) }));
  expect(API.post.mock.calls[0][1]).not.toHaveProperty("doctorId");
  expect(API.post.mock.calls[0][1]).not.toHaveProperty("userId");
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
});
test("missing ward and invalid identification are rejected before any write", async () => {
  render(<Register />); await screen.findByRole("option", { name: ward.name }); fill();
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất đăng ký" }));
  expect(API.post).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Phường *"), { target: { value: ward.id } });
  fireEvent.change(screen.getByLabelText("Số CCCD / Định danh"), { target: { value: "bad-id" } });
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất đăng ký" }));
  expect(screen.getByRole("alert").textContent).toContain("12 chữ số"); expect(API.post).not.toHaveBeenCalled();
});
test("an empty catalog leaves registration disabled and explains the missing configuration", async () => {
  API.get.mockResolvedValue({ data: { wards: [], configured: false } }); render(<Register />);
  await screen.findByText(/Danh mục phường chưa được cấu hình/);
  expect(screen.getByRole("button", { name: "Hoàn tất đăng ký" }).disabled).toBe(true); expect(API.post).not.toHaveBeenCalled();
});
test("same-tick submissions are locked and an ambiguous retry reuses its requestId", async () => {
  let reject;
  API.post.mockReturnValueOnce(new Promise((resolve, decline) => { reject = decline; })).mockResolvedValueOnce({ data: { msg: "Đã lưu" } });
  const { container } = render(<Register />); await screen.findByRole("option", { name: ward.name }); fill();
  fireEvent.change(screen.getByLabelText("Phường *"), { target: { value: ward.id } });
  act(() => { fireEvent.submit(container.querySelector("form")); fireEvent.submit(container.querySelector("form")); });
  expect(API.post).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Network failure")));
  fireEvent.click(screen.getByRole("button", { name: "Hoàn tất đăng ký" }));
  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(2));
  expect(API.post.mock.calls[0][1].requestId).toBe(API.post.mock.calls[1][1].requestId);
});
