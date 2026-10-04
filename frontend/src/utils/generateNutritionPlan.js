const DAYS = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "Chủ nhật",
];

/* =========================================================
   THỰC ĐƠN CHO NGƯỜI CÓ GLUCOSE CAO / NGUY CƠ TIỂU ĐƯỜNG
   ========================================================= */

const GLUCOSE_MEALS = [
  {
    breakfast:
      "1 quả trứng luộc + 1 lát bánh mì nguyên cám + rau xanh + nước lọc",
    lunch:
      "Cơm gạo lứt khẩu phần vừa phải + cá hấp + bông cải xanh + canh rau",
    dinner:
      "Ức gà áp chảo ít dầu + salad rau củ + một phần nhỏ khoai lang",
  },
  {
    breakfast:
      "Yến mạch không đường + hạt chia + một ít hạt óc chó",
    lunch:
      "Cá hồi áp chảo ít dầu + rau xanh + nửa chén cơm gạo lứt",
    dinner:
      "Đậu hũ hấp + rau củ luộc + một phần nhỏ khoai lang",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + trứng ốp la + dưa leo + nước lọc",
    lunch:
      "Ức gà nướng + salad rau củ + một phần nhỏ cơm gạo lứt",
    dinner:
      "Cá hấp + canh rau + rau luộc",
  },
  {
    breakfast:
      "Sữa chua không đường + hạt chia + một ít óc chó",
    lunch:
      "Thịt nạc luộc + cơm gạo lứt + rau xanh + canh rau",
    dinner:
      "Đậu hũ hấp + bông cải xanh + salad",
  },
  {
    breakfast:
      "Trứng luộc + bánh mì nguyên cám + rau xanh",
    lunch:
      "Cá thu hấp/kho nhạt + rau luộc + cơm gạo lứt",
    dinner:
      "Salad ức gà + rau củ hấp",
  },
  {
    breakfast:
      "Yến mạch không đường + hạt chia + sữa không đường",
    lunch:
      "Ức gà + rau xào ít dầu + một phần nhỏ cơm gạo lứt",
    dinner:
      "Đậu hũ + canh rau củ + salad",
  },
  {
    breakfast:
      "Trứng ốp la + rau xanh + 1 lát bánh mì nguyên cám",
    lunch:
      "Cá hấp + rau củ luộc + một phần nhỏ cơm gạo lứt",
    dinner:
      "Ức gà nướng + salad rau củ",
  },
];

/* =========================================================
   THỰC ĐƠN CHO NGƯỜI THỪA CÂN / BÉO PHÌ
   ========================================================= */

const BMI_MEALS = [
  {
    breakfast:
      "1 quả trứng luộc + dưa leo + 1 lát bánh mì nguyên cám",
    lunch:
      "Ức gà nướng + salad rau củ + một phần nhỏ cơm gạo lứt",
    dinner:
      "Đậu hũ hấp + rau củ luộc + canh rau",
  },
  {
    breakfast:
      "Sữa chua không đường + hạt chia + một ít óc chó",
    lunch:
      "Cá hấp + rau luộc + một phần nhỏ khoai lang",
    dinner:
      "Salad ức gà + rau xanh",
  },
  {
    breakfast:
      "Trứng luộc + dưa leo + rau xanh",
    lunch:
      "Thịt nạc luộc + nửa chén cơm gạo lứt + nhiều rau",
    dinner:
      "Rau củ hấp + đậu hũ",
  },
  {
    breakfast:
      "Yến mạch không đường + hạt chia",
    lunch:
      "Ức gà nướng + bông cải xanh + salad",
    dinner:
      "Canh rau + đậu hũ hấp",
  },
  {
    breakfast:
      "Sữa chua không đường + một phần trái cây ít ngọt",
    lunch:
      "Cá hồi + salad rau củ + một phần nhỏ cơm gạo lứt",
    dinner:
      "Súp rau củ + trứng luộc",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + trứng luộc + rau xanh",
    lunch:
      "Ức gà + rau xào ít dầu + nửa chén cơm",
    dinner:
      "Đậu hũ hấp + rau luộc",
  },
  {
    breakfast:
      "Yến mạch + hạt chia + sữa không đường",
    lunch:
      "Cá hấp + rau củ + một phần nhỏ cơm gạo lứt",
    dinner:
      "Salad rau củ + ức gà",
  },
];

/* =========================================================
   THỰC ĐƠN CHO NGƯỜI HUYẾT ÁP CAO
   ========================================================= */

