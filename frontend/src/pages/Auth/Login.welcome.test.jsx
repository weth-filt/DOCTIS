import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Login from "./Login";
import API from "../../services/api";
import { beginPatientWelcome, completePatientWelcome, hasPendingPatientWelcome, PATIENT_WELCOME_KEY } from "../../components/studio/patientWelcomeSession";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../../services/api", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("../../components/Auth3DVisual", () => () => null);
jest.mock("framer-motion", () => ({
  motion: { div: ({ children, initial, animate, transition, ...props }) => <div {...props}>{children}</div> },
}));

// Login fixtures are test-only; the HTTP client is mocked. No real credentials,
// authentication requests, patient records or database writes are used here.
const response = role => ({ data: {
  token: "test-only-token", role,
  user: { id: "fixture-user", fullName: "Người dùng kiểm thử", username: "fixture", email: "fixture@example.test" },
} });
let alertSpy;
beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  completePatientWelcome();
  jest.clearAllMocks();
  alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  completePatientWelcome();
  alertSpy.mockRestore();
});

function submitLogin() {
  const result = render(<Login />);
  fireEvent.change(screen.getByLabelText("Địa chỉ Email"), { target: { value: "Fixture@example.test" } });
  fireEvent.change(document.getElementById("login-password"), { target: { value: "test-only-password" } });
  fireEvent.submit(result.container.querySelector("form"));
  return result;
}

test("successful patient login marks the welcome pending before dashboard navigation and reads the returned name", async () => {
  window.sessionStorage.setItem("doctis.ui.intro.v1", "seen");
  API.post.mockResolvedValue(response("user"));
  mockNavigate.mockImplementation(() => {
    expect(hasPendingPatientWelcome()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("user")).fullName).toBe("Người dùng kiểm thử");
  });
  submitLogin();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/dashboard", { replace: true }));
  expect(API.post).toHaveBeenCalledTimes(1);
  expect(API.post).toHaveBeenCalledWith("/auth/login", { email: "fixture@example.test", password: "test-only-password" });
  expect(window.sessionStorage.getItem(PATIENT_WELCOME_KEY)).toBe("pending");
  expect(JSON.parse(window.localStorage.getItem("user"))).toMatchObject({ id: "fixture-user", _id: "fixture-user", role: "user" });
});

test.each([["doctor", "/doctor"], ["admin", "/admin"]])("%s keeps its existing destination without a patient welcome", async (role, destination) => {
  beginPatientWelcome();
  API.post.mockResolvedValue(response(role));
  mockNavigate.mockImplementation(() => expect(hasPendingPatientWelcome()).toBe(false));
  submitLogin();
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(destination, { replace: true }));
  expect(hasPendingPatientWelcome()).toBe(false);
});

test.each([
  ["API rejection", () => Promise.reject({ response: { data: { msg: "Đăng nhập không thành công." } } })],
  ["missing token", () => Promise.resolve({ data: { role: "user", user: { fullName: "Fixture" } } })],
])("%s does not create a welcome or navigate", async (_label, result) => {
  API.post.mockImplementation(result);
  submitLogin();
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(hasPendingPatientWelcome()).toBe(false);
  expect(window.localStorage.getItem("token")).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled();
});
