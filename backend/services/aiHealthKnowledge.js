// Curated educational notes, verified against the primary sources below on
// 2026-10-18. No runtime retrieval, patient lookup or external provider call.
// These notes are grounding material for the model, not ready-made replies.
const HEALTH_KNOWLEDGE_SOURCES = Object.freeze({
  diabetes: "https://www.niddk.nih.gov/health-information/diabetes/overview",
  glucose: "https://www.niddk.nih.gov/health-information/diabetes/overview/managing-diabetes",
  hypoglycemia: "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia",
  bloodPressure: "https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/low-blood-pressure-when-blood-pressure-is-too-low",
  nutrition: "https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes",
  activity: "https://www.niddk.nih.gov/health-information/diabetes/overview/healthy-living-with-diabetes",
  medication: "https://www.niddk.nih.gov/health-information/diabetes/overview/insulin-medicines-treatments",
  metformin: "https://medlineplus.gov/druginfo/meds/a696005.html",
  foodAllergy: "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know",
  complications: "https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems",
});

const NOTES = Object.freeze({
  diabetes: "NIDDK: đái tháo đường loại 2 liên quan việc cơ thể dùng insulin kém hiệu quả và có thể không tạo đủ insulin, khiến glucose máu tăng. Theo dõi theo kế hoạch cá nhân: ghi số đo glucose máu, đơn vị, giờ đo và liên quan bữa ăn, triệu chứng; lưu ý ăn uống, vận động và dùng thuốc đúng đơn. Nhật ký giúp trao đổi trong buổi khám. Mục tiêu, thời điểm và tần suất đo được thống nhất với nhân viên y tế cho từng người; lịch đo không giống nhau ở mọi người. Vận động thường bắt đầu nhẹ và tăng dần theo khả năng.",
  bloodPressure: "AHA: huyết áp thấp thường được mô tả là dưới 90/60 mmHg; 120/80 mmHg không phải huyết áp thấp. Một số đo đơn lẻ không xác định nguyên nhân hoặc mức nguy hiểm; cần xét triệu chứng và thời điểm. Chóng mặt, buồn nôn, ngất cần được nhân viên y tế đánh giá. Phân biệt số vừa được người dùng báo với bản ghi cũ. Huyết áp thấp không đồng nghĩa hạ đường huyết; không suy ra cần ăn đường, tăng muối hoặc đổi thuốc chỉ từ lời tự báo.",
  glucose: "NIDDK: mục tiêu thường dùng cho nhiều người mắc đái tháo đường là 80–130 mg/dL trước ăn và dưới 180 mg/dL khoảng 2 giờ sau khi bắt đầu ăn; mục tiêu cá nhân có thể khác. Không phân loại chắc chắn khi chưa biết đơn vị và thời điểm trước/sau ăn. DOCTIS chưa lưu thời điểm liên quan bữa ăn. Bản ghi cũ không cho biết tình trạng hiện tại; tách dữ kiện đã lưu khỏi nhận định. Không dùng các mốc tham khảo để chẩn đoán hoặc tự chỉnh thuốc.",
  hypoglycemia: "NIDDK: đường huyết dưới 70 mg/dL thường là thấp. Chỉ liên hệ cách xử trí với tình trạng hiện tại phù hợp, không với một bản ghi cũ hoặc huyết áp thấp. Khi người bệnh còn tỉnh và nuốt an toàn, hướng dẫn phổ biến là 15–20 g glucose/carbohydrate tác dụng nhanh, đo lại sau 15 phút; nếu còn thấp, lặp lại và làm theo kế hoạch cá nhân. Người bất tỉnh, co giật hoặc không nuốt được cần trợ giúp y tế khẩn cấp; không cho ăn/uống qua miệng. Không tự thay liều thuốc.",
  nutrition: "NIDDK: một cách chia đĩa tham khảo là nửa đĩa rau ít tinh bột, một phần tư thực phẩm carbohydrate giàu chất xơ, một phần tư đạm. Khi gợi ý bữa tối, đưa một ví dụ đủ rau, đạm và phần tinh bột phù hợp; không chỉ gợi ý một món chiên hoặc chỉ rau. Ưu tiên nước không thêm đường; không cần cấm mọi tinh bột. Lượng và giờ ăn tùy thuốc, vận động và bệnh kèm. Tôn trọng dị ứng thực phẩm thực sự được cung cấp; không tự thêm dị ứng.",
  foodAllergy: "FDA phân biệt sữa, trứng, đậu nành là các nhóm dị nguyên riêng. Dị ứng trứng KHÔNG đủ cơ sở để kết luận dị ứng sữa, phô mai hoặc đậu nành. Chỉ tránh dị nguyên đã được cung cấp và thực phẩm thực sự chứa chúng; đọc nhãn thành phần để xác định, không đoán thành phần từ tên món. Khi gợi ý bữa ăn, chọn món ít thành phần dễ kiểm tra; không gợi ý sốt pha sẵn chưa biết thành phần. Không bịa thêm nhóm dị ứng hoặc bảo kiêng toàn bộ sữa khi chỉ biết dị ứng trứng.",
  activity: "NIDDK: vận động hỗ trợ kiểm soát đường huyết. Người mới bắt đầu chậm, với đoạn đi bộ ngắn, tăng dần theo khả năng; không áp lịch nhiều lần mỗi ngày. Mốc chung cho đa số người lớn là 150 phút mức vừa mỗi tuần, KHÔNG phải cường độ cao và không phải chỉ định cho mọi người. Insulin và một số thuốc hạ đường huyết có thể làm đường huyết xuống thấp khi tập. Theo dõi theo kế hoạch điều trị; KHÔNG hướng dẫn người hỏi tự chỉnh insulin/thuốc. Trao đổi với nhân viên y tế để có lịch phù hợp.",
  medication: "NIDDK: thuốc đái tháo đường có cơ chế và tác dụng phụ khác nhau; lựa chọn phụ thuộc bệnh kèm và tình trạng cá nhân. Giải thích công dụng được hỏi, nhưng không kê thuốc, bắt đầu/ngừng hoặc thay liều. Cần đúng tên thuốc, dạng bào chế và hướng dẫn kê đơn trước khi bàn giờ dùng, quên liều hay tương tác. Một số thuốc có thể gây hạ đường huyết. Không coi mọi người dùng cùng một thuốc hoặc cùng liều.",
  metformin: "NIDDK/MedlinePlus: metformin giúp gan tạo ít glucose hơn và giúp cơ thể sử dụng insulin tốt hơn. Thuốc thường dùng cùng bữa ăn. Dạng thuốc và đơn quyết định lịch dùng cụ thể; người bệnh dùng đúng hướng dẫn trên đơn và hỏi bác sĩ/dược sĩ nếu chưa rõ. Các tác dụng phụ thường gặp gồm khó chịu ở bụng, tiêu chảy, buồn nôn. Việc thay đổi liều cần nhân viên y tế đánh giá, không dựa vào một số đo đường huyết đơn lẻ. Tư liệu này giải thích công dụng chung, không xác định người đang hỏi cần dùng thuốc hay dùng liều nào.",
  complications: "NIDDK: đái tháo đường có thể ảnh hưởng mạch máu, tim, mắt, thận, thần kinh và bàn chân. Kiểm soát đường huyết, huyết áp, cholesterol và không hút thuốc giúp giảm nguy cơ. Trao đổi về kiểm tra mắt, thận, bàn chân và chăm sóc răng miệng trong các buổi khám. Nguy cơ không có nghĩa người đang hỏi đã mắc biến chứng; một số đo hay triệu chứng đơn lẻ không đủ kết luận.",
});

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();
}

