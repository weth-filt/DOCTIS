// Narrow checks for reproduced conflicts, not a clinical accuracy classifier.
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase();
const CJK = /[\u3400-\u9fff]/u;
// Preserve accents: "tiệt trùng" is not "trứng", "chỉnh sửa" is not "sữa".
const ALLERGENS = [
  { name: "trứng", pattern: /(?<!\p{L})(?:trứng|trung|lòng trắng|long trang|lòng đỏ|long do|mayonnaise)(?!\p{L})/iu },
  { name: "sữa", pattern: /(?<!\p{L})(?:sữa(?!\s+(?:đậu|hạt|yến mạch))|sua(?!\s+(?:dau|hat|yen mach))|phô mai|pho mai|cheese)(?!\p{L})/iu },
  { name: "đậu phộng", pattern: /(?<!\p{L})(?:đậu phộng|dau phong|lạc|lac|peanut)(?!\p{L})/iu },
  { name: "đậu nành", pattern: /(?<!\p{L})(?:đậu nành|dau nanh|đậu tương|dau tuong|soy)(?!\p{L})/iu },
];
const clausesOf = value => String(value || "").split(/[.!?;,\n]|nhưng|tuy nhiên/iu).filter(Boolean);
const denies = before => /\b(?:khong|chua|ko)\b(?:\s+[a-z]+){0,5}\s*$/.test(normalize(before));
const avoidance = before => /\b(?:tranh|loai bo|han che|ngoai tru)\b(?:\s+[a-z]+){0,6}\s*$/.test(normalize(before)) || /đừng\b/iu.test(before);

function recordedAllergen(value, allergen) {
  return clausesOf(value).some(clause => {
    const match = clause.match(allergen.pattern);
    return match && !denies(clause.slice(0, match.index));
  });
}

function currentAllergen(message, allergen) {
  return clausesOf(message).some(clause => {
    const text = normalize(clause);
    const match = clause.match(allergen.pattern);
    return match && /\b(?:toi|minh|em)\b/.test(text) && /\bdi ung\b/.test(text)
      && !/\b(?:neu|gia su|me toi|bo toi|con toi)\b/.test(text) && !/\?|khong\s*$/.test(text)
      && !denies(clause.slice(0, match.index));
  });
}