const BP_MEALS = [
  {
    breakfast:
      "Yến mạch không đường + chuối + hạt chia",
    lunch:
      "Cá hấp không thêm nhiều muối + rau luộc + cơm gạo lứt",
    dinner:
      "Canh rau củ nhạt + đậu hũ hấp",
  },
  {
    breakfast:
      "Trứng luộc + rau xanh + 1 lát bánh mì nguyên cám",
    lunch:
      "Ức gà hấp + salad rau củ, hạn chế muối",
    dinner:
      "Đậu hũ hấp + rau luộc",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + bơ đậu phộng không đường",
    lunch:
      "Cá hấp + rau củ + cơm gạo lứt",
    dinner:
      "Súp bí đỏ ít muối + rau xanh",
  },
  {
    breakfast:
      "Sữa chua không đường + yến mạch",
    lunch:
      "Thịt nạc luộc + cơm gạo lứt + rau luộc",
    dinner:
      "Rau củ hấp + đậu hũ",
  },
  {
    breakfast:
      "Trái cây ít ngọt + một ít hạt không muối",
    lunch:
      "Ức gà + rau xào ít dầu và ít muối",
    dinner:
      "Canh rau củ nhạt + cá hấp",
  },
  {
    breakfast:
      "Yến mạch + hạt chia + sữa không đường",
    lunch:
      "Cá hấp + salad rau củ không thêm nhiều muối",
    dinner:
      "Đậu hũ + rau luộc",
  },
  {
    breakfast:
      "Trứng luộc + rau xanh + bánh mì nguyên cám",
    lunch:
      "Cơm gạo lứt + cá hấp + rau luộc",
    dinner:
      "Súp rau củ nhạt + đậu hũ",
  },
];

/* =========================================================
   THỰC ĐƠN CHO NGƯỜI CÓ THỂ TRẠNG BÌNH THƯỜNG
   ========================================================= */

const NORMAL_MEALS = [
  {
    breakfast:
      "1 quả trứng luộc + 1 lát bánh mì nguyên cám + rau xanh",
    lunch:
      "Cơm gạo lứt + cá hấp + rau luộc + canh rau",
    dinner:
      "Ức gà + salad rau củ + một phần tinh bột phù hợp",
  },
  {
    breakfast:
      "Sữa không đường + ngũ cốc nguyên hạt + một ít hạt",
    lunch:
      "Thịt bò xào rau ít dầu + cơm + rau xanh",
    dinner:
      "Canh rau + cá hấp + rau củ",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + trứng ốp la + rau xanh",
    lunch:
      "Cơm + thịt gà + rau luộc",
    dinner:
      "Súp rau củ + đậu hũ",
  },
  {
    breakfast:
      "Yến mạch + trái cây + hạt chia",
    lunch:
      "Cơm + cá hấp + rau xanh",
    dinner:
      "Salad + ức gà",
  },
  {
    breakfast:
      "Bánh cuốn + rau thơm + trứng",
    lunch:
      "Cơm + thịt nạc luộc + rau",
    dinner:
      "Canh rau + cá hấp",
  },
  {
    breakfast:
      "Phở gà với khẩu phần bánh phở vừa phải",
    lunch:
      "Cơm + đậu hũ sốt cà + rau luộc",
    dinner:
      "Salad rau củ + trứng",
  },
  {
    breakfast:
      "Trứng ốp la + rau xanh + bánh mì nguyên cám",
    lunch:
      "Cơm + cá hấp + canh rau",
    dinner:
      "Ức gà nướng + rau củ",
  },
];

/* =========================================================
   THỰC ĐƠN CHO NGƯỜI THIẾU CÂN
   ========================================================= */