function explicitTopic(text) {
  // Keep low blood pressure distinct from low glucose. In particular, do not
  // attach carbohydrate treatment notes to a self-reported hypotension query.
  if (/ha huyet ap|tut huyet ap|huyet ap (?:bi )?thap|hypotension/.test(text)) return "bloodPressure";
  if (/ha duong huyet|tut duong huyet|duong (?:huyet|mau) (?:bi )?thap|hypoglyc/.test(text)) return "hypoglycemia";
  if (/\bmetformin\b/.test(text)) return "metformin";
  if (/\bthuoc\b|\binsulin\b|tac dung phu|quen lieu|tang lieu|giam lieu|doi lieu|ngung lieu|ngung thuoc/.test(text)) return "medication";
  if (/bua (?:an|sang|trua|toi)|thuc don|che do an|dinh duong|an uong|tinh bot|\bcarb\b|\bcom\b|\brau\b|do uong/.test(text)) return "nutrition";
  if (/van dong|the duc|di bo|tap luyen|tap nhe|chay bo|boi loi|\bexercise\b/.test(text)) return "activity";
  if (/bien chung|benh than|suy than|vo ng mac|than kinh|ban chan|loet chan|dot quy/.test(text)) return "complications";
  if (/huyet ap|\bmmhg\b|\bblood pressure\b/.test(text)) return "bloodPressure";
  if (/duong huyet|duong mau|\bglucose\b|\bhba1c\b|\bmg\/dl\b|\bmmol\/l\b/.test(text)) return "glucose";
  if (/dai thao duong|tieu duong|type\s*2|loai 2/.test(text)) return "diabetes";
  return "";
}