function assessReply(reply, message, context, plan) {
  const issues = [];
  if (CJK.test(reply) && !CJK.test(message)) issues.push("Viết lại hoàn toàn bằng tiếng Việt; không xen tiếng Trung hoặc ngôn ngữ khác.");
  const clauses = clausesOf(reply);
  for (const clause of clauses) {
    const text = normalize(clause);
    if (/dai thao duong|type\s*2|loai 2|nhat ky duong huyet/.test(normalize(message)) && !/nuoc tieu|duong nieu/.test(normalize(message))
        && /duong trong nuoc tieu|duong nieu/.test(text) && !/\b(?:khong|tranh)\b/.test(text)) {
      issues.push("Câu hỏi về theo dõi hằng ngày cần hướng dẫn nhật ký glucose máu theo kế hoạch cá nhân, không tự thêm đo đường niệu hằng ngày vào yêu cầu của người dùng.");
    }
    if (plan.currentSymptoms && plan.topic === "bloodPressure" && /\b(?:an|uong|them|tang|giau)\b.{0,35}\b(?:muoi|natri)\b/.test(text)
        && !/\b(?:khong|tranh)\b/.test(text) && !/bac si|ke hoach dieu tri|duoc chi dinh/.test(text)) {
      issues.push("Không tự chỉ dẫn tăng muối/natri để xử trí huyết áp thấp khi chưa biết bệnh kèm và kế hoạch điều trị. Hỏi số đo, triệu chứng và hướng đến đánh giá y tế khi phù hợp.");
    }
    if (plan.currentSymptoms && plan.topic === "bloodPressure" && /khong (?:cai thien|do|het) sau\s+\d+\s*phut/.test(text)) {
      issues.push("Không tự đặt số phút phải chờ trước khi tìm trợ giúp cho huyết áp thấp kèm triệu chứng. Hướng dẫn tìm hỗ trợ khi kéo dài/nặng lên, và khẩn cấp với dấu hiệu nguy hiểm, không đặt hẹn giờ điều trị.");
    }
    if (/120\s*\/\s*80\s*(?:mmhg)?\s*(?:la|duoc coi la|cho thay|nghia la)\s*(?:muc )?(?:huyet ap )?thap\b/.test(text)) {
      issues.push("120/80 mmHg không phải huyết áp thấp. Không gán số đo cũ làm tình trạng hiện tại; làm rõ số vừa đo và triệu chứng.");
    }
    if (/\bmetformin\b/.test(normalize(reply)) && /\b(?:truoc (?:khi |bua )?an|luc doi)\b/.test(text)
        && !/\b(?:khong|tranh)\b.{0,35}\b(?:truoc|doi)\b/.test(text)) {
      issues.push("Theo MedlinePlus, metformin thường dùng cùng bữa ăn và theo đúng dạng thuốc/đơn. Không đặt quy tắc uống trước ăn hay lúc đói. Trả lời câu hỏi về thời điểm dùng dựa trên nguồn này, không dựa câu AI cũ.");
    }
    if (/\bmetformin\b/.test(normalize(reply)) && /neu (?:ban )?(?:khong chac|chua ro)[^.!?]{0,50}(?:hay|nen) uong/.test(normalize(reply))) {
      issues.push("Khi chưa rõ dạng thuốc/đơn, hướng dẫn kiểm tra đơn hoặc hỏi dược sĩ/bác sĩ. Không tự chọn giờ dùng hoặc một bữa cụ thể thay cho đơn chỉ vì người dùng không chắc.");
    }
    if (plan.topic === "bloodPressure" && /(?:tam truong|so duoi|duong thu hai)\s*(?:<|duoi)\s*90\b/.test(text)) {
      issues.push("Phân biệt hai thành phần: mốc tham khảo huyết áp thấp là tâm thu dưới 90 hoặc tâm trương dưới 60 mmHg; không nhầm 90 thành mốc tâm trương.");
    }
  }
  if (!plan.thirdParty && ["nutrition", "allergies"].includes(plan.topic)) {
    const knows = allergen => recordedAllergen(context?.profile?.allergies, allergen) || currentAllergen(message, allergen);
    if ((context?.profile?.allergies || /di ung/.test(normalize(message))) && /nau (?:chin|ky)[^.!?]{0,60}(?:giam|tranh|ngan)[^.!?]{0,20}di ung/.test(normalize(reply))
        && !/khong[^.!?]{0,45}nau|nau[^.!?]{0,30}khong/.test(normalize(reply))) {
      issues.push("Không khẳng định nấu chín/kỹ làm một thực phẩm gây dị ứng trở nên an toàn. Gợi ý tránh đúng dị nguyên đã biết và kiểm tra thành phần, không đưa mẹo nấu để phòng dị ứng.");
    }
    if (knows(ALLERGENS[0]) && !knows(ALLERGENS[1])
        && /\b(?:vi|do)\b[^.!?;\n]{0,35}di ung[^.!?;\n]{0,20}trung[^.!?;\n]{0,45}(?:tranh|khong (?:dung|an|uong))[^.!?;\n]{0,20}(?:sua|pho mai)/.test(normalize(reply))) {
      issues.push("Dị ứng trứng không đồng nghĩa dị ứng sữa/phô mai. Không dùng dị ứng trứng làm lý do bắt người dùng tránh sữa; không tự tạo thêm dị ứng.");
    }
    for (const allergen of ALLERGENS) {
      const known = knows(allergen);
      for (const clause of clauses) {
        const match = clause.match(allergen.pattern);
        if (!match) continue;
        const rawBefore = clause.slice(0, match.index);
        const before = normalize(rawBefore);
        const assertsAllergy = /\bdi ung(?: voi| ca| thuc pham| cac loai)*\s*$/.test(before);
        if (known) {
          const suggests = /\b(?:chon|them|an|uong|dung|su dung|goi y|uu tien|kem)\b/.test(before);
          const deniesAllergy = /\bkhong (?:co )?di ung(?: voi)?\s*$/.test(before);
          if (deniesAllergy || suggests && !denies(rawBefore) && !avoidance(rawBefore)) {
            issues.push(`Người dùng có dị ứng ${allergen.name} đã lưu hoặc vừa báo. Không phủ nhận dị ứng này hoặc gợi ý ăn/uống thực phẩm chứa dị nguyên. Dị ứng trứng gồm cả lòng trắng và lòng đỏ; chọn món không chứa dị nguyên đã biết.`);
          }
        } else if (assertsAllergy && /\b(?:ban|cua ban|ho so)\b/.test(before) && !denies(rawBefore) && !/\b(?:neu|co the)\b/.test(before)) {
          issues.push(`Không tự gán dị ứng ${allergen.name} khi hồ sơ và lời người dùng chưa cung cấp dị ứng này. Các nhóm dị nguyên khác nhau không đồng nghĩa với nhau.`);
        }
      }
    }
  }
  return [...new Set(issues)].slice(0, 3);
}

function clarifyMissingReading(reply, message, plan) {
  const asksReading = /huyet ap.{0,60}(?:bao nhieu|may)|so (?:do|tren).{0,40}(?:bao nhieu|so duoi)|(?:cho biet|cung cap).{0,40}(?:huyet ap|so do)/.test(normalize(reply));
  // Ask for the missing fact; this never supplies a measurement or diagnosis.
  const suppliedReading = /\b\d{2,3}\s*[/–-]\s*\d{2,3}\b|\b\d{2,3}\s*mmhg\b/i.test(message);
  return plan.currentSymptoms && plan.topic === "bloodPressure" && !suppliedReading && !asksReading
    ? `${reply}\n\nBạn vừa đo được bao nhiêu mmHg (số trên/số dưới), vào lúc nào?`
    : reply;
}

module.exports = { assessReply, clarifyMissingReading };