const UNDERWEIGHT_MEALS = [
  {
    breakfast:
      "Yến mạch + sữa không đường + trứng luộc + chuối",
    lunch:
      "Cơm gạo lứt + cá hấp + rau + đậu hũ",
    dinner:
      "Ức gà + khoai lang + salad rau củ",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + trứng + sữa không đường",
    lunch:
      "Cơm + thịt nạc + rau xanh + canh",
    dinner:
      "Cá hấp + khoai lang + rau củ",
  },
  {
    breakfast:
      "Yến mạch + sữa chua không đường + hạt",
    lunch:
      "Cơm + ức gà + rau + đậu hũ",
    dinner:
      "Cá hấp + cơm + salad",
  },
  {
    breakfast:
      "Trứng + bánh mì nguyên cám + sữa không đường",
    lunch:
      "Cơm + cá + rau luộc + canh",
    dinner:
      "Ức gà + khoai lang + rau củ",
  },
  {
    breakfast:
      "Sữa chua + yến mạch + trái cây + hạt",
    lunch:
      "Cơm + thịt nạc + rau xanh",
    dinner:
      "Cá hấp + cơm + salad",
  },
  {
    breakfast:
      "Bánh mì nguyên cám + trứng + bơ đậu phộng không đường",
    lunch:
      "Cơm + gà + rau + canh",
    dinner:
      "Đậu hũ + cá + rau củ",
  },
  {
    breakfast:
      "Yến mạch + sữa + trứng + trái cây",
    lunch:
      "Cơm + cá hấp + rau xanh",
    dinner:
      "Ức gà + khoai lang + salad",
  },
];

// HÀM CHUẨN HÓA CHUỖI

const normalizeText = (value) => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// LOẠI BỎ MÓN CÓ THỂ LIÊN QUAN DỊ ỨNG

const removeAllergyFoods = (meal, profile) => {
  const allergyText = normalizeText(
    profile?.allergies || profile?.allergy || ""
  );

  let result = { ...meal };

  // Hải sản
  if (
    allergyText.includes("hai san") ||
    allergyText.includes("tom") ||
    allergyText.includes("cua") ||
    allergyText.includes("ca")
  ) {
    result = {
      breakfast: result.breakfast
        .replace(/cá hồi/gi, "ức gà")
        .replace(/cá hấp/gi, "ức gà hấp"),
      lunch: result.lunch
        .replace(/cá hồi/gi, "ức gà")
        .replace(/cá thu/gi, "thịt nạc")
        .replace(/cá hấp/gi, "ức gà hấp")
        .replace(/tôm hấp/gi, "đậu hũ hấp"),
      dinner: result.dinner
        .replace(/cá hấp/gi, "ức gà hấp")
        .replace(/cá/gi, "đậu hũ"),
    };
  }

  // Trứng
  if (allergyText.includes("trung")) {
    result = {
      breakfast: result.breakfast
        .replace(/1 quả trứng luộc/gi, "đậu hũ hấp")
        .replace(/trứng luộc/gi, "đậu hũ hấp")
        .replace(/trứng ốp la/gi, "đậu hũ hấp")
        .replace(/trứng/gi, "đậu hũ"),
      lunch: result.lunch.replace(/trứng/gi, "đậu hũ"),
      dinner: result.dinner.replace(/trứng/gi, "đậu hũ"),
    };
  }

  // Sữa
  if (
    allergyText.includes("sua") ||
    allergyText.includes("lactose")
  ) {
    result = {
      breakfast: result.breakfast
        .replace(/sữa không đường/gi, "nước lọc")
        .replace(/sữa chua không đường/gi, "trái cây ít ngọt")
        .replace(/sữa chua/gi, "trái cây ít ngọt")
        .replace(/sữa/gi, "nước lọc"),
      lunch: result.lunch,
      dinner: result.dinner,
    };
  }

  return result;
};

// ĐIỀU CHỈNH THỰC ĐƠN THEO HUYẾT ÁP

const adjustForBloodPressure = (meal, highBP) => {
  if (!highBP) return meal;

  return {
    breakfast: `${meal.breakfast} (hạn chế muối)`,
    lunch: `${meal.lunch} (ưu tiên chế biến nhạt)`,
    dinner: `${meal.dinner} (hạn chế muối)`,
  };
};

// ĐIỀU CHỈNH THEO BỆNH NỀN

const adjustForChronicDisease = (meal, profile) => {
  const chronic = normalizeText(
    profile?.chronicDiseases ||
      profile?.medicalHistory ||
      ""
  );

  let adjusted = { ...meal };

  // Tiểu đường
  if (
    chronic.includes("tieu duong") ||
    chronic.includes("tien tieu duong")
  ) {
    adjusted = {
      breakfast: `${adjusted.breakfast} (hạn chế đường)`,
      lunch: `${adjusted.lunch} (hạn chế tinh bột nhanh)`,
      dinner: `${adjusted.dinner} (hạn chế đường)`,
    };
  }

  // Tăng huyết áp
  if (
    chronic.includes("tang huyet ap") ||
    chronic.includes("cao huyet ap")
  ) {
    adjusted = {
      breakfast: `${adjusted.breakfast} (ít muối)`,
      lunch: `${adjusted.lunch} (ít muối)`,
      dinner: `${adjusted.dinner} (ít muối)`,
    };
  }

  return adjusted;
};

