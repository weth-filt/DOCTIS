require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

mongoose.connect(process.env.MONGO_URI);

// =====================================================
// DỮ LIỆU MẪU
// =====================================================

const LAST_NAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan",
  "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương",
];

const MIDDLE_NAMES = [
  "Văn", "Thị", "Hữu", "Đức", "Minh", "Quang", "Thanh", "Ngọc",
];

const FIRST_NAMES = [
  "An", "Bình", "Chi", "Dũng", "Em", "Giang", "Hải", "Hoa",
  "Khang", "Linh", "Minh", "Nam", "Oanh", "Phúc", "Quân", "Sơn",
  "Thảo", "Trang", "Uyên", "Vy", "Xuân", "Yến", "Anh", "Bảo",
  "Châu", "Duy", "Hằng", "Kiên", "Long", "My", "Nga", "Phong",
  "Quỳnh", "Tâm", "Thành", "Tuấn", "Vân", "Việt", "Hùng", "Lan",
  "Mai", "Ngân", "Phương", "Quang", "Sang", "Tú", "Trâm", "Vinh",
  "Yên", "Đông",
];

const PROVINCES = [
  { province: "Đà Nẵng", district: "Hải Châu", ward: "Thạch Thang" },
  { province: "Hà Nội", district: "Ba Đình", ward: "Điện Biên" },
  { province: "TP. Hồ Chí Minh", district: "Quận 1", ward: "Bến Nghé" },
  { province: "Huế", district: "Phú Nhuận", ward: "Phú Hội" },
  { province: "Hải Phòng", district: "Hồng Bàng", ward: "Minh Khai" },
];

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const CHRONIC_OPTIONS = [
  "Không có bệnh nền",
  "Tiểu đường",
  "Cao huyết áp",
  "Tim mạch",
  "Mỡ máu",
  "Gout",
  "Suy thận",
];

const ALLERGY_OPTIONS = [
  "Không có",
  "Hải sản có vỏ (tôm, cua, ghẹ...)",
  "Penicillin",
  "Đậu phộng",
  "Phấn hoa",
  "Sữa bò",
  "Trứng",
  "Aspirin",
];

const SPECIALTIES = [
  "Nội tổng quát",
  "Nội tiết - Đái tháo đường",
  "Tim mạch",
  "Thận - Tiết niệu",
  "Dinh dưỡng lâm sàng",
  "Nội tiêu hóa",
  "Lão khoa",
  "Y học gia đình",
  "Nội hô hấp",
  "Nội thần kinh",
];

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomFullName = () =>
  `${randomItem(LAST_NAMES)} ${randomItem(MIDDLE_NAMES)} ${randomItem(
    FIRST_NAMES
  )}`;

const randomPhone = () =>
  `09${Math.floor(10000000 + Math.random() * 89999999)}`;

