import {
  FaWalking,
  FaHeartbeat,
  FaAppleAlt,
  FaExclamationTriangle,
  FaCheckCircle,
  FaWeight,
  FaGlassWhiskey,
  FaBed,
  FaShieldAlt,
  FaArrowUp,
  FaArrowDown
} from "react-icons/fa";

const generateHealthAnalysis = (data) => {

  const result = [];

  const glucose = Number(data?.glucose || 0);
  const bmi = Number(data?.bmi || 0);
  const heartRate = Number(data?.heartRate || 0);
  const water = Number(data?.water || 0);

  const systolic = Number(data?.systolic || 0);
  const diastolic = Number(data?.diastolic || 0);

  /* =========================
     GLUCOSE
  ========================= */

  if (glucose >= 180) {

    result.push({
      title: "Đường huyết rất cao",
      description:
        "Chỉ số glucose đang nguy hiểm, cần kiểm tra sớm.",
      icon: <FaExclamationTriangle />,
      bg: "red"
    });

  }
  else if (glucose > 126) {

    result.push({
      title: "Đường huyết cao",
      description:
        "Nên hạn chế đồ ngọt và tập thể dục thường xuyên.",
      icon: <FaArrowUp />,
      bg: "orange"
    });

  }
  else if (glucose < 70 && glucose > 0) {

    result.push({
      title: "Đường huyết thấp",
      description:
        "Nên bổ sung thực phẩm có đường nhẹ.",
      icon: <FaArrowDown />,
      bg: "yellow"
    });

  }
  else if (glucose > 0) {

    result.push({
      title: "Đường huyết ổn định",
      description:
        "Chỉ số glucose đang ở mức an toàn.",
      icon: <FaCheckCircle />,
      bg: "green"
    });

  }
 
  /* =========================
     BMI
  ========================= */

  if (bmi >= 30) {

    result.push({
      title: "Béo phì",
      description:
        "Nên kiểm soát cân nặng và tăng vận động.",
      icon: <FaWeight />,
      bg: "red"
    });

  }
  else if (bmi >= 25) {

    result.push({
      title: "Thừa cân",
      description:
        "Nên điều chỉnh chế độ ăn và tập luyện.",
      icon: <FaWeight />,
      bg: "orange"
    });

  }
  else if (bmi < 18.5 && bmi > 0) {

    result.push({
      title: "Thiếu cân",
      description:
        "Cần bổ sung dinh dưỡng đầy đủ hơn.",
      icon: <FaAppleAlt />,
      bg: "yellow"
    });

  }
  else if (bmi > 0) {

    result.push({
      title: "BMI bình thường",
      description:
        "Chỉ số BMI đang rất tốt.",
      icon: <FaCheckCircle />,
      bg: "green"
    });

  }

  /* =========================
     BLOOD PRESSURE
  ========================= */

  if (systolic >= 160 || diastolic >= 100) {

    result.push({
      title: "Huyết áp nguy hiểm",
      description:
        "Nên theo dõi và gặp bác sĩ sớm.",
      icon: <FaExclamationTriangle />,
      bg: "red"
    });

  }
  else if (systolic >= 140 || diastolic >= 90) {

    result.push({
      title: "Huyết áp cao",
      description:
        "Nên giảm muối và ngủ đủ giấc.",
      icon: <FaHeartbeat />,
      bg: "orange"
    });

  }
  else if (systolic > 0) {

    result.push({
      title: "Huyết áp ổn định",
      description:
        "Huyết áp đang ở mức an toàn.",
      icon: <FaShieldAlt />,
      bg: "green"
    });

  }

  /* =========================
     HEART RATE
  ========================= */

  if (heartRate > 120) {

    result.push({
      title: "Nhịp tim rất cao",
      description:
        "Cần nghỉ ngơi và kiểm tra sức khỏe.",
      icon: <FaHeartbeat />,
      bg: "red"
    });

  }
  else if (heartRate > 100) {

    result.push({
      title: "Nhịp tim cao",
      description:
        "Nên thư giãn và hạn chế căng thẳng.",
      icon: <FaHeartbeat />,
      bg: "orange"
    });

  }
  else if (heartRate < 60 && heartRate > 0) {

    result.push({
      title: "Nhịp tim thấp",
      description:
        "Theo dõi thêm nếu có chóng mặt.",
      icon: <FaHeartbeat />,
      bg: "yellow"
    });

  }
  else if (heartRate > 0) {

    result.push({
      title: "Nhịp tim bình thường",
      description:
        "Nhịp tim đang ổn định.",
      icon: <FaCheckCircle />,
      bg: "green"
    });

  }

  /* =========================
     WATER
  ========================= */

  if (water > 0 && water < 2) {

    result.push({
      title: "Thiếu nước",
      description:
        "Nên uống đủ 2 lít nước mỗi ngày.",
      icon: <FaGlassWhiskey />,
      bg: "blue"
    });

  }

  /* =========================
     EXERCISE
  ========================= */

  if (bmi >= 25 || glucose > 126) {

    result.push({
      title: "Đi bộ 30 phút",
      description:
        "Đi bộ giúp cải thiện tim mạch và glucose.",
      icon: <FaWalking />,
      bg: "green"
    });

  }

  /* =========================
     SLEEP
  ========================= */

  if (heartRate > 100 || systolic > 140) {

    result.push({
      title: "Nghỉ ngơi sớm",
      description:
        "Cơ thể đang có dấu hiệu căng thẳng.",
      icon: <FaBed />,
      bg: "purple"
    });

  }

  return result;
};

export default generateHealthAnalysis;