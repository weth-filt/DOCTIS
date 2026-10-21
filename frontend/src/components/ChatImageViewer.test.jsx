import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useState } from "react";
import ChatImageViewer from "./ChatImageViewer";

// A synthetic one-pixel image; no actual chat, patient data, or network request.
const image = { name: "fixture.png", type: "image/png", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==" };
function Harness({ onDownload }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Mở ảnh kiểm thử</button>
    <ChatImageViewer attachment={open ? image : null} onClose={() => setOpen(false)} onDownload={onDownload} /></>;
}

test("base64 opens in an embedded image viewer without top-level navigation", () => {
  const openTab = jest.spyOn(window, "open").mockImplementation(() => null);
  try {
    render(<Harness />);
    const before = window.location.href;
    fireEvent.click(screen.getByText("Mở ảnh kiểm thử"));
    const dialog = screen.getByRole("dialog", { name: image.name });
    expect(within(dialog).getByRole("img", { name: image.name })).toHaveAttribute("src", image.dataUrl);
    expect(dialog.querySelector("a")).toBeNull();
    expect(window.location.href).toBe(before);
    expect(openTab).not.toHaveBeenCalled();
  } finally { openTab.mockRestore(); }
});

test("Escape closes and restores focus and document scrolling", () => {
  const overflow = document.body.style.overflow;
  render(<Harness />);
  const trigger = screen.getByText("Mở ảnh kiểm thử");
  trigger.focus(); fireEvent.click(trigger);
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe(overflow);
});

test("original size and fit switch without changing the image source", () => {
  render(<Harness />); fireEvent.click(screen.getByText("Mở ảnh kiểm thử"));
  fireEvent.click(screen.getByRole("button", { name: "Kích thước gốc" }));
  expect(screen.getByRole("button", { name: "Vừa màn hình" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("img").parentElement).toHaveClass("is-original");
  fireEvent.click(screen.getByRole("button", { name: "Vừa màn hình" }));
  expect(screen.getByRole("img").parentElement).not.toHaveClass("is-original");
  expect(screen.getByRole("img")).toHaveAttribute("src", image.dataUrl);
});

test("image interaction keeps the viewer open and backdrop closes it", () => {
  render(<Harness />); fireEvent.click(screen.getByText("Mở ảnh kiểm thử"));
  fireEvent.mouseDown(screen.getByRole("img"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.mouseDown(document.querySelector(".chat-image-viewer-shade"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("download delegates to the existing attachment handler", () => {
  const download = jest.fn();
  render(<Harness onDownload={download} />); fireEvent.click(screen.getByText("Mở ảnh kiểm thử"));
  fireEvent.click(screen.getByRole("button", { name: "Tải xuống" }));
  expect(download).toHaveBeenCalledWith(image);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Đóng ảnh" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("an image error is visible and a different attachment resets viewer state", () => {
  const { rerender } = render(<ChatImageViewer attachment={image} onClose={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Kích thước gốc" }));
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByRole("alert")).toHaveTextContent("Chưa hiển thị được ảnh");
  rerender(<ChatImageViewer attachment={{ name: "another.png", url: "/fixtures/another.png" }} onClose={() => {}} />);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.getByRole("img")).toHaveAttribute("src", "/fixtures/another.png");
  expect(screen.getByRole("button", { name: "Kích thước gốc" })).toHaveAttribute("aria-pressed", "false");
});
