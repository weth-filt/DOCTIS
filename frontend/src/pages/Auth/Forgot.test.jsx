import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Forgot from "./Forgot";
import API from "../../services/api";
jest.mock("../../services/api", () => ({ post: jest.fn() }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../components/Auth3DVisual", () => () => null);
jest.mock("framer-motion", () => ({ motion: { div: ({ children, initial, animate, transition, ...props }) => <div {...props}>{children}</div> } }));
beforeEach(() => { jest.clearAllMocks(); API.post.mockResolvedValue({ data: { msg: "Thao tác kiểm thử thành công" } }); });
const mount = () => render(<Forgot />);

test("reset flow includes email OTP password and matching confirmation in the supported API contract", async () => {
  mount();
  fireEvent.change(screen.getByLabelText("Địa chỉ Email tài khoản"), { target: { value: "fixture@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi mã xác thực OTP" }));
  fireEvent.change(await screen.findByLabelText("Mã xác thực OTP"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận mã OTP" }));
  fireEvent.change(await screen.findByLabelText("Mật khẩu mới"), { target: { value: "fixture-password" } });
  fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "fixture-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu mật khẩu mới" }));
  await screen.findByText("Mật khẩu đã được cập nhật. Bạn có thể quay lại đăng nhập.");
  expect(API.post).toHaveBeenNthCalledWith(1, "/auth/forgot", { email: "fixture@example.test" });
  expect(API.post).toHaveBeenNthCalledWith(2, "/auth/verify", { email: "fixture@example.test", otp: "123456" });
  expect(API.post).toHaveBeenNthCalledWith(3, "/auth/reset", { email: "fixture@example.test", otp: "123456", password: "fixture-password", confirmPassword: "fixture-password" });
});

test("missing mail configuration shows a real error and leaves the email step available", async () => {
  API.post.mockRejectedValue({ response: { status: 503, data: { msg: "Chưa cấu hình email." } } });
  mount(); fireEvent.change(screen.getByLabelText("Địa chỉ Email tài khoản"), { target: { value: "fixture@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Gửi mã xác thực OTP" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Chưa cấu hình email.");
  expect(screen.queryByLabelText("Mã xác thực OTP")).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Gửi mã xác thực OTP" }).disabled).toBe(false));
});

test("same-batch submit cannot request duplicate OTP emails", async () => {
  let resolve; API.post.mockReturnValue(new Promise(done => { resolve = done; }));
  const { container } = mount(); fireEvent.change(screen.getByLabelText("Địa chỉ Email tài khoản"), { target: { value: "fixture@example.test" } });
  act(() => { fireEvent.submit(container.querySelector("form")); fireEvent.submit(container.querySelector("form")); });
  expect(API.post).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: { msg: "Đã gửi mã kiểm thử" } }); });
  await screen.findByLabelText("Mã xác thực OTP");
});
