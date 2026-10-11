import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import generateHealthAnalysis from "../../utils/AIAnalysis";
import generateNutritionPlan from "../../utils/generateNutritionPlan";
import getRiskAssessment from "../../utils/riskAssessment";

import {
  FaHeartbeat,
  FaChartLine,
  FaRobot,
  FaSignOutAlt,
  FaPlusCircle,
  FaExclamationTriangle,
  FaTint,
  FaWeight,
  FaHeart,
  FaEnvelope,
  FaBell,
  FaCalendarCheck,
  FaShieldAlt,
  FaUserMd,
  FaClock,
  FaRulerVertical,
  FaUser,
  FaCamera,
  FaSearch,
  FaPaperPlane,
  FaPaperclip,
  FaFileAlt,
  FaImage,
  FaPhone,
  FaMapMarkerAlt,
  FaIdCard,
  FaNotesMedical,
  FaAddressBook,
  FaSave,
  FaTimes,
  FaCircle,
  FaUtensils,
  FaCheck,
  FaCheckDouble,
  FaBars,
  FaHome,
  FaUserCircle,
  FaChevronDown,
} from "react-icons/fa";

import { motion } from "framer-motion";
import API from "../../services/api";
import DashboardChart from "../../components/DashboardChart";
import "../../CSS/dashboard.css";
import "../../CSS/dashboard-modern.css";
import "../../CSS/health-clarity.css";

const EMPTY_FORM = {
  height: "",
  weight: "",
  glucose: "",
  bloodPressure: "",
  heartRate: "",
};

const normalizeDateForInput = (value) => {
  if (!value) return "";

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return value._id || value.id || "";
  }
  return value;
};

const safeUserFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
};

const CHRONIC_DISEASE_OPTIONS = [
  "Không có bệnh nền",
  "Tiểu đường",
  "Cao huyết áp",
  "Tim mạch",
  "Mỡ máu",
  "Gout",
  "Suy thận",
];

// Danh sách dị nguyên thường gặp, chia theo nhóm để bệnh nhân dễ chọn.
// Giá trị được lưu vẫn là chuỗi văn bản, nên tương thích với dữ liệu cũ.
const ALLERGY_OPTIONS = [
  {
    label: "Dị ứng thực phẩm",
    options: [
      "Sữa bò",
      "Trứng",
      "Đậu phộng",
      "Các loại hạt",
      "Đậu nành",
      "Lúa mì",
      "Mè / vừng",
      "Cá",
      "Hải sản có vỏ (tôm, cua, ghẹ...)"
    ],
  },
  {
    label: "Dị ứng thuốc",
    options: [
      "Penicillin",
      "Amoxicillin",
      "Cephalosporin",
      "Sulfonamide / Sulfa",
      "Aspirin",
      "Ibuprofen / NSAIDs",
      "Thuốc gây tê cục bộ",
      "Thuốc cản quang"
    ],
  },
  {
    label: "Dị ứng môi trường",
    options: [
      "Mạt bụi nhà",
      "Phấn hoa",
      "Nấm mốc",
      "Bụi nhà",
      "Gián"
    ],
  },
  {
    label: "Dị ứng động vật",
    options: [
      "Lông / biểu mô chó",
      "Lông / biểu mô mèo",
      "Động vật khác"
    ],
  },
  {
    label: "Dị ứng tiếp xúc",
    options: [
      "Latex / cao su tự nhiên",
      "Nickel",
      "Hương liệu / nước hoa",
      "Mỹ phẩm",
      "Thuốc nhuộm tóc"
    ],
  },
  {
    label: "Dị ứng côn trùng / nọc độc",
    options: [
      "Ong",
      "Ong bắp cày",
      "Kiến lửa"
    ],
  },
];

const isConfirmedPrescription = (rx) =>
  ["active", "confirmed", "approved", "chốt", "đã chốt"].includes(
    String(rx?.status || "").toLowerCase()
  ) || rx?.confirmed === true || rx?.isActive === true;

const normalizePrescriptionActivities = (list) => {
  if (!Array.isArray(list)) return [];

  return list
    .filter(isConfirmedPrescription)
    .flatMap((rx) => {
      const medicines = Array.isArray(rx.medicines)
        ? rx.medicines
        : Array.isArray(rx.items)
        ? rx.items
        : rx.medicine
        ? [rx.medicine]
        : [];

      return medicines.flatMap((med, medIndex) => {
        const times = Array.isArray(med.times)
          ? med.times
          : med.time
          ? [med.time]
          : [];

        return (times.length ? times : ["08:00"]).map((time, timeIndex) => ({
          id: `${getId(rx) || "rx"}-${medIndex}-${timeIndex}`,
          type: "MEDICATION",
          time,
          icon: "💊",
          title: med.name || med.medicineName || med.drugName || "Thuốc theo đơn",
          description: [
            med.dosage || med.dose,
            med.quantity ? `SL: ${med.quantity}` : "",
            med.mealRelation === "AFTER_MEAL"
              ? "Sau ăn"
              : med.mealRelation === "BEFORE_MEAL"
              ? "Trước ăn"
              : "",
          ].filter(Boolean).join(" • "),
          source: "DOCTOR",
          prescriptionId: getId(rx),
          done: false,
        }));
      });
    });
};

