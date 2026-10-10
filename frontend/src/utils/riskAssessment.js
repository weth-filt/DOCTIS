export default function getRiskAssessment(health) {
  if (!health) return "Chưa có dữ liệu";

  const value = (key) => {
    if (health[key] === null || health[key] === undefined || health[key] === "") return null;
    const number = Number(health[key]);
    return Number.isFinite(number) ? number : null;
  };

  const glucose = value("glucose");
  const bmi = value("bmi");
  const heartRate = value("heartRate");
  const systolic = value("systolic");
  const diastolic = value("diastolic");

  if (
    (glucose !== null && (glucose > 180 || glucose < 70)) ||
    (bmi !== null && bmi >= 30) ||
    (heartRate !== null && (heartRate > 120 || heartRate < 50)) ||
    (systolic !== null && systolic > 160) ||
    (diastolic !== null && diastolic > 100)
  ) return "Nguy hiểm";

  if (
    (glucose !== null && glucose > 126) ||
    (bmi !== null && bmi >= 25) ||
    (heartRate !== null && heartRate > 100) ||
    (systolic !== null && systolic > 140) ||
    (diastolic !== null && diastolic > 90)
  ) return "Cao";

  return [glucose, bmi, heartRate, systolic, diastolic].some((item) => item !== null)
    ? "Ổn định"
    : "Chưa có dữ liệu";
}