function isFactLookup(text) {
  const savedFact = /gan nhat|moi nhat|cao nhat|thap nhat|da luu|da ghi|ho so|ngay do|lan do/.test(text);
  const asksForFact = /bao nhieu|la may|ngay nao|khi nao|luc nao|chi so|gia tri/.test(text);
  const asksForInterpretation = /co (?:cao|thap|on|sao)|nguy hiem|nen lam|xu tri|giai thich|y nghia|muc tieu|so sanh voi/.test(text);
  return savedFact && asksForFact && !asksForInterpretation;
}

/** One compact topic note, or no note for social/record/unrelated requests. */
function healthKnowledgeFor(message, topic, {hasSavedAllergy=false} = {}) {
  const text = normalize(message);
  if (!text || /^(?:xin chao|chao(?: ban|bac si|doctis)?|hello|hi|alo|cam on(?: ban)?)[!,.?\s]*$/.test(text)) return "";
  if (topic?.kind === "records" || isFactLookup(text)) return "";
  const current = explicitTopic(text);
  const hint = normalize(typeof topic === "string" ? topic : topic?.topic).replace(/[\s_-]/g, "");
  const aliases = {
    bloodpressure: "bloodPressure", hypotension: "bloodPressure",
    glucose: "glucose", hypoglycemia: "hypoglycemia",
    nutrition: "nutrition", diet: "nutrition", activity: "activity", exercise: "activity",
    medication: "medication", medicine: "medication", metformin: "metformin",
    complications: "complications",
  };
  const asksForFood = /goi y.{0,35}(?:bua|an)|an gi|thuc don|dinh duong|che do an/.test(text);
  const selected = asksForFood ? "nutrition" : current || (Object.prototype.hasOwnProperty.call(aliases, hint) ? aliases[hint] : "");
  return Object.prototype.hasOwnProperty.call(NOTES, selected)
    ? `Kiến thức tham khảo theo chủ đề; không phải kết luận về người đang hỏi. ${NOTES[selected]}${selected === "nutrition" && (hasSavedAllergy || /di ung/.test(text)) ? `\n${NOTES.foodAllergy}` : ""}${selected === "nutrition" && /\bmetformin\b/.test(text) ? `\n${NOTES.metformin}` : ""}`
    : "";
}

module.exports = { healthKnowledgeFor, HEALTH_KNOWLEDGE_SOURCES };