// Hàm chính 

export default function generateNutritionPlan({
  latest = {},
  profile = {},
  diagnosis = [],
}) {
  const glucose = Number(latest?.glucose || 0);
  const bmi = Number(latest?.bmi || 0);
  const systolic = Number(latest?.systolic || 0);
  const diastolic = Number(latest?.diastolic || 0);
  const heartRate = Number(latest?.heartRate || 0);

  const flags = [];
  const severity = [];

// 1. GLUCOSE - Khớp với generateHealthAnalysis

  let glucoseLevel = "normal";

  if (glucose >= 180) {
    glucoseLevel = "veryHigh";
    flags.push("glucoseVeryHigh");
    severity.push("Đường huyết rất cao");
  } else if (glucose > 126) {
    glucoseLevel = "high";
    flags.push("glucoseHigh");
    severity.push("Đường huyết cao");
  } else if (glucose < 70 && glucose > 0) {
    glucoseLevel = "low";
    flags.push("glucoseLow");
    severity.push("Đường huyết thấp");
  }

  /* =====================================================
     2. BMI
     Khớp với generateHealthAnalysis
     ===================================================== */

  let bmiLevel = "normal";

  if (bmi >= 30) {
    bmiLevel = "obesity";
    flags.push("obesity");
    severity.push("Béo phì");
  } else if (bmi >= 25) {
    bmiLevel = "overweight";
    flags.push("overweight");
    severity.push("Thừa cân");
  } else if (bmi < 18.5 && bmi > 0) {
    bmiLevel = "underweight";
    flags.push("underweight");
    severity.push("Thiếu cân");
  }

  /* =====================================================
     3. HUYẾT ÁP
     Khớp với generateHealthAnalysis
     ===================================================== */

  let bpLevel = "normal";

  if (systolic >= 160 || diastolic >= 100) {
    bpLevel = "dangerous";
    flags.push("bpDangerous");
    severity.push("Huyết áp nguy hiểm");
  } else if (systolic >= 140 || diastolic >= 90) {
    bpLevel = "high";
    flags.push("bpHigh");
    severity.push("Huyết áp cao");
  }

  /* =====================================================
     4. NHỊP TIM
     ===================================================== */

  let heartLevel = "normal";

  if (heartRate > 120) {
    heartLevel = "veryHigh";
    flags.push("heartVeryHigh");
    severity.push("Nhịp tim rất cao");
  } else if (heartRate > 100) {
    heartLevel = "high";
    flags.push("heartHigh");
    severity.push("Nhịp tim cao");
  } else if (heartRate < 60 && heartRate > 0) {
    heartLevel = "low";
    flags.push("heartLow");
    severity.push("Nhịp tim thấp");
  }

  /* =====================================================
     5. BỆNH NỀN
     ===================================================== */

  const chronic = normalizeText(
    profile?.chronicDiseases ||
      profile?.medicalHistory ||
      ""
  );

  const hasDiabetes =
    chronic.includes("tieu duong") ||
    chronic.includes("tien tieu duong");

  const hasHypertension =
    chronic.includes("tang huyet ap") ||
    chronic.includes("cao huyet ap");

  if (hasDiabetes) {
    flags.push("diabetes");
  }

  if (hasHypertension) {
    flags.push("hypertension");
  }

  /* =====================================================
     6. CHỌN NỀN THỰC ĐƠN
     Ưu tiên theo tình trạng quan trọng nhất
     ===================================================== */

  let mealSet = NORMAL_MEALS;

  /*
   * Nếu glucose rất cao hoặc có tiểu đường
   * → ưu tiên thực đơn kiểm soát đường huyết.
   */

  if (
    glucoseLevel === "veryHigh" ||
    glucoseLevel === "high" ||
    hasDiabetes
  ) {
    mealSet = GLUCOSE_MEALS;
  }

  /*
   * Nếu glucose bình thường nhưng BMI cao
   * → thực đơn kiểm soát cân nặng.
   */

  else if (
    bmiLevel === "obesity" ||
    bmiLevel === "overweight"
  ) {
    mealSet = BMI_MEALS;
  }

  /*
   * Nếu BMI bình thường nhưng huyết áp cao
   * → thực đơn ít muối.
   */

  else if (
    bpLevel === "dangerous" ||
    bpLevel === "high" ||
    hasHypertension
  ) {
    mealSet = BP_MEALS;
  }

  /*
   * Nếu thiếu cân
   * → tăng năng lượng nhưng vẫn ưu tiên thực phẩm lành mạnh.
   */

  else if (bmiLevel === "underweight") {
    mealSet = UNDERWEIGHT_MEALS;
  }

  /* =====================================================
     7. ĐIỀU CHỈNH THỰC ĐƠN CHO TỪNG NGÀY
     ===================================================== */

  const days = DAYS.map((label, index) => {
    let meal = {
      ...mealSet[index % mealSet.length],
    };

    /*
     * Huyết áp cao:
     * giảm muối cho toàn bộ bữa ăn.
     */
    if (
      bpLevel === "dangerous" ||
      bpLevel === "high" ||
      hasHypertension
    ) {
      meal = adjustForBloodPressure(meal, true);
    }

    /*
     * Bệnh nền.
     */
    meal = adjustForChronicDisease(meal, profile);

    /*
     * Dị ứng.
     */
    meal = removeAllergyFoods(meal, profile);

    return {
      label,
      ...meal,

      // Trạng thái theo dõi bữa ăn
      breakfastDone: false,
      lunchDone: false,
      dinnerDone: false,
    };
  });

  /* =====================================================
     8. TẠO MÔ TẢ TỔNG HỢP
     ===================================================== */

  const notes = [];

  if (glucoseLevel === "veryHigh") {
    notes.push(
      "Đường huyết đang rất cao, thực đơn ưu tiên kiểm soát lượng đường và tinh bột nhanh."
    );
  } else if (glucoseLevel === "high") {
    notes.push(
      "Đường huyết đang cao, thực đơn hạn chế đường và ưu tiên tinh bột hấp thu chậm."
    );
  } else if (glucoseLevel === "low") {
    notes.push(
      "Đường huyết đang thấp. Cần theo dõi thêm và không nên tự ý nhịn ăn."
    );
  }

  if (bmiLevel === "obesity") {
    notes.push(
      "BMI thuộc nhóm béo phì, thực đơn ưu tiên rau xanh, đạm nạc và kiểm soát khẩu phần."
    );
  } else if (bmiLevel === "overweight") {
    notes.push(
      "BMI thuộc nhóm thừa cân, thực đơn được điều chỉnh theo hướng kiểm soát năng lượng."
    );
  } else if (bmiLevel === "underweight") {
    notes.push(
      "BMI thấp, thực đơn ưu tiên bổ sung dinh dưỡng đầy đủ với thực phẩm lành mạnh."
    );
  }

  if (bpLevel === "dangerous") {
    notes.push(
      "Huyết áp đang ở mức cao, thực đơn ưu tiên chế biến nhạt và hạn chế thực phẩm nhiều muối."
    );
  } else if (bpLevel === "high") {
    notes.push(
      "Huyết áp cao, thực đơn ưu tiên giảm muối và tăng rau xanh."
    );
  }

  if (heartLevel === "veryHigh") {
    notes.push(
      "Nhịp tim đang cao, nên ưu tiên nghỉ ngơi và theo dõi sức khỏe."
    );
  } else if (heartLevel === "high") {
    notes.push(
      "Nhịp tim cao, nên hạn chế chất kích thích và theo dõi thêm."
    );
  }

  if (hasDiabetes) {
    notes.push(
      "Hồ sơ có tiền sử tiểu đường, thực đơn được điều chỉnh theo hướng kiểm soát đường huyết."
    );
  }

  if (hasHypertension) {
    notes.push(
      "Hồ sơ có tiền sử tăng huyết áp, thực đơn được điều chỉnh theo hướng hạn chế muối."
    );
  }

  if (notes.length === 0) {
    notes.push(
      "Các dữ liệu hiện tại tương đối ổn định. Thực đơn được xây dựng theo hướng cân bằng dinh dưỡng."
    );
  }

  /* =====================================================
     9. THÔNG TIN ĐẦU VÀO ĐỂ DASHBOARD HIỂN THỊ
     ===================================================== */

  return {
    flags,

    severity,

    levels: {
      glucose: glucoseLevel,
      bmi: bmiLevel,
      bloodPressure: bpLevel,
      heartRate: heartLevel,
    },

    summaryNote: notes.join(" "),

    source: {
      glucose,
      bmi,
      systolic,
      diastolic,
      heartRate,
    },

    diagnosis,

    days,

    generatedAt: new Date().toISOString(),
  };
}
