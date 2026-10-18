import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PrescriptionPanel from "./PrescriptionPanel";

test("empty prescription text stays in the panel and has a status", () => {
  render(<PrescriptionPanel />);
  expect(screen.getByRole("status")).toHaveTextContent("Chưa có đơn thuốc đã chốt");
  expect(screen.getByRole("region", {name: "Đơn thuốc đã chốt"})).toContainElement(screen.getByRole("status"));
});
test("renders the actual medicine, dose, times and note without truncation", () => {
  const name = "Tên thuốc rất dài ".repeat(12);
  render(<PrescriptionPanel prescriptions={[{_id:"rx",title:"Đơn đã xác nhận",note:"Ghi chú của bác sĩ",medicines:[{name,dosage:"Theo đơn",times:["07:00","19:00"],mealRelation:"AFTER_MEAL"}]}]} />);
  expect(screen.getByText(name.trim())).toBeInTheDocument();
  expect(screen.getByText(/07:00, 19:00/)).toHaveTextContent("Sau ăn");
  expect(screen.getByText("Ghi chú của bác sĩ")).toBeInTheDocument();
});