export default function Dashboard() {
  const [user, setUser] = useState(safeUserFromStorage);

  const [menu, setMenu] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState({});
  const [advices, setAdvices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text:
        "Xin chào 👋 Mình là trợ lý sức khỏe DOCTIS, tập trung vào đái tháo đường type 2. Bạn có thể hỏi về theo dõi đường huyết, ăn uống, vận động, thuốc và biến chứng. Mình cung cấp thông tin tham khảo, không thay thế chẩn đoán hay hướng dẫn điều trị từ bác sĩ.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [doctors, setDoctors] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorMessages, setDoctorMessages] = useState([]);
  const [doctorMessageInput, setDoctorMessageInput] = useState("");
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorAttachment, setDoctorAttachment] = useState(null);

    const [apiErrors, setApiErrors] = useState({});

  // Bệnh nền (multi-select) + Dị ứng (tag input)
  const [chronicSelected, setChronicSelected] = useState([]);
  const [chronicOther, setChronicOther] = useState("");
  const [allergyTags, setAllergyTags] = useState([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [allergySelect, setAllergySelect] = useState("");

  // Dinh dưỡng
  const [nutritionPlan, setNutritionPlan] = useState(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(0);

  // Kế hoạch chăm sóc hằng ngày
  const [careWeek, setCareWeek] = useState([]);
  const [doctorCarePlan, setDoctorCarePlan] = useState(null);

  // Nhắc qua email cho từng hoạt động trong kế hoạch chăm sóc.
  const [reminderSendingId, setReminderSendingId] = useState("");
  const [emailRemindedIds, setEmailRemindedIds] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    API.get("/care-plans/my")
      .then((res) => { if (active) setDoctorCarePlan(res.data || null); })
      .catch((err) => {
        if (active && err.response?.status !== 404) console.error("GET CONFIRMED CARE PLAN ERROR =", err);
        if (active) setDoctorCarePlan(null);
      });
    return () => { active = false; };
  }, []);

  // Đơn thuốc: chỉ hiển thị đơn đã được xác nhận/kích hoạt.
  // Backend Doctor Page có thể cung cấp dữ liệu qua /prescriptions/my.
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState(false);

    const chatEndRef = useRef(null);
  const doctorChatEndRef = useRef(null);
  const doctorChatBodyRef = useRef(null);
  const doctorChatStickToBottomRef = useRef(true);
  const doctorAttachmentInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const profileRef = useRef({});

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    const className = "doctis-chat-active";

    if (menu === "doctor-chat") {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }

    return () => document.body.classList.remove(className);
  }, [menu]);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await API.get("/health/history");
      const list = Array.isArray(res.data) ? res.data : [];

      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      setData(sorted);
      setLatest(sorted[0] || {});
      setApiErrors((prev) => ({ ...prev, health: false }));
    } catch (err) {
      console.error("FETCH HEALTH ERROR =", err);
      setApiErrors((prev) => ({ ...prev, health: true }));
    }
  }, []);

  const fetchAdvices = useCallback(async () => {
    try {
      const res = await API.get("/health/advices");
      setAdvices(Array.isArray(res.data) ? res.data : []);
      setApiErrors((prev) => ({ ...prev, advices: false }));
    } catch (err) {
      console.error("FETCH ADVICES ERROR =", err);
      setAdvices([]);
      setApiErrors((prev) => ({ ...prev, advices: true }));
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await API.get("/appointments/patient");
      setAppointments(Array.isArray(res.data) ? res.data : []);
      setApiErrors((prev) => ({ ...prev, appointments: false }));
    } catch (err) {
      console.error("FETCH APPOINTMENTS ERROR =", err);
      setAppointments([]);
      setApiErrors((prev) => ({ ...prev, appointments: true }));
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    const storedUser = safeUserFromStorage();

    try {
      const res = await API.get("/profile");
      const profileData = res.data?.profile || res.data || {};

      setProfile((prev) => ({
        ...prev,
        ...profileData,
        id:
          profileData.id ||
          profileData._id ||
          prev.id ||
          getId(storedUser),
        _id: profileData._id || profileData.id || prev._id || getId(storedUser),
        username:
          profileData.username ||
          prev.username ||
          storedUser.username ||
          "",
        fullName:
          profileData.fullName ||
          profileData.username ||
          prev.fullName ||
          storedUser.fullName ||
          storedUser.username ||
          "",
        email: profileData.email ?? prev.email ?? storedUser.email ?? "",
        cccd: profileData.cccd ?? prev.cccd ?? storedUser.cccd ?? "",
        phone: profileData.phone ?? "",
        fatherPhone: profileData.fatherPhone ?? "",
        motherPhone: profileData.motherPhone ?? "",
        dateOfBirth: normalizeDateForInput(profileData.dateOfBirth),
        gender: profileData.gender ?? "",
        address: profileData.address ?? "",
        province: profileData.province ?? "",
        district: profileData.district ?? "",
        ward: profileData.ward ?? "",
        bloodType: profileData.bloodType ?? "",
        allergies: profileData.allergies ?? "",
        medicalHistory: profileData.medicalHistory ?? "",
        chronicDiseases: profileData.chronicDiseases ?? "",
        emergencyContactName: profileData.emergencyContactName ?? "",
        emergencyContactPhone: profileData.emergencyContactPhone ?? "",
        emergencyContactRelation:
          profileData.emergencyContactRelation ?? "",
        avatar: profileData.avatar ?? "",
      }));

      setApiErrors((prev) => ({ ...prev, profile: false }));
    } catch (err) {
      console.error("FETCH PROFILE ERROR =", err);
      setApiErrors((prev) => ({ ...prev, profile: true }));

      if (err.response?.status === 401) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

    const fetchPrescriptions = useCallback(async () => {
    setPrescriptionLoading(true);
    setPrescriptionError(false);

    try {
      // Endpoint dành cho Doctor Page ở giai đoạn tích hợp.
      const res = await API.get("/prescriptions/my");
      const list = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.prescriptions)
        ? res.data.prescriptions
        : [];

      const currentProfile = profileRef.current || {};
      const fallback = Array.isArray(currentProfile.prescriptions)
        ? currentProfile.prescriptions
        : Array.isArray(currentProfile.prescription)
        ? currentProfile.prescription
        : [];

      setPrescriptions(list.length ? list : fallback);
    } catch (err) {
      // Chưa có endpoint thì giao diện vẫn hoạt động bình thường.
      console.warn("FETCH PRESCRIPTIONS INFO =", err);
      const currentProfile = profileRef.current || {};
      const fallback = Array.isArray(currentProfile.prescriptions)
        ? currentProfile.prescriptions
        : Array.isArray(currentProfile.prescription)
        ? currentProfile.prescription
        : [];
      setPrescriptions(fallback);
      setPrescriptionError(fallback.length === 0);
    } finally {
      setPrescriptionLoading(false);
    }
  }, []);

    const fetchDoctors = useCallback(async () => {
    try {
      const res = await API.get("/messages/doctors");
      const list = Array.isArray(res.data) ? res.data : [];

      list.sort(
        (a, b) =>
          new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0)
      );

      setDoctors(list);
      setApiErrors((prev) => ({ ...prev, doctors: false }));
    } catch (err) {
      console.error("FETCH DOCTORS ERROR =", err);

      // Dự phòng: nếu /messages/doctors chưa sẵn sàng, dùng danh sách cơ bản.
      try {
        const fallback = await API.get("/doctors");
        const list = Array.isArray(fallback.data)
          ? fallback.data
          : Array.isArray(fallback.data?.doctors)
          ? fallback.data.doctors
          : [];
        setDoctors(list);
        setApiErrors((prev) => ({ ...prev, doctors: false }));
      } catch (fallbackErr) {
        setDoctors([]);
        setApiErrors((prev) => ({ ...prev, doctors: true }));
      }
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchAdvices();
    fetchAppointments();
    fetchProfile();
    fetchDoctors();
    fetchPrescriptions();
  }, [
    fetchHealth,
    fetchAdvices,
    fetchAppointments,
    fetchProfile,
    fetchDoctors,
    fetchPrescriptions,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);
  
    useEffect(() => {
    if (menu !== "doctor-chat") return;
    const interval = setInterval(fetchDoctors, 5000);
    return () => clearInterval(interval);
  }, [menu, fetchDoctors]);

  useEffect(() => {
    if (menu !== "doctor-chat" || !selectedDoctor) return;

    const interval = setInterval(() => {
      const doctorId = getId(selectedDoctor);

      API.get(`/messages/doctor/${doctorId}`)
        .then((res) => {
          const nextMessages = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.messages)
            ? res.data.messages
            : [];

          setDoctorMessages((prev) => {
            const previousById = new Map(
              prev.map((message) => [String(message?._id || ""), message])
            );
            const normalizedMessages = nextMessages.map((message) => {
              const previous = previousById.get(String(message?._id || ""));
              if (previous?.attachment && !message?.attachment) {
                return { ...message, attachment: previous.attachment };
              }
              return message;
            });

            const sameLength = prev.length === normalizedMessages.length;
            const sameIds =
              prev.map((m) => String(m?._id || "")).join("|") ===
              normalizedMessages.map((m) => String(m?._id || "")).join("|");

            const prevLast = prev[prev.length - 1];
            const nextLast = normalizedMessages[normalizedMessages.length - 1];

            const sameLastContent =
              String(prevLast?.content || prevLast?.text || "") ===
              String(nextLast?.content || nextLast?.text || "");

            return sameLength && sameIds && sameLastContent
              ? prev
              : normalizedMessages;
          });
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [menu, selectedDoctor]);

  useEffect(() => {
    const body = doctorChatBodyRef.current;

    if (!body || menu !== "doctor-chat") return;
    if (!doctorChatStickToBottomRef.current) return;

    requestAnimationFrame(() => {
      body.scrollTo({
        top: body.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [doctorMessages, menu]);

  const handleDoctorChatScroll = () => {
    const body = doctorChatBodyRef.current;
    if (!body) return;

    const distanceFromBottom =
      body.scrollHeight - body.scrollTop - body.clientHeight;

    doctorChatStickToBottomRef.current = distanceFromBottom < 90;
  };

  // Đồng bộ dữ liệu hồ sơ sau khi API tải xong.
  useEffect(() => {
    if (profileLoading) return;

    const chronicParts = String(profile.chronicDiseases || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const matched = CHRONIC_DISEASE_OPTIONS.filter((opt) =>
      chronicParts.some((p) => p.toLowerCase() === opt.toLowerCase())
    );

    const other = chronicParts.filter(
      (p) =>
        !CHRONIC_DISEASE_OPTIONS.some(
          (opt) => opt.toLowerCase() === p.toLowerCase()
        )
    );

    setChronicSelected(matched);
    setChronicOther(other.join(", "));

    const allergyParts = String(profile.allergies || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    setAllergyTags(allergyParts);
  }, [profileLoading, profile.chronicDiseases, profile.allergies]);

  const calculateBMI = () => {
    const height = Number(form.height);
    const weight = Number(form.weight);

    if (!height || !weight || height <= 0 || weight <= 0) return "";

    const meters = height / 100;
    return (weight / (meters * meters)).toFixed(2);
  };

  const calculatedBMI = calculateBMI();

  const risk = useMemo(() => {
    const label = getRiskAssessment(latest);
    return {
      label,
      className: label === "Nguy hiểm"
        ? "risk-danger"
        : label === "Cao" ? "risk-medium" : "risk-safe",
    };
  }, [latest]);

  const analysisData = useMemo(() => {
    try {
      return generateHealthAnalysis(latest) || [];
    } catch (err) {
      console.error("AI ANALYSIS ERROR =", err);
      return [];
    }
  }, [latest]);

  const nutritionMissingFields = useMemo(() => {
    const missing = [];

    if (!Number(latest?.bmi)) missing.push("BMI");
    if (!Number(latest?.glucose)) missing.push("Glucose");
    if (!Number(latest?.systolic) || !Number(latest?.diastolic)) {
      missing.push("Huyết áp");
    }
    if (!String(profile.allergies || "").trim()) missing.push("Dị ứng");
    if (!String(profile.chronicDiseases || "").trim()) {
      missing.push("Bệnh nền hiện tại");
    }

    return missing;
  }, [latest, profile.allergies, profile.chronicDiseases]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };
  
    const toggleChronicOption = (option) => {
    setChronicSelected((prevSelected) => {
      let nextSelected;

      if (option === "Không có bệnh nền") {
        nextSelected = prevSelected.includes(option) ? [] : ["Không có bệnh nền"];
        if (nextSelected.length) setChronicOther("");
      } else {
        const withoutNone = prevSelected.filter(
          (o) => o !== "Không có bệnh nền"
        );
        nextSelected = withoutNone.includes(option)
          ? withoutNone.filter((o) => o !== option)
          : [...withoutNone, option];
      }

      const otherText =
        option === "Không có bệnh nền" && nextSelected.length ? "" : chronicOther;

      const combined = [...nextSelected, otherText.trim()]
        .filter(Boolean)
        .join(", ");

      setProfile((prev) => ({ ...prev, chronicDiseases: combined }));

      return nextSelected;
    });
  };

  const handleChronicOtherChange = (value) => {
    setChronicOther(value);
    const combined = [...chronicSelected, value.trim()]
      .filter(Boolean)
      .join(", ");
    setProfile((prev) => ({ ...prev, chronicDiseases: combined }));
  };

  const syncAllergyProfile = (nextTags) => {
    setAllergyTags(nextTags);
    setProfile((prev) => ({
      ...prev,
      allergies: nextTags.join(", "),
    }));
  };

  const addAllergyTag = () => {
    const value = allergyInput.trim();
    if (!value) return;

    if (allergyTags.includes("Không có")) {
      syncAllergyProfile([]);
    }

    if (allergyTags.some((t) => t.toLowerCase() === value.toLowerCase())) {
      setAllergyInput("");
      return;
    }

    const next = [
      ...allergyTags.filter((t) => t !== "Không có"),
      value,
    ];

    syncAllergyProfile(next);
    setAllergyInput("");
  };

  const addAllergyFromSelect = (value) => {
    if (!value) return;

    if (value === "Không có") {
      markNoAllergy();
      setAllergySelect("");
      return;
    }

    if (value === "Khác") {
      setAllergySelect("Khác");
      setAllergyInput("");
      return;
    }

    const current = allergyTags.filter((tag) => tag !== "Không có");
    const exists = current.some(
      (tag) => tag.toLowerCase() === value.toLowerCase()
    );

    if (!exists) {
      syncAllergyProfile([...current, value]);
    }

    setAllergySelect("");
  };

  const removeAllergyTag = (tag) => {
    const next = allergyTags.filter((t) => t !== tag);
    syncAllergyProfile(next);
  };

  const handleAllergyKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addAllergyTag();
    }
  };

  const markNoAllergy = () => {
    setAllergyTags(["Không có"]);
    setAllergyInput("");
    setAllergySelect("");
    setProfile((prev) => ({ ...prev, allergies: "Không có" }));
  };

  const buildCareWeek = useCallback((plan, activePrescriptions = []) => {
    if (!plan?.days?.length) return [];

    const exerciseByDay = [
      { title: "Đi bộ nhẹ", duration: "20 phút", time: "16:30", icon: "🚶" },
      { title: "Giãn cơ + đi bộ", duration: "20 phút", time: "16:30", icon: "🧘" },
      { title: "Đi bộ nhẹ", duration: "25 phút", time: "16:30", icon: "🚶" },
      { title: "Nghỉ phục hồi", duration: "10 phút", time: "17:00", icon: "🧘" },
      { title: "Đi bộ nhẹ", duration: "20 phút", time: "16:30", icon: "🚶" },
      { title: "Vận động nhẹ", duration: "25 phút", time: "08:30", icon: "🏃" },
      { title: "Giãn cơ thư giãn", duration: "15 phút", time: "17:00", icon: "🧘" },
    ];

    const medications = normalizePrescriptionActivities(activePrescriptions);

    return plan.days.map((day, index) => ({
      ...day,
      exercise: {
        ...exerciseByDay[index % exerciseByDay.length],
        id: `exercise-${index}`,
        done: !!day.exerciseDone,
      },
      meals: [
        { key: "breakfast", id: `breakfast-${index}`, label: "Bữa sáng", time: "07:00", icon: "🍳", text: day.breakfast, done: !!day.breakfastDone },
        { key: "lunch", id: `lunch-${index}`, label: "Bữa trưa", time: "12:00", icon: "🍱", text: day.lunch, done: !!day.lunchDone },
        { key: "dinner", id: `dinner-${index}`, label: "Bữa tối", time: "18:30", icon: "🍲", text: day.dinner, done: !!day.dinnerDone },
      ],
      medications,
    }));
  }, []);

  const handleGeneratePlan = () => {
    if (nutritionMissingFields.length > 0) {
      alert(
        `Không thể tạo kế hoạch. Vui lòng cập nhật đầy đủ thông tin sau:\n\n- ${nutritionMissingFields.join(
          "\n- "
        )}\n\nBMI / Glucose / Huyết áp: cập nhật tại mục "Thông tin sức khỏe".\nDị ứng / Bệnh nền: cập nhật tại mục "Hồ sơ bệnh nhân".`
      );
      return;
    }

    setNutritionLoading(true);
    window.setTimeout(() => {
      const plan = generateNutritionPlan({ latest, profile });
      setNutritionPlan(plan);
      setCareWeek(buildCareWeek(plan, prescriptions));
      setActiveDay(0);
      setNutritionLoading(false);
    }, 900);
  };

  useEffect(() => {
    if (nutritionPlan?.days?.length) {
      setCareWeek(buildCareWeek(nutritionPlan, prescriptions));
    }
  }, [nutritionPlan, prescriptions, buildCareWeek]);

  const toggleCareActivity = (dayIndex, activityId) => {
    setCareWeek((prev) =>
      prev.map((day, index) => {
        if (index !== dayIndex) return day;
        const update = (items) =>
          items.map((item) =>
            item.id === activityId ? { ...item, done: !item.done } : item
          );
        return {
          ...day,
          meals: update(day.meals || []),
          medications: update(day.medications || []),
          exercise: day.exercise?.id === activityId
            ? { ...day.exercise, done: !day.exercise.done }
            : day.exercise,
        };
      })
    );
  };

  const handleEmailReminder = async (day, item, dayIndex = activeDay) => {
    const activityId = `${day?.label || "day"}-${item?.id || item?.time}`;
    const email = String(profile?.email || user?.email || "").trim();

    if (!email) {
      alert("Bạn chưa có email trong hồ sơ. Vui lòng cập nhật email trước khi bật nhắc nhở.");
      return;
    }

    if (!item?.time) {
      alert("Hoạt động này chưa có giờ để tạo nhắc nhở.");
      return;
    }

    if (emailRemindedIds.has(activityId) || reminderSendingId === activityId) return;

    setReminderSendingId(activityId);

    try {
      const scheduledDate = new Date();
      scheduledDate.setHours(0, 0, 0, 0);
      scheduledDate.setDate(scheduledDate.getDate() + Number(dayIndex || 0));
      const scheduleDate = [scheduledDate.getFullYear(), String(scheduledDate.getMonth() + 1).padStart(2, "0"), String(scheduledDate.getDate()).padStart(2, "0")].join("-");
      await API.post("/reminders/create", {
        title: `${item.title || item.label || "Hoạt động chăm sóc"} — ${day?.label || "Kế hoạch chăm sóc"}`,
        description: item.text || item.description || "Nhắc nhở trong kế hoạch chăm sóc hằng ngày.",
        time: item.time,
        source: "CARE_PLAN",
        activityType: item.kind === "medication" ? "MEDICATION" : item.kind === "exercise" ? "EXERCISE" : "MEAL",
        dayLabel: day?.label || "",
        scheduleDate,
      });

      setEmailRemindedIds((prev) => {
        const next = new Set(prev);
        next.add(activityId);
        return next;
      });

      alert(`Đã bật nhắc qua email ${email} cho ${item.time}.`);
    } catch (err) {
      console.error("SEND CARE EMAIL REMINDER ERROR =", err);
      alert(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Không thể tạo nhắc nhở email. Kiểm tra backend /reminders/create và cấu hình email."
      );
    } finally {
      setReminderSendingId("");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("Ảnh không được vượt quá 5MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        alert("Không thể đọc ảnh.");
        return;
      }

      setProfile((prev) => ({
        ...prev,
        avatar: reader.result,
      }));
    };

    reader.onerror = () => {
      alert("Không thể đọc file ảnh.");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const saveProfile = async () => {
    if (profileSaving) return;

       const required = [
      ["fullName", "Vui lòng nhập họ và tên."],
      ["dateOfBirth", "Vui lòng chọn ngày sinh."],
      ["gender", "Vui lòng chọn giới tính."],
      ["cccd", "Vui lòng nhập số CCCD."],
      ["email", "Vui lòng nhập email."],
      ["phone", "Vui lòng nhập số điện thoại."],
      ["address", "Vui lòng nhập địa chỉ nhà."],
      ["province", "Vui lòng nhập tỉnh/thành phố."],
      ["district", "Vui lòng nhập quận/huyện."],
      ["ward", "Vui lòng nhập phường/xã."],
      ["bloodType", "Vui lòng chọn nhóm máu."],
    ];

    for (const [field, message] of required) {
      if (!String(profile[field] || "").trim()) {
        alert(message);
        return;
      }
    }

    if (
      !String(profile.fatherPhone || "").trim() &&
      !String(profile.motherPhone || "").trim()
    ) {
      alert("Vui lòng nhập ít nhất một số điện thoại người thân (bố hoặc mẹ).");
      return;
    }

    if (chronicSelected.length === 0 && !chronicOther.trim()) {
      alert(
        "Vui lòng chọn bệnh nền hiện tại (chọn 'Không có bệnh nền' nếu bạn không mắc bệnh nào)."
      );
      return;
    }

    if (allergyTags.length === 0) {
      alert(
        "Vui lòng nhập dị ứng (bấm 'Không có dị ứng' nếu bạn không bị dị ứng)."
      );
      return;
    }

    setProfileSaving(true);

    try {
      const payload = {
        fullName: String(profile.fullName || "").trim(),
        email: String(profile.email || "").trim().toLowerCase(),
        phone: String(profile.phone || "").trim(),
        fatherPhone: String(profile.fatherPhone || "").trim(),
        motherPhone: String(profile.motherPhone || "").trim(),
        dateOfBirth: profile.dateOfBirth || "",
        gender: profile.gender || "",
        cccd: String(profile.cccd || "").trim(),
        address: String(profile.address || "").trim(),
        province: String(profile.province || "").trim(),
        district: String(profile.district || "").trim(),
        ward: String(profile.ward || "").trim(),
        bloodType: profile.bloodType || "",
        allergies: String(profile.allergies || "").trim(),
        medicalHistory: String(profile.medicalHistory || "").trim(),
        chronicDiseases: String(profile.chronicDiseases || "").trim(),
        emergencyContactName: String(
          profile.emergencyContactName || ""
        ).trim(),
        emergencyContactPhone: String(
          profile.emergencyContactPhone || ""
        ).trim(),
        emergencyContactRelation: String(
          profile.emergencyContactRelation || ""
        ).trim(),
        avatar: profile.avatar || "",
      };

      const res = await API.put("/profile", payload);
      const savedProfile = res.data?.profile || res.data || {};

      const mergedProfile = {
        ...profile,
        ...savedProfile,
        dateOfBirth: normalizeDateForInput(
          savedProfile.dateOfBirth ?? profile.dateOfBirth
        ),
      };

      setProfile(mergedProfile);

      const oldUser = safeUserFromStorage();
      const updatedUser = {
        ...oldUser,
        ...savedProfile,
        id:
          savedProfile.id ||
          savedProfile._id ||
          oldUser.id ||
          oldUser._id,
        _id:
          savedProfile._id ||
          savedProfile.id ||
          oldUser._id ||
          oldUser.id,
        username:
          savedProfile.username ||
          oldUser.username ||
          profile.username ||
          "",
        fullName:
          savedProfile.fullName ||
          profile.fullName ||
          oldUser.fullName ||
          "",
        email:
          savedProfile.email ||
          profile.email ||
          oldUser.email ||
          "",
        cccd:
          savedProfile.cccd ||
          profile.cccd ||
          oldUser.cccd ||
          "",
        phone:
          savedProfile.phone ??
          profile.phone ??
          oldUser.phone ??
          "",
        avatar:
          savedProfile.avatar ??
          profile.avatar ??
          oldUser.avatar ??
          "",
        role: savedProfile.role || oldUser.role,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      alert("Cập nhật hồ sơ thành công!");
    } catch (err) {
      console.error("SAVE PROFILE ERROR =", err);

      alert(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Cập nhật hồ sơ thất bại."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const saveHealth = async () => {
    try {
      const height = Number(form.height);
      const weight = Number(form.weight);
      const glucose = Number(form.glucose);
      const heartRate = Number(form.heartRate);

      if (!height || height <= 0) {
        alert("Vui lòng nhập chiều cao hợp lệ.");
        return;
      }

      if (!weight || weight <= 0) {
        alert("Vui lòng nhập cân nặng hợp lệ.");
        return;
      }

      if (!glucose || glucose <= 0) {
        alert("Vui lòng nhập glucose hợp lệ.");
        return;
      }

      if (!form.bloodPressure.includes("/")) {
        alert("Huyết áp phải có dạng 120/80.");
        return;
      }

      if (!heartRate || heartRate <= 0) {
        alert("Vui lòng nhập nhịp tim hợp lệ.");
        return;
      }

      const bp = form.bloodPressure.split("/");
      const systolic = Number(bp[0]);
      const diastolic = Number(bp[1]);

      if (
        !Number.isFinite(systolic) ||
        !Number.isFinite(diastolic) ||
        systolic <= 0 ||
        diastolic <= 0
      ) {
        alert("Huyết áp không hợp lệ.");
        return;
      }

      const res = await API.post("/health/add", {
        height,
        weight,
        glucose,
        systolic,
        diastolic,
        heartRate,
      });

      setForm(EMPTY_FORM);
      await fetchHealth();

      alert(
        `Đã lưu dữ liệu sức khỏe.\nBMI của bạn: ${
          res.data?.bmi ?? calculatedBMI
        }`
      );
    } catch (err) {
      console.error("SAVE HEALTH ERROR =", err);

      alert(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Lưu dữ liệu thất bại."
      );
    }
  };

  const sendMessage = async () => {
    const userText = chatInput.trim();
    if (!userText || loading) return;

    const userMsg = {
      sender: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setLoading(true);

    try {
      // Send only turns that existed before this question. The API adds the
      // current question itself, so including userMsg here would duplicate it.
      const history = messages
        .filter((msg) => !msg.isError && (msg.sender === "user" || msg.sender === "ai"))
        .slice(-10)
        .map((msg) => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.text,
        }));

      const res = await API.post("/ai/analyze", {
        glucose: latest?.glucose ?? 0,
        bmi: latest?.bmi ?? calculatedBMI ?? 0,
        bloodPressure: latest?.systolic
          ? `${latest.systolic}/${latest.diastolic}`
          : "",
        heartRate: latest?.heartRate ?? 0,
        message: userText,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text:
            res.data?.reply ||
            "Tôi chưa nhận được phản hồi từ hệ thống.",
        },
      ]);
    } catch (err) {
      console.error("AI CHAT ERROR =", err);

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text:
            err.response?.data?.msg ||
            "Chưa kết nối được trợ lý AI. Vui lòng thử lại sau.",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredDoctors = useMemo(() => {
    const keyword = doctorSearch.toLowerCase().trim();

    if (!keyword) return doctors;

    return doctors.filter((doctor) => {
      const name = String(
        doctor.fullName || doctor.username || doctor.name || ""
      ).toLowerCase();

      const specialty = String(
        doctor.specialty || doctor.specialization || ""
      ).toLowerCase();

      const email = String(doctor.email || "").toLowerCase();

      return (
        name.includes(keyword) ||
        specialty.includes(keyword) ||
        email.includes(keyword)
      );
    });
  }, [doctors, doctorSearch]);

  const getDoctorName = (doctor) =>
    doctor?.fullName ||
    doctor?.username ||
    doctor?.name ||
    "Bác sĩ";

  const selectDoctor = async (doctor) => {
    setSelectedDoctor(doctor);
    setDoctorLoading(true);
    doctorChatStickToBottomRef.current = true;

    try {
      const doctorId = getId(doctor);
      const res = await API.get(`/messages/doctor/${doctorId}`);

      setDoctorMessages(
        Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.messages)
          ? res.data.messages
          : []
      );
    } catch (err) {
      console.error("FETCH DOCTOR MESSAGES ERROR =", err);
      setDoctorMessages([]);
    } finally {
      setDoctorLoading(false);
    }
  };

  const handleDoctorAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 8 * 1024 * 1024;
    const allowed =
      file.type.startsWith("image/") ||
      [
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].includes(file.type);

    if (!allowed) {
      alert("Chỉ hỗ trợ ảnh, PDF, Word, Excel hoặc TXT.");
      e.target.value = "";
      return;
    }

    if (file.size > maxSize) {
      alert("Tệp đính kèm không được vượt quá 8MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        alert("Không thể đọc tệp.");
        return;
      }

      setDoctorAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result,
      });
    };

    reader.onerror = () => alert("Không thể đọc tệp đính kèm.");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeDoctorAttachment = () => setDoctorAttachment(null);

  const sendDoctorMessage = async () => {
    const rawContent = doctorMessageInput.trim();

    if ((!rawContent && !doctorAttachment) || !selectedDoctor) return;

    const doctorId = getId(selectedDoctor);
    if (!doctorId) return;

    const currentUserId = getId(user);

    const attachment = doctorAttachment
      ? {
          name: doctorAttachment.name,
          type: doctorAttachment.type,
          size: doctorAttachment.size,
          dataUrl: doctorAttachment.dataUrl,
        }
      : null;

    // Backend hiện bắt buộc "content" phải khác rỗng, kể cả khi người dùng
    // chỉ gửi ảnh/tệp đính kèm mà không gõ chữ — nếu để trống sẽ bị lỗi
    // "Thiếu receiverId hoặc nội dung". Nên tự thêm một chú thích ngắn.
    const content =
      rawContent ||
      (attachment
        ? attachment.type?.startsWith("image/")
          ? "📷 Đã gửi một ảnh"
          : "📎 Đã gửi một tệp đính kèm"
        : "");

    const temporaryMessage = {
      _id: `temp-${Date.now()}`,
      senderId: currentUserId,
      receiverId: doctorId,
      content,
      attachment,
      createdAt: new Date().toISOString(),
      sender: "user",
      senderRole: "patient",
      read: false,
    };

    doctorChatStickToBottomRef.current = true;
    setDoctorMessages((prev) => [...prev, temporaryMessage]);
    setDoctorMessageInput("");
    setDoctorAttachment(null);

    try {
      const res = await API.post("/messages/send", {
        receiverId: doctorId,
        content,
        attachment,
      });

      if (res.data) {
        setDoctorMessages((prev) =>
          prev.map((msg) =>
            msg._id === temporaryMessage._id
              ? { ...res.data, attachment: res.data?.attachment || attachment }
              : msg
          )
        );
      }
    } catch (err) {
      console.error("SEND DOCTOR MESSAGE ERROR =", err);

      setDoctorMessages((prev) =>
        prev.filter((msg) => msg._id !== temporaryMessage._id)
      );

      alert(
        err.response?.data?.msg ||
          err.response?.data?.message ||
          "Không thể gửi tin nhắn."
      );
    }
  };

  const handleDoctorKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendDoctorMessage();
    }
  };

  const renderDoctorAttachment = (attachment) => {
    if (!attachment) return null;

    const type = String(attachment.type || "");
    const imageSource =
      attachment.dataUrl ||
      attachment.url ||
      attachment.fileUrl ||
      attachment.src ||
      "";
    const isImage = type.startsWith("image/");
    const canPreviewImage =
      isImage &&
      /^(data:image\/|https?:\/\/|blob:|\/)/i.test(String(imageSource));

    if (canPreviewImage) {
      return (
        <a
          className="doctor-message-image"
          href={imageSource}
          target="_blank"
          rel="noreferrer"
          title={attachment.name || "Ảnh đính kèm"}
        >
          <img
            src={imageSource}
            alt={attachment.name || "Ảnh đính kèm"}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
              event.currentTarget.parentElement?.classList.add("is-broken");
            }}
          />
          <span>
            <FaImage />
            {attachment.name || "Ảnh đính kèm"}
          </span>
        </a>
      );
    }

    return (
      <div className="doctor-message-file doctor-message-file-fallback">
        {isImage ? <FaImage /> : <FaFileAlt />}
        <span>
          <strong>{attachment.name || "Tệp đính kèm"}</strong>
          <small>
            {attachment.size
              ? `${(attachment.size / 1024 / 1024).toFixed(2)} MB`
              : type || "Tệp"}
          </small>
        </span>
        {imageSource && /^(https?:\/\/|\/)/i.test(String(imageSource)) && (
          <a
            href={imageSource}
            target="_blank"
            rel="noreferrer"
            className="doctor-file-open"
          >
            Mở
          </a>
        )}
      </div>
    );
  };

  const isCurrentUserMessage = (msg) => {
    if (msg?.senderRole) return msg.senderRole === "patient";
    const currentUserId = String(getId(user));
    const senderId = String(getId(msg?.senderId));

    return msg?.sender === "user" || senderId === currentUserId;
  };

  const formatDate = (date) => {
    if (!date) return "";

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleDateString("vi-VN");
  };

  const formatTime = (date) => {
    if (!date) return "";

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/";
  };

  const menus = [
    {
      key: "dashboard",
      icon: <FaHeartbeat />,
      label: "Bảng điều khiển",
    },
    {
      key: "profile",
      icon: <FaUser />,
      label: "Hồ sơ bệnh nhân",
    },
    {
      key: "doctor-chat",
      icon: <FaUserMd />,
      label: "Trò chuyện với bác sĩ",
    },
    {
      key: "health",
      icon: <FaPlusCircle />,
      label: "Thông tin sức khỏe",
    },
    {
      key: "analytics",
      icon: <FaChartLine />,
      label: "Biểu đồ & lịch sử",
    },
    {
      key: "ai",
      icon: <FaRobot />,
      label: "AI phân tích",
    },
    {
      key: "care-plan",
      icon: <FaUtensils />,
      label: "Kế hoạch chăm sóc",
    },
    {
      key: "appointments",
      icon: <FaCalendarCheck />,
      label: "Lịch hẹn khám",
    },
  ];

  const Card = ({ title, value, icon, status, type }) => (
    <motion.div
      className={`modern-card ${type || ""}`}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="card-top">
        <div className="card-icon">{icon}</div>
        {status && (
          <div className={`card-status ${type || ""}`}>{status}</div>
        )}
      </div>

      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </motion.div>
  );

  return (
    <div className="dashboard-layout doctis-v5">
      <div className="dashboard-bg" />
      <header className="v5-topbar">
        <button type="button" className="v5-brand" onClick={() => { setMenu("dashboard"); setMobileMenuOpen(false); }}>
          <span className="v5-brand-mark"><FaHeartbeat /></span>
          <span><strong>DOCTIS</strong><small>Sức khỏe thông minh</small></span>
        </button>
        <nav className="v5-primary-nav" aria-label="Điều hướng chính">
          <button className={menu === "dashboard" ? "active" : ""} onClick={() => setMenu("dashboard")}><FaHome /> Tổng quan</button>
          <button className={menu === "profile" ? "active" : ""} onClick={() => setMenu("profile")}><FaUser /> Hồ sơ</button>
          <button className={menu === "health" ? "active" : ""} onClick={() => setMenu("health")}><FaPlusCircle /> Sức khỏe</button>
          <button className={menu === "care-plan" ? "active" : ""} onClick={() => setMenu("care-plan")}><FaUtensils /> Chăm sóc</button>
          <button className={menu === "appointments" ? "active" : ""} onClick={() => setMenu("appointments")}><FaCalendarCheck /> Lịch hẹn</button>
        </nav>
        <div className="v5-header-actions">
          <button className="v5-notification" onClick={() => setMenu("advices")} title="Thông báo"><FaBell />{advices.length > 0 && <span>{advices.length}</span>}</button>
          <button className="v5-account" onClick={() => setMenu("profile")} title="Tài khoản"><FaUserCircle /><span>{profile.fullName || user?.fullName || user?.username || "Tài khoản"}</span><FaChevronDown /></button>
          <button className="v5-logout-btn" onClick={logout} title="Đăng xuất"><FaSignOutAlt /><span>Đăng xuất</span></button>
          <button className="v5-menu-toggle" onClick={() => setMobileMenuOpen((v) => !v)} aria-label="Mở menu" aria-expanded={mobileMenuOpen} title="Mở danh mục"><FaBars /></button>
        </div>
      </header>
      {mobileMenuOpen && (
        <div className="v5-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <aside className="v5-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="v5-drawer-head"><strong>DOCTIS</strong><button onClick={() => setMobileMenuOpen(false)}><FaTimes /></button></div>
            <div className="v5-drawer-list">
              {menus.map((item) => <button key={item.key} className={menu === item.key ? "active" : ""} onClick={() => { setMenu(item.key); setMobileMenuOpen(false); }}>{item.icon}<span>{item.label}</span></button>)}
            </div>
            <button className="v5-drawer-logout" onClick={logout}><FaSignOutAlt /> Đăng xuất</button>
          </aside>
        </div>
      )}

      <main className="dashboard">
        {menu === "dashboard" && (
          <section className="v5-welcome-hero">
            <div className="v5-hero-copy">
              <span className="v5-hero-kicker">BẢNG ĐIỀU KHIỂN SỨC KHỎE CÁ NHÂN</span>
              <h1>Xin chào,<br /><strong>{profile.fullName || user?.fullName || user?.username || "Bạn"}</strong></h1>
              <p>Chúng tôi có thể giúp gì cho bạn hôm nay? Theo dõi chỉ số, hiểu sức khỏe và xây dựng kế hoạch chăm sóc phù hợp mỗi ngày.</p>
              <div className="v5-hero-actions"><button onClick={() => setMenu("health")}><FaPlusCircle /> Cập nhật sức khỏe</button><button className="ghost" onClick={() => setMenu("ai")}><FaRobot /> Hỏi DOCTIS AI</button></div>
            </div>
            <div className="v5-hero-art">
              <section className="v5-vitals-card" aria-label="Chỉ số sức khỏe gần nhất">
                <div className="v5-vitals-head">
                  <div><span>GHI NHẬN GẦN NHẤT</span><strong>{latest?.createdAt ? formatDate(latest.createdAt) : "Chưa có dữ liệu"}</strong></div>
                  <i className={latest?.createdAt ? "is-recorded" : ""} aria-label={latest?.createdAt ? "Đã ghi nhận" : "Chưa ghi nhận"} />
                </div>
                <div className="v5-vitals-metrics">
                  <div><span>Đường huyết</span><strong>{Number(latest?.glucose) > 0 ? latest.glucose : "—"}<small>{Number(latest?.glucose) > 0 ? "mg/dL" : ""}</small></strong></div>
                  <div><span>Huyết áp</span><strong>{latest?.systolic && latest?.diastolic ? `${latest.systolic}/${latest.diastolic}` : "—"}<small>{latest?.systolic && latest?.diastolic ? "mmHg" : ""}</small></strong></div>
                </div>
                <svg className="v5-pulse-line" viewBox="0 0 360 46" role="img" aria-label="Đồ họa nhịp theo dõi sức khỏe">
                  <path d="M0 25h82l13-1 9-12 13 25 13-34 15 32 12-10h24l10-1 10-12 13 24 13-35 15 34 11-9h97" />
                </svg>
                <p>{latest?.createdAt ? "Số liệu được lấy từ lần cập nhật sức khỏe gần nhất." : "Cập nhật chỉ số để bắt đầu theo dõi sức khỏe."}</p>
              </section>
            </div>
          </section>
        )}
        {menu === "dashboard" && (
          <section className="v5-quick-section">
            <div className="v5-section-heading"><div><span className="v5-eyebrow">TRUY CẬP NHANH</span><h2>Bạn muốn làm gì hôm nay?</h2></div><span className="v5-date-pill">{new Date().toLocaleDateString("vi-VN")}</span></div>
            <div className="v5-quick-grid">
              {[["profile", <FaUser />, "Hồ sơ bệnh nhân", "Thông tin cá nhân & bệnh nền"],["health", <FaPlusCircle />, "Chỉ số sức khỏe", "Nhập chỉ số mới nhất"],["ai", <FaRobot />, "AI phân tích", "Hiểu rõ tình trạng sức khỏe"],["care-plan", <FaUtensils />, "Kế hoạch chăm sóc", "Ăn uống • vận động • thuốc"],["care-plan", <FaNotesMedical />, "Đơn thuốc", "Xem đơn bác sĩ đã chốt"],["doctor-chat", <FaUserMd />, "Trò chuyện bác sĩ", "Trao đổi trực tiếp với bác sĩ"]].map(([key, icon, title, desc], index) => <motion.button key={`${key}-${title}-${index}`} type="button" className="v5-quick-card" whileHover={{ y: -5 }} whileTap={{ scale: 0.98 }} onClick={() => { setMenu(key); if (title === "Đơn thuốc") window.setTimeout(() => document.querySelector(".prescription-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }}><span className="v5-quick-icon">{icon}</span><span><strong>{title}</strong><small>{desc}</small></span><b>→</b></motion.button>)}
            </div>
          </section>
        )}
        {menu === "dashboard" && (
          <section className="v5-diabetes-section">
            <div className="v5-section-heading"><div><span className="v5-eyebrow">KIẾN THỨC SỨC KHỎE</span><h2>Hiểu hơn về đái tháo đường</h2><p>Thay các ô ảnh bên dưới bằng ảnh thật của dự án khi bạn sẵn sàng.</p></div></div>
            <div className="v5-diabetes-grid">
              {[['/images/diabetes/diabetes-01.jpg','Kiểm soát đường huyết','Theo dõi chỉ số đều đặn và nhận biết các dấu hiệu bất thường.'],['/images/diabetes/diabetes-02.jpg','Dinh dưỡng & vận động','Ăn uống cân bằng và vận động phù hợp là một phần của chăm sóc lâu dài.'],['/images/diabetes/diabetes-03.jpg','Chăm sóc chủ động','Lưu lịch sử, kế hoạch chăm sóc và trao đổi với bác sĩ khi cần.']].map(([image,title,desc]) => <article className="v5-diabetes-card" key={image}><div className="v5-image-placeholder" style={{backgroundImage:`url(${image})`}}><span>{title}</span><small>{image}</small></div><strong>{title}</strong><p>{desc}</p></article>)}
            </div>
          </section>
        )}

        {apiErrors.profile && menu === "profile" && (
          <div className="danger-alert">
            <FaExclamationTriangle />
            <span>
              Không tải được hồ sơ. Kiểm tra backend route
              <strong> /api/profile</strong> và token đăng nhập.
            </span>
          </div>
        )}

        {menu === "dashboard" && (
          <>
            {Number(latest?.glucose || 0) >= 240 && (
              <div className="danger-alert">
                <FaExclamationTriangle />
                <span>
                  Glucose đang ở mức rất cao. Bạn nên kiểm tra y tế sớm.
                </span>
              </div>
            )}

            <div className="latest-data-notice">
              <span className="latest-data-dot" />
              <div>
                <strong>Dữ liệu sức khỏe gần nhất</strong>
                <span>Toàn bộ chỉ số trên bảng điều khiển được lấy từ lần cập nhật sức khỏe gần nhất của bạn.</span>
              </div>
              {latest?.createdAt && (
                <time dateTime={latest.createdAt}>
                  Cập nhật: {formatDate(latest.createdAt)} {formatTime(latest.createdAt)}
                </time>
              )}
            </div>

            <div className="modern-grid">
              <Card
                title="Glucose"
                value={latest?.glucose || 0}
                icon={<FaTint />}
                status={latest?.glucose >= 140 ? "Cao" : "Ổn định"}
                type="danger"
              />

              <Card
                title="BMI"
                value={latest?.bmi || 0}
                icon={<FaWeight />}
                type="info"
              />

              <Card
                title="Huyết áp"
                value={
                  latest?.systolic
                    ? `${latest.systolic}/${latest.diastolic}`
                    : "0/0"
                }
                icon={<FaHeart />}
                type="pink"
              />

              <Card
                title="Nhịp tim"
                value={latest?.heartRate || 0}
                icon={<FaHeartbeat />}
                type="success"
              />

              <Card
                title="Rủi ro"
                value={risk.label}
                icon={<FaShieldAlt />}
                type="warning"
              />
            </div>

            <div className="ai-analysis-box">
              <div className="analysis-header">
                <div className="analysis-avatar">🤖</div>
                <div>
                  <h2>AI Phân tích sức khỏe</h2>
                  <p>
                    Dựa trên dữ liệu sức khỏe gần nhất của bạn.
                  </p>
                </div>
              </div>

              <div className="analysis-grid">
                {analysisData.length > 0 ? (
                  analysisData.map((item, index) => (
                    <div className="analysis-item" key={index}>
                      <div
                        className={`analysis-icon ${
                          item.bg || "blue"
                        }`}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>Chưa đủ dữ liệu để phân tích.</p>
                )}
              </div>
            </div>
          </>
        )}

        {menu === "profile" && (
          <motion.div
            className="patient-profile-page"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="profile-card">
              <div className="profile-page-header">
                <div>
                  <h2>👤 Hồ sơ bệnh nhân</h2>
                  <p>
                    Thông tin cá nhân và thông tin cần thiết cho quá trình
                    khám bệnh.
                  </p>
                </div>
              </div>

              <div className="profile-photo-section">
                <div
                  className="patient-photo-box"
                  onClick={handleAvatarClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      handleAvatarClick();
                    }
                  }}
                  title="Bấm để chọn ảnh"
                >
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="Ảnh bệnh nhân" />
                  ) : (
                    <div className="photo-placeholder">
                      <FaCamera />
                      <strong>ẢNH THẺ</strong>
                      <span>4 × 6</span>
                      <small>Bấm để chọn ảnh</small>
                    </div>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleAvatarChange}
                />

                <p className="photo-note">
                  Ảnh thẻ 4×6 • JPG, PNG • Tối đa 5MB
                </p>
              </div>

              <ProfileSection title="Thông tin cá nhân" icon={<FaUser />}>
                <ProfileField
                  full
                  label="Họ và tên *"
                  icon={<FaUser />}
                >
                  <input
                    type="text"
                    name="fullName"
                    value={profile.fullName || ""}
                    onChange={handleProfileChange}
                    placeholder="Nhập họ và tên"
                  />
                </ProfileField>

                <ProfileField label="Ngày sinh *">
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={profile.dateOfBirth || ""}
                    onChange={handleProfileChange}
                  />
                </ProfileField>

                <ProfileField label="Giới tính *">
                  <select
                    name="gender"
                    value={profile.gender || ""}
                    onChange={handleProfileChange}
                  >
                    <option value="">Chọn giới tính</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </ProfileField>

                <ProfileField label="Số CCCD / Căn cước *" icon={<FaIdCard />}>
                  <input
                    type="text"
                    name="cccd"
                    value={profile.cccd || ""}
                    onChange={handleProfileChange}
                    placeholder="Nhập số CCCD"
                  />
                </ProfileField>

                <ProfileField label="Email / Gmail *">
                  <input
                    type="email"
                    name="email"
                    value={profile.email || ""}
                    onChange={handleProfileChange}
                    placeholder="example@gmail.com"
                  />
                </ProfileField>

                <ProfileField label="Số điện thoại *" icon={<FaPhone />}>
                  <input
                    type="tel"
                    name="phone"
                    value={profile.phone || ""}
                    onChange={handleProfileChange}
                    placeholder="Nhập số điện thoại"
                  />
                </ProfileField>
              </ProfileSection>

              <ProfileSection
                title="Thông tin người thân"
                icon={<FaAddressBook />}
              >
                <ProfileField label="Số điện thoại bố *">
                  <input
                    type="tel"
                    name="fatherPhone"
                    value={profile.fatherPhone || ""}
                    onChange={handleProfileChange}
                    placeholder="Số điện thoại bố *"
                  />
                </ProfileField>

                <ProfileField label="Số điện thoại mẹ *">
                  <input
                    type="tel"
                    name="motherPhone"
                    value={profile.motherPhone || ""}
                    onChange={handleProfileChange}
                    placeholder="Số điện thoại mẹ"
                  />
                </ProfileField>
              </ProfileSection>

              <ProfileSection
                title="Thông tin địa chỉ"
                icon={<FaMapMarkerAlt />}
              >
                <ProfileField
                  full
                  label="Địa chỉ nhà *"
                  icon={<FaMapMarkerAlt />}
                >
                  <input
                    type="text"
                    name="address"
                    value={profile.address || ""}
                    onChange={handleProfileChange}
                    placeholder="Số nhà, tên đường..."
                  />
                </ProfileField>

                <ProfileField label="Tỉnh / Thành phố *">
                  <input
                    type="text"
                    name="province"
                    value={profile.province || ""}
                    onChange={handleProfileChange}
                    placeholder="Ví dụ: Đà Nẵng"
                  />
                </ProfileField>

                <ProfileField label="Quận / Huyện *">
                  <input
                    type="text"
                    name="district"
                    value={profile.district || ""}
                    onChange={handleProfileChange}
                    placeholder="Ví dụ: Hải Châu"
                  />
                </ProfileField>

                <ProfileField label="Phường / Xã *">
                  <input
                    type="text"
                    name="ward"
                    value={profile.ward || ""}
                    onChange={handleProfileChange}
                    placeholder="Nhập phường / xã"
                  />
                </ProfileField>
              </ProfileSection>

                            <ProfileSection
                title="Thông tin y tế cơ bản"
                icon={<FaNotesMedical />}
              >
                <ProfileField label="Nhóm máu *">
                  <select
                    name="bloodType"
                    value={profile.bloodType || ""}
                    onChange={handleProfileChange}
                  >
                    <option value="">Chọn nhóm máu</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </ProfileField>

                <ProfileField full label="Dị ứng *">
                  {/* Các dị ứng đã chọn */}
                  {allergyTags.length > 0 && (
                    <div className="allergy-selected-list">
                      {allergyTags.map((tag) => (
                        <span className="allergy-chip" key={tag}>
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeAllergyTag(tag)}
                            aria-label={`Xóa ${tag}`}
                          >
                            <FaTimes />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Dropdown chính: thiết kế cùng kiểu với Nhóm máu */}
                  <select
                    className="allergy-select"
                    value={allergySelect}
                    onChange={(e) => {
                      const value = e.target.value;
                      setAllergySelect(value);
                      addAllergyFromSelect(value);
                    }}
                  >
                    <option value="">Chọn loại dị ứng</option>
                    <option value="Không có">Không có dị ứng</option>

                    {ALLERGY_OPTIONS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </optgroup>
                    ))}

                    <option value="Khác">Khác — tự nhập</option>
                  </select>

                  {/* Chỉ hiện ô nhập khi bệnh nhân chọn Khác */}
                  {allergySelect === "Khác" && (
                    <div className="allergy-custom-box">
                      <input
                        type="text"
                        value={allergyInput}
                        onChange={(e) => setAllergyInput(e.target.value)}
                        onKeyDown={handleAllergyKeyDown}
                        placeholder="Nhập tác nhân dị ứng khác..."
                        autoFocus
                      />

                      <button
                        type="button"
                        onClick={addAllergyTag}
                        disabled={!allergyInput.trim()}
                      >
                        Thêm
                      </button>
                    </div>
                  )}

                  <div className="allergy-help-text">
                    Có thể chọn nhiều loại dị ứng. Nếu không tìm thấy trong
                    danh sách, chọn <strong>“Khác — tự nhập”</strong>.
                  </div>
                </ProfileField>

                <ProfileField full label="Tiền sử bệnh">
                  <textarea
                    name="medicalHistory"
                    value={profile.medicalHistory || ""}
                    onChange={handleProfileChange}
                    placeholder="Các bệnh đã từng mắc, phẫu thuật..."
                    rows="3"
                  />
                </ProfileField>

                <ProfileField full label="Bệnh nền hiện tại *">
                  <div className="chronic-options-grid">
                     {CHRONIC_DISEASE_OPTIONS.map((option) => (
                      <label
                        className={`chronic-option ${
                          chronicSelected.includes(option) ? "selected" : ""
                        }`}
                        key={option}
                      >
                        <input
                          type="checkbox"
                          checked={chronicSelected.includes(option)}
                          onChange={() => toggleChronicOption(option)}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>

                  <input
                    type="text"
                    className="chronic-other-input"
                    value={chronicOther}
                    onChange={(e) => handleChronicOtherChange(e.target.value)}
                    placeholder="Bệnh nền khác (nếu có)..."
                    disabled={chronicSelected.includes("Không có bệnh nền")}
                  />
                </ProfileField>
              </ProfileSection>

              <ProfileSection
                title="Người liên hệ khẩn cấp"
                icon={<FaExclamationTriangle />}
              >
                <ProfileField label="Họ tên người liên hệ">
                  <input
                    type="text"
                    name="emergencyContactName"
                    value={profile.emergencyContactName || ""}
                    onChange={handleProfileChange}
                    placeholder="Họ tên"
                  />
                </ProfileField>

                <ProfileField label="Quan hệ">
                  <input
                    type="text"
                    name="emergencyContactRelation"
                    value={profile.emergencyContactRelation || ""}
                    onChange={handleProfileChange}
                    placeholder="Ví dụ: Bố, mẹ, vợ/chồng..."
                  />
                </ProfileField>

                <ProfileField label="Số điện thoại">
                  <input
                    type="tel"
                    name="emergencyContactPhone"
                    value={profile.emergencyContactPhone || ""}
                    onChange={handleProfileChange}
                    placeholder="Số điện thoại"
                  />
                </ProfileField>
              </ProfileSection>

              <div className="profile-save-area">
                <button
                  type="button"
                  className="profile-save-btn"
                  onClick={saveProfile}
                  disabled={profileSaving || profileLoading}
                >
                  <FaSave />
                  {profileSaving ? "Đang lưu..." : "Lưu hồ sơ bệnh nhân"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {menu === "doctor-chat" && (
          <motion.div
            className="doctor-chat-page"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="doctor-chat-container">
              <div className="doctor-list-panel">
                <div className="doctor-list-header">
                  <div>
                    <h2>👨‍⚕️ Bác sĩ</h2>
                    <p>Chọn bác sĩ để trò chuyện</p>
                  </div>
                  <span className="doctor-count">{doctors.length}</span>
                </div>

                <div className="doctor-search">
                  <FaSearch />
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Tìm bác sĩ..."
                  />

                  {doctorSearch && (
                    <button
                      type="button"
                      onClick={() => setDoctorSearch("")}
                    >
                      <FaTimes />
                    </button>
                  )}
                </div>

                <div className="doctor-list">
                  {filteredDoctors.length > 0 ? (
                    filteredDoctors.map((doctor) => {
                      const doctorId = getId(doctor);
                      const selectedId = getId(selectedDoctor);
                      const isSelected =
                        String(selectedId) === String(doctorId);

                      return (
                        <button
                          type="button"
                          key={doctorId}
                          className={`doctor-item ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => selectDoctor(doctor)}
                        >
                          <div className="doctor-avatar">
                            {doctor.avatar ? (
                              <img
                                src={doctor.avatar}
                                alt={getDoctorName(doctor)}
                              />
                            ) : (
                              <FaUserMd />
                            )}
                            <span className="doctor-online-dot" />
                          </div>

                                                    <div className="doctor-info">
                            <h4>{getDoctorName(doctor)}</h4>
                            <p>
                              {doctor.lastMessage ||
                                doctor.specialty ||
                                doctor.specialization ||
                                "Bác sĩ"}
                            </p>
                          </div>

                          {doctor.unread > 0 && (
                            <span className="doctor-unread-badge">
                              {doctor.unread}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="doctor-empty">
                      <FaUserMd />
                      <h4>Không tìm thấy bác sĩ</h4>
                      <p>
                        Thử tìm kiếm với tên hoặc chuyên khoa khác.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="doctor-message-panel">
                {selectedDoctor ? (
                  <>
                    <div className="doctor-chat-header">
                      <div className="selected-doctor-avatar">
                        {selectedDoctor.avatar ? (
                          <img
                            src={selectedDoctor.avatar}
                            alt={getDoctorName(selectedDoctor)}
                          />
                        ) : (
                          <FaUserMd />
                        )}
                      </div>

                      <div>
                        <h3>{getDoctorName(selectedDoctor)}</h3>
                        <p>
                          <FaCircle />{" "}
                          {selectedDoctor.specialty ||
                            selectedDoctor.specialization ||
                            "Bác sĩ"}
                        </p>
                      </div>

                      <div className="doctor-header-actions">
                        {selectedDoctor.phone && (
                          <a
                            href={`tel:${selectedDoctor.phone}`}
                            className="doctor-call-btn"
                            title="Gọi bác sĩ"
                          >
                            <FaPhone />
                          </a>
                        )}
                      </div>
                    </div>

                    <div
                      ref={doctorChatBodyRef}
                      className="doctor-chat-body"
                      onScroll={handleDoctorChatScroll}
                    >
                      {doctorLoading ? (
                        <div className="doctor-chat-loading">
                          Đang tải cuộc trò chuyện...
                        </div>
                      ) : doctorMessages.length > 0 ? (
                        doctorMessages.map((msg, index) => {
                          const isUser = isCurrentUserMessage(msg);

                          return (
                            <div
                              key={msg._id || index}
                              className={`doctor-message ${
                                isUser ? "patient" : "doctor"
                              }`}
                            >
                              <div className="message-bubble">
                                {msg.content || msg.text ? (
                                  <div className="message-content">
                                    {msg.content || msg.text}
                                  </div>
                                ) : null}
                                {renderDoctorAttachment(msg.attachment)}
                                <div className="message-time">
                                  {formatTime(msg.createdAt)}
                                  {isUser &&
                                    (msg.read ? (
                                      <FaCheckDouble className="read" />
                                    ) : (
                                      <FaCheck />
                                    ))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="empty-doctor-chat">
                          <div className="empty-chat-icon">
                            <FaUserMd />
                          </div>
                          <h3>Bắt đầu trò chuyện</h3>
                          <p>
                            Bạn có thể gửi tin nhắn trực tiếp cho bác sĩ
                            đang được chọn.
                          </p>
                        </div>
                      )}

                      <div ref={doctorChatEndRef} aria-hidden="true" />
                    </div>

                    <div className="doctor-chat-composer">
                      {doctorAttachment && (
                        <div className="doctor-attachment-preview">
                          <div className="doctor-attachment-preview-icon">
                            {doctorAttachment.type.startsWith("image/") ? (
                              <FaImage />
                            ) : (
                              <FaFileAlt />
                            )}
                          </div>

                          <div className="doctor-attachment-preview-info">
                            <strong>{doctorAttachment.name}</strong>
                            <span>
                              {(doctorAttachment.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>

                          {doctorAttachment.type.startsWith("image/") && (
                            <img
                              src={doctorAttachment.dataUrl}
                              alt={doctorAttachment.name}
                            />
                          )}

                          <button
                            type="button"
                            className="doctor-attachment-remove"
                            onClick={removeDoctorAttachment}
                            title="Bỏ tệp đính kèm"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      )}

                      <div className="doctor-chat-input">
                        <button
                          type="button"
                          className="doctor-attach-btn"
                          onClick={() =>
                            doctorAttachmentInputRef.current?.click()
                          }
                          title="Đính kèm ảnh hoặc tệp"
                          aria-label="Đính kèm ảnh hoặc tệp"
                        >
                          <FaPaperclip />
                        </button>

                        <input
                          ref={doctorAttachmentInputRef}
                          type="file"
                          hidden
                          accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                          onChange={handleDoctorAttachmentChange}
                        />

                        <textarea
                          value={doctorMessageInput}
                          onChange={(e) =>
                            setDoctorMessageInput(e.target.value)
                          }
                          onKeyDown={handleDoctorKeyDown}
                          placeholder={`Nhắn tin cho ${getDoctorName(
                            selectedDoctor
                          )}...`}
                          rows="1"
                        />

                        <button
                          type="button"
                          onClick={sendDoctorMessage}
                          disabled={
                            !doctorMessageInput.trim() && !doctorAttachment
                          }
                          title="Gửi tin nhắn"
                        >
                          <FaPaperPlane />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="no-doctor-selected" style={{ width: "100%", height: "100%", minHeight: "420px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px", boxSizing: "border-box" }}>
                    <div className="no-doctor-icon">
                      <FaUserMd />
                    </div>
                    <h2>Trò chuyện với bác sĩ</h2>
                    <p>
                      Hãy chọn một bác sĩ ở danh sách bên trái để bắt đầu
                      cuộc trò chuyện.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {menu === "advices" && (
          <div className="ai-analysis-box">
            <div className="analysis-header">
              <div className="analysis-avatar">
                <FaEnvelope />
              </div>
              <div>
                <h2>Lời khuyên từ bác sĩ</h2>
                <p>Tin nhắn và hướng dẫn sức khỏe từ bác sĩ.</p>
              </div>
            </div>

            <div className="analysis-grid">
              {advices.length > 0 ? (
                advices.map((item, index) => (
                  <div className="analysis-item" key={item._id || index}>
                    <div className="analysis-icon blue">
                      <FaUserMd />
                    </div>
                    <div>
                      <h4>{item.title || "Lời khuyên"}</h4>
                      <p>{item.message || item.content || ""}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>Chưa có lời khuyên nào.</p>
              )}
            </div>
          </div>
        )}

        {menu === "health" && (
          <motion.div
            className="health-form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="health-glow" />

            <h2 className="health-title">🩺 Nhập dữ liệu sức khỏe</h2>
            <p className="health-subtitle">
              Nhập các chỉ số hiện tại để theo dõi sức khỏe.
            </p>

            <div className="form-grid">
              <HealthInput
                label="Chiều cao (cm)"
                icon={<FaRulerVertical />}
                placeholder="Ví dụ: 175"
                type="number"
                value={form.height}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, height: value }))
                }
              />

              <HealthInput
                label="Cân nặng (kg)"
                icon="⚖️"
                placeholder="Ví dụ: 70"
                type="number"
                value={form.weight}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, weight: value }))
                }
              />

              <div className="input-card">
                <div className="input-label">⚖️ BMI</div>
                <div className="health-input bmi-display">
                  {calculatedBMI || "Nhập chiều cao + cân nặng"}
                </div>
              </div>

              <HealthInput
                label="Glucose"
                icon="🩸"
                placeholder="Ví dụ: 90"
                type="number"
                value={form.glucose}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, glucose: value }))
                }
              />

              <HealthInput
                label="Huyết áp"
                icon="❤️"
                placeholder="Ví dụ: 120/80"
                type="text"
                value={form.bloodPressure}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    bloodPressure: value,
                  }))
                }
              />

              <HealthInput
                label="Nhịp tim"
                icon="💓"
                placeholder="Ví dụ: 80"
                type="number"
                value={form.heartRate}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    heartRate: value,
                  }))
                }
              />
            </div>

            {calculatedBMI && (
              <div className="bmi-info-box">
                <strong>BMI hiện tại: {calculatedBMI}</strong>
                <br />
                <small>
                  BMI được tự động tính từ chiều cao và cân nặng.
                </small>
              </div>
            )}

            <button type="button" className="save-btn" onClick={saveHealth}>
              🚀 Lưu dữ liệu
            </button>
          </motion.div>
        )}

        {menu === "analytics" && (
          <>
            <div className="chart-card">
              <h2>📈 Biểu đồ sức khỏe</h2>
              <DashboardChart data={data} />
            </div>

            <div className="chart-card">
              <h2>📋 Lịch sử sức khỏe</h2>

              <div className="table-responsive">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Chiều cao</th>
                      <th>Cân nặng</th>
                      <th>BMI</th>
                      <th>Glucose</th>
                      <th>Huyết áp</th>
                      <th>Nhịp tim</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.length > 0 ? (
                      data.map((item, i) => (
                        <tr key={item._id || i}>
                          <td>{formatDate(item.createdAt)}</td>
                          <td>{item.height} cm</td>
                          <td>{item.weight} kg</td>
                          <td>{item.bmi}</td>
                          <td>{item.glucose}</td>
                          <td>
                            {item.systolic}/{item.diastolic}
                          </td>
                          <td>{item.heartRate}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="empty-table">
                          Chưa có dữ liệu sức khỏe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {menu === "ai" && (
          <motion.div
            className="chat-wrapper"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="chat-header">
              <div className="chat-assistant-mark" aria-hidden="true">✚</div>
              <div className="chat-assistant-heading">
                <strong>Trợ lý sức khỏe DOCTIS</strong>
                <span>Kiến thức và chăm sóc đái tháo đường type 2</span>
              </div>
              <span className="chat-assistant-status"><i /> Kiến thức type 2</span>
            </div>

            <div className="chat-body">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={
                    msg.sender === "user"
                      ? "chat-message user"
                      : `chat-message ai${msg.isError ? " error" : ""}`
                  }
                >
                  {msg.text}
                </div>
              ))}

              {loading && (
                <div className="chat-message ai thinking">
                  🤖 AI đang phân tích sức khỏe...
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <div className="chat-assistant-sources">
              Tham khảo: {" "}
              <a href="https://www.niddk.nih.gov/health-information/diabetes/overview/managing-diabetes/" target="_blank" rel="noreferrer">NIDDK</a>
              {" · "}
              <a href="https://diabetes.org/living-with-diabetes/hypoglycemia-low-blood-glucose/symptoms-treatment" target="_blank" rel="noreferrer">Hiệp hội Đái tháo đường Hoa Kỳ</a>
            </div>

            <div className="chat-input-box">
              <input
                type="text"
                placeholder="Hỏi về đường huyết, bữa ăn, vận động, thuốc..."
                maxLength={1200}
                aria-label="Nhập câu hỏi về đái tháo đường type 2"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={loading || !chatInput.trim()}
              >
                {loading ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </motion.div>
        )}

                {menu === "care-plan" && (
          <motion.div
            className="care-plan-page care-plan-v6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <section className="care-hero-v6">
              <div className="care-hero-glow care-hero-glow-a" />
              <div className="care-hero-glow care-hero-glow-b" />
              <div className="care-hero-main">
                <div className="care-hero-icon"><FaUtensils /></div>
                <div>
                  <span className="care-kicker">DOCTIS • DAILY WELLNESS</span>
                  <h2>Kế hoạch chăm sóc hằng ngày</h2>
                  <p>Lịch 7 ngày được cá nhân hóa từ chỉ số sức khỏe, dinh dưỡng, vận động và đơn thuốc đã được bác sĩ xác nhận.</p>
                  <div className="care-hero-tags">
                    <span>🤖 AI cá nhân hóa</span>
                    <span>🥗 Dinh dưỡng</span>
                    <span>🏃 Vận động</span>
                    <span>💊 Theo đơn bác sĩ</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="generate-plan-btn care-generate-v6"
                onClick={handleGeneratePlan}
                disabled={nutritionLoading || nutritionMissingFields.length > 0}
              >
                <span>{nutritionLoading ? "Đang xây dựng..." : nutritionPlan ? "Tạo lại kế hoạch" : "Tạo kế hoạch 7 ngày"}</span>
                <b>{nutritionLoading ? "•••" : "✦"}</b>
              </button>
            </section>

            <section className="care-health-strip-v6">
              <div className="care-health-card bmi">
                <span className="care-health-icon">⚖️</span>
                <div><small>BMI</small><strong>{latest?.bmi || 0}</strong></div>
                <em>Theo dõi</em>
              </div>
              <div className="care-health-card glucose">
                <span className="care-health-icon">🩸</span>
                <div><small>Glucose</small><strong>{latest?.glucose || 0}<i> mg/dL</i></strong></div>
                <em>Gần nhất</em>
              </div>
              <div className="care-health-card pressure">
                <span className="care-health-icon">💗</span>
                <div><small>Huyết áp</small><strong>{latest?.systolic ? `${latest.systolic}/${latest.diastolic}` : "0/0"}</strong></div>
                <em>mmHg</em>
              </div>
              <div className="care-health-card allergy">
                <span className="care-health-icon">🛡️</span>
                <div><small>Dị ứng</small><strong>{profile.allergies || "Chưa cập nhật"}</strong></div>
                <em>Đã lưu</em>
              </div>
              <div className="care-health-card chronic">
                <span className="care-health-icon">🫀</span>
                <div><small>Bệnh nền</small><strong>{profile.chronicDiseases || "Không có"}</strong></div>
                <em>Hồ sơ</em>
              </div>
            </section>

            <section className="care-week-shell-v6 doctor-approved-plan">
              <div className="care-section-head-v6">
                <div><span className="care-section-kicker">KẾ HOẠCH BÁC SĨ</span><h3>Kế hoạch chăm sóc đã chốt</h3></div>
                <span>{doctorCarePlan ? "Đã đồng bộ" : "Chưa có kế hoạch"}</span>
              </div>
              {doctorCarePlan ? (
                <>
                  {doctorCarePlan.doctorNote && <p>{doctorCarePlan.doctorNote}</p>}
                  <div className="care-week">
                    {(Array.isArray(doctorCarePlan.days) ? doctorCarePlan.days : []).map((day) => (
                      <div className="care-day" key={`${day.dayIndex}-${day.label}`}>
                        <div className="care-day-head"><span>Ngày {Number(day.dayIndex) + 1}</span><strong>{day.label}</strong></div>
                        {(Array.isArray(day.items) ? day.items : []).map((item) => (
                          <div className="care-item" key={item.id || `${day.dayIndex}-${item.time}-${item.title}`}>
                            <span className="care-time">{item.time}</span>
                            <div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}<small>{item.type || "NOTE"}</small></div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              ) : <p>Bác sĩ chưa chốt kế hoạch chăm sóc cho bạn.</p>}
            </section>

            {nutritionMissingFields.length > 0 && (
              <div className="care-alert-v6 warning">
                <span className="care-alert-icon"><FaExclamationTriangle /></span>
                <div><strong>Chưa đủ dữ liệu để tạo kế hoạch</strong><p>Cần bổ sung: {nutritionMissingFields.join(", ")}.</p></div>
                <button type="button" onClick={() => setMenu("health")}>Cập nhật ngay →</button>
              </div>
            )}

            {prescriptionError && (
              <div className="care-alert-v6 info">
                <span className="care-alert-icon">💊</span>
                <div><strong>Đơn thuốc chưa đồng bộ</strong><p>Khi bác sĩ chốt đơn, thuốc sẽ tự động xuất hiện trong lịch 7 ngày.</p></div>
              </div>
            )}

            {careWeek.length > 0 && (
              <section className="care-week-shell-v6">
                <div className="care-section-head-v6">
                  <div>
                    <span className="care-section-kicker">LỊCH TUẦN</span>
                    <h3>Tuần chăm sóc của bạn</h3>
                    <p>Chọn một ngày để xem chi tiết. Mỗi thẻ có thể đánh dấu hoàn thành trực tiếp.</p>
                  </div>
                  <div className="care-week-progress-v6">
                    <span>TIẾN ĐỘ TUẦN</span>
                    <strong>
                      {careWeek.reduce((sum, day) => {
                        const items = [...(day.meals || []), ...(day.medications || []), day.exercise].filter(Boolean);
                        return sum + items.filter((item) => item.done).length;
                      }, 0)} / {careWeek.reduce((sum, day) => sum + (day.meals || []).length + (day.medications || []).length + (day.exercise ? 1 : 0), 0)}
                    </strong>
                  </div>
                </div>

                <div className="care-week-grid-v6">
                  {careWeek.map((day, dayIndex) => {
                    const activities = [
                      ...(day.meals || []).map((item) => ({ ...item, kind: "meal" })),
                      ...(day.medications || []).map((item) => ({ ...item, kind: "medication" })),
                      day.exercise ? { ...day.exercise, kind: "exercise", description: day.exercise.duration } : null,
                    ].filter(Boolean).sort((a, b) => String(a.time).localeCompare(String(b.time)));
                    const doneCount = activities.filter((item) => item.done).length;
                    const progress = activities.length ? Math.round((doneCount / activities.length) * 100) : 0;

                    return (
                      <article
                        className={`care-day-card-v6 ${activeDay === dayIndex ? "active" : ""}`}
                        key={day.label || dayIndex}
                      >
                        <button type="button" className="care-day-card-head" onClick={() => setActiveDay(dayIndex)}>
                          <span className="care-day-number">{String(dayIndex + 1).padStart(2, "0")}</span>
                          <span className="care-day-name"><b>{day.label || `Ngày ${dayIndex + 1}`}</b><small>{doneCount}/{activities.length} việc</small></span>
                          <span className="care-day-percent">{progress}%</span>
                        </button>
                        <div className="care-day-progress"><span style={{ width: `${progress}%` }} /></div>
                        <div className="care-day-items-v6">
                          {activities.map((item) => (
                            <button
                              type="button"
                              className={`care-item-v6 ${item.kind} ${item.done ? "completed" : ""}`}
                              key={`${item.id}-${item.time}`}
                              onClick={() => { setActiveDay(dayIndex); toggleCareActivity(dayIndex, item.id); }}
                            >
                              <span className="care-item-time-v6">{item.time}</span>
                              <span className="care-item-icon-v6">{item.icon}</span>
                              <span className="care-item-copy-v6">
                                <b>{item.title || item.label}</b>
                                <small>{item.text || item.description || ""}</small>
                              </span>
                              <span className="care-item-check-v6">{item.done ? "✓" : ""}</span>
                            </button>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {!nutritionPlan && !nutritionLoading && (
              <section className="care-empty-v6">
                <div className="care-empty-orb">✦</div>
                <span className="care-section-kicker">BẮT ĐẦU HÔM NAY</span>
                <h3>Tạo lịch chăm sóc 7 ngày của riêng bạn</h3>
                <p>DOCTIS sẽ kết hợp dữ liệu sức khỏe gần nhất, hồ sơ dị ứng/bệnh nền và đơn thuốc đã chốt để tạo một lịch dễ theo dõi.</p>
                <button type="button" className="generate-plan-btn" onClick={handleGeneratePlan} disabled={nutritionMissingFields.length > 0}>✨ Bắt đầu tạo kế hoạch</button>
              </section>
            )}

            {nutritionLoading && (
              <section className="care-loading-v6">
                <div className="care-loading-orbit"><span>✦</span></div>
                <div><strong>DOCTIS đang xây dựng lịch cho bạn</strong><p>Đang phân tích thể trạng và sắp xếp ăn uống, vận động, thuốc theo thời gian trong ngày...</p></div>
              </section>
            )}

            {nutritionPlan && !nutritionLoading && careWeek[activeDay] && (
              <section className="care-detail-shell-v6">
                <div className="care-detail-head-v6">
                  <div>
                    <span className="care-section-kicker">CHI TIẾT NGÀY</span>
                    <h3>{careWeek[activeDay].label}</h3>
                    <p>{careWeek[activeDay].summary || nutritionPlan.summaryNote || "Lịch chăm sóc được cá nhân hóa cho hôm nay."}</p>
                  </div>
                  <div className="care-source-v6"><span>🤖</span> AI + <span>👨‍⚕️</span> Đơn đã chốt</div>
                </div>

                <div className="care-detail-list-v6">
                  {[
                    ...(careWeek[activeDay].meals || []).map((item) => ({ ...item, kind: "meal" })),
                    ...(careWeek[activeDay].medications || []).map((item) => ({ ...item, kind: "medication" })),
                    careWeek[activeDay].exercise ? { ...careWeek[activeDay].exercise, kind: "exercise", description: careWeek[activeDay].exercise.duration } : null,
                  ].filter(Boolean).sort((a, b) => String(a.time).localeCompare(String(b.time))).map((item) => {
                    const reminderId = `${careWeek[activeDay]?.label || "day"}-${item.id || item.time}`;
                    const sent = emailRemindedIds.has(reminderId);
                    return (
                      <div className={`care-detail-row-v6 ${item.kind} ${item.done ? "completed" : ""}`} key={`${item.id}-${item.time}`}>
                        <div className="care-detail-time-v6">{item.time}</div>
                        <div className="care-detail-icon-v6">{item.icon}</div>
                        <div className="care-detail-content-v6">
                          <div className="care-detail-title-v6"><h4>{item.title || item.label}</h4><span>{item.kind === "meal" ? "Ăn uống" : item.kind === "medication" ? "Thuốc" : "Vận động"}</span></div>
                          <p>{item.text || item.description || ""}</p>
                          {item.source === "DOCTOR" && <small>👨‍⚕️ Theo đơn bác sĩ</small>}
                        </div>
                        <div className="care-detail-actions-v6">
                          <button type="button" className={`care-reminder-btn ${sent ? "sent" : ""}`} onClick={() => handleEmailReminder(careWeek[activeDay], item, activeDay)} disabled={reminderSendingId === reminderId}>
                            <FaBell /> {reminderSendingId === reminderId ? "Đang tạo..." : sent ? "Đã bật email" : "Nhắc email"}
                          </button>
                          <button type="button" className="care-done-btn" onClick={() => toggleCareActivity(activeDay, item.id)}>{item.done ? "✓ Đã xong" : "Đánh dấu xong"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="prescription-panel prescription-panel-v6">
              <div className="prescription-panel-header">
                <div><span className="care-section-kicker">BÁC SĨ</span><h3>Đơn thuốc đã chốt</h3><p>Chỉ đơn đã được xác nhận mới được tự động đưa vào thời khóa biểu.</p></div>
                <span>{prescriptionLoading ? "Đang tải..." : `${prescriptions.filter(isConfirmedPrescription).length} đơn đã chốt`}</span>
              </div>
              {prescriptions.filter(isConfirmedPrescription).length > 0 ? (
                prescriptions.filter(isConfirmedPrescription).map((rx, index) => (
                  <div className="prescription-card prescription-card-v6" key={getId(rx) || index}>
                    <div className="prescription-med-icon">💊</div>
                    <div><strong>{rx.title || rx.name || `Đơn thuốc ${index + 1}`}</strong><span>{rx.doctorId?.fullName || rx.doctor?.fullName || "Bác sĩ điều trị"}</span></div>
                    <div className="prescription-status">✓ Đã chốt</div>
                  </div>
                ))
              ) : (
                <div className="prescription-empty prescription-empty-v6"><span>💊</span><div><strong>Chưa có đơn thuốc đã chốt</strong><p>Khi bác sĩ kê và xác nhận đơn, thuốc sẽ tự động xuất hiện trong lịch ăn uống + vận động.</p></div></div>
              )}
            </section>
          </motion.div>
        )}

        {menu === "appointments" && (
          <div className="ai-analysis-box">
            <div className="analysis-header">
              <div className="analysis-avatar">
                <FaCalendarCheck />
              </div>
              <div>
                <h2>Lịch hẹn khám</h2>
                <p>Danh sách lịch hẹn với bác sĩ.</p>
              </div>
            </div>

            <div className="analysis-grid">
              {appointments.length > 0 ? (
                appointments.map((item, index) => (
                  <div
                    className="analysis-item"
                    key={item._id || index}
                  >
                    <div className="analysis-icon blue">
                      <FaClock />
                    </div>

                    <div>
                      <h4>{formatDate(item.appointmentDate)}</h4>

                      <div className="doctor-row">
                        <FaUserMd className="doctor-icon" />
                        <span className="doctor-name">
                          {item.doctorId?.fullName ||
                            item.doctorId?.username ||
                            "Chưa cập nhật"}
                        </span>
                      </div>

                      <p>
                        <strong>Giờ khám:</strong>{" "}
                        {formatTime(item.appointmentDate)}
                      </p>

                      <p>
                        <strong>Loại:</strong>{" "}
                        {item.type || "Chưa cập nhật"}
                      </p>

                      <p>
                        <strong>Trạng thái:</strong>{" "}
                        {item.status || "Chưa cập nhật"}
                      </p>

                      {item.note && (
                        <div className="doctor-note">
                          <strong>Nội dung bác sĩ:</strong>
                          <p>{item.note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p>Chưa có lịch hẹn nào.</p>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

function ProfileSection({ title, icon, children }) {
  return (
    <div className="profile-section">
      <div className="profile-section-title">
        {icon}
        <span>{title}</span>
      </div>

      <div className="profile-form-grid">{children}</div>
    </div>
  );
}

function ProfileField({ label, icon, full = false, children }) {
  return (
    <div className={`profile-field ${full ? "full" : ""}`}>
      <label>{label}</label>

      {icon ? (
        <div className="profile-input-wrap">
          {icon}
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function HealthInput({
  label,
  icon,
  placeholder,
  type,
  value,
  onChange,
}) {
  return (
    <div className="input-card">
      <div className="input-label">
        {icon}
        {label}
      </div>

      <input
        className="health-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