const randomDateOfBirth = (minAge, maxAge) => {
  const year =
    new Date().getFullYear() -
    (minAge + Math.floor(Math.random() * (maxAge - minAge)));
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const randomChronicDiseases = () => {
  if (Math.random() < 0.35) return "Không có bệnh nền";
  const pool = CHRONIC_OPTIONS.filter((o) => o !== "Không có bệnh nền");
  const count = 1 + Math.floor(Math.random() * 2);
  const picked = [];
  while (picked.length < count) {
    const item = randomItem(pool);
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.join(", ");
};

const randomAllergies = () => {
  if (Math.random() < 0.5) return "Không có";
  const pool = ALLERGY_OPTIONS.filter((o) => o !== "Không có");
  const count = 1 + Math.floor(Math.random() * 2);
  const picked = [];
  while (picked.length < count) {
    const item = randomItem(pool);
    if (!picked.includes(item)) picked.push(item);
  }
  return picked.join(", ");
};

// =====================================================
// TẠO BÁC SĨ
// =====================================================
async function createDoctors(hash) {
  const doctors = [];

  for (let i = 1; i <= 10; i++) {
    const fullName = `BS. ${randomFullName()}`;
    const loc = randomItem(PROVINCES);

    doctors.push({
      cccd: `20${String(1000000000 + i).slice(0, 10)}`,
      username: `doctor${i}`,
      email: `doctor${i}@smarthealth.vn`,
      password: hash,
      role: "doctor",
      fullName,
      phone: randomPhone(),
      dateOfBirth: randomDateOfBirth(32, 58),
      gender: Math.random() < 0.5 ? "Nam" : "Nữ",
      address: `Số ${10 + i} đường Sức Khỏe`,
      province: loc.province,
      district: loc.district,
      ward: loc.ward,
      bloodType: randomItem(BLOOD_TYPES),
      specialty: SPECIALTIES[i - 1],
      isVerified: true,
    });
  }

  const inserted = await User.insertMany(doctors, { ordered: false });
  return inserted;
}

// =====================================================
// TẠO BỆNH NHÂN
// =====================================================
async function createPatients(hash, doctorIds) {
  const patients = [];

  for (let i = 1; i <= 50; i++) {
    const fullName = randomFullName();
    const loc = randomItem(PROVINCES);

    patients.push({
      cccd: `19${String(2000000000 + i).slice(0, 10)}`,
      username: `patient${i}`,
      email: `patient${i}@smarthealth.vn`,
      password: hash,
      role: "user",
      fullName,
      phone: randomPhone(),
      dateOfBirth: randomDateOfBirth(20, 75),
      gender: Math.random() < 0.5 ? "Nam" : "Nữ",
      fatherPhone: randomPhone(),
      motherPhone: randomPhone(),
      address: `Số ${100 + i} đường Nguyễn Văn Trỗi`,
      province: loc.province,
      district: loc.district,
      ward: loc.ward,
      bloodType: randomItem(BLOOD_TYPES),
      allergies: randomAllergies(),
      medicalHistory: Math.random() < 0.3 ? "Từng phẫu thuật ruột thừa." : "",
      chronicDiseases: randomChronicDiseases(),
      currentMedications: "",
      emergencyContactName: randomFullName(),
      emergencyContactPhone: randomPhone(),
      emergencyContactRelation: randomItem(["Bố", "Mẹ", "Vợ/Chồng", "Anh/Chị"]),
      isVerified: true,
      doctorId: doctorIds.length ? randomItem(doctorIds) : null,
    });
  }

  const inserted = await User.insertMany(patients, { ordered: false });
  return inserted;
}

// =====================================================
// CHẠY SEED
// =====================================================
async function run() {
  try {
    const existingDoctors = await User.countDocuments({ role: "doctor" });
    const existingPatients = await User.countDocuments({ role: "user" });

    if (existingDoctors > 0 || existingPatients > 0) {
      console.log(
        `Đã có sẵn ${existingDoctors} bác sĩ và ${existingPatients} bệnh nhân trong DB.`
      );
      console.log(
        "Nếu muốn seed lại từ đầu, hãy xóa dữ liệu user cũ trước khi chạy script này."
      );
      process.exit();
    }

    const hash = await bcrypt.hash("123456", 10);

    const doctors = await createDoctors(hash);
    console.log(`✅ Đã tạo ${doctors.length} bác sĩ.`);

    const doctorIds = doctors.map((d) => d._id);
    const patients = await createPatients(hash, doctorIds);
    console.log(`✅ Đã tạo ${patients.length} bệnh nhân.`);

    console.log("\nMật khẩu chung cho tất cả tài khoản mẫu: 123456");
    console.log("Ví dụ đăng nhập bác sĩ: doctor1@smarthealth.vn");
    console.log("Ví dụ đăng nhập bệnh nhân: patient1@smarthealth.vn");

    process.exit();
  } catch (err) {
    console.error("SEED ERROR =", err);
    process.exit(1);
  }
}

run();