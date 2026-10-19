import { ConversationBack, ConversationNotice, useConversationViewport } from "../../components/ConversationViewport";
import useSavedCarePlan from "../../components/useSavedCarePlan";
import { careDaysToWeek, weekToCareDays, careSnapshotChanged, vietnamDay } from "../../utils/savedCarePlan";
import "../../CSS/saved-care-plan.css";
import PrescriptionPanel from "../../components/PrescriptionPanel";
import HealthAnalytics from "../../components/HealthAnalytics";
import CareScene from "../../components/CareScene";
import { Children, cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  FaEnvelope,
  FaBell,
  FaCalendarCheck,
  FaUserMd,
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
  FaUtensils,
  FaCheck,
  FaCheckDouble,
  FaBars,
  FaChevronDown,
} from "react-icons/fa";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import API from "../../services/api";
import PatientOverview from "../../components/PatientOverview";
import { useConversationMotion } from "../../components/ConversationMotion";
import { useWorkspaceMotion } from "../../components/WorkspaceMotion";
import useLiveReducedMotion from "../../components/useLiveReducedMotion";
import { useStudioPreferences } from "../../components/studio/StudioPreferences";
import StudioControls from "../../components/studio/StudioControls";
import StudioExperience from "../../components/studio/StudioExperience";
import HeartScene from "../../components/3d/HeartScene";
import AppointmentCalendar from "../../components/studio/AppointmentCalendar";
import CareTeamPanel from "../../components/coordination/CareTeamPanel";
import NotificationInbox from "../../components/coordination/NotificationInbox";
import CareWeekGallery from "../../components/studio/CareWeekGallery";
import AIWorkspace from "../../components/studio/AIWorkspace";

import "../../CSS/conversation-studio.css";
import "../../CSS/dashboard.css";
import "../../CSS/dashboard-modern.css";
import "../../CSS/health-clarity.css";
import "../../CSS/health-studio.css";
import "../../CSS/patient-redesign.css";

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

const appointmentStatusLabel = (status) => {
  const labels = {
    pending: "Chờ xác nhận",
    approved: "Đã xác nhận",
    completed: "Đã khám",
    cancelled: "Đã hủy",
  };
  const key = String(status || "").toLowerCase();
  return labels[key] || status || "Chưa cập nhật";
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
  const reducedMotion = useLiveReducedMotion();
  const preferences = useStudioPreferences();
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [profileReadOnly, setProfileReadOnly] = useState(false);
  useEffect(() => { if (preferences.sidebarCollapsed) setCollapsedGroups({}); }, [preferences.sidebarCollapsed]);

  const [menu, setMenuState] = useState("dashboard");
  const { screenRef, navigate: setMenu } = useWorkspaceMotion(menu, setMenuState);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState([]);
  const [latest, setLatest] = useState({});
  const [advices, setAdvices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [careTeamRefresh, setCareTeamRefresh] = useState(0);
  const [focusAppointmentId, setFocusAppointmentId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);



  const [profile, setProfile] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveFeedback, setProfileSaveFeedback] = useState(null);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSaveFeedback, setHealthSaveFeedback] = useState(null);

  const [doctors, setDoctors] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorMessages, setDoctorMessages] = useState([]);
  const [doctorMessageInput, setDoctorMessageInput] = useState("");
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorAttachment, setDoctorAttachment] = useState(null);

    const [apiErrors, setApiErrors] = useState({});
  const [healthLoading, setHealthLoading] = useState(true);

  // Bệnh nền (multi-select) + Dị ứng (tag input)
  const [chronicSelected, setChronicSelected] = useState([]);
  const [chronicOther, setChronicOther] = useState("");
  const [allergyTags, setAllergyTags] = useState([]);
  const [allergyInput, setAllergyInput] = useState("");
  const [allergySelect, setAllergySelect] = useState("");

  // Dinh dưỡng

  const [activeDay, setActiveDay] = useState(0);

  // Kế hoạch chăm sóc hằng ngày

  const [doctorCarePlan, setDoctorCarePlan] = useState(null);

  // Nhắc qua email cho từng hoạt động trong kế hoạch chăm sóc.
  const [reminderSendingId, setReminderSendingId] = useState("");
  const [emailRemindedIds, setEmailRemindedIds] = useState(() => new Set());


  useEffect(() => {
    let active = true;
    API.get("/care-plans/my")
      .then((res) => { if (active) setDoctorCarePlan(res.data || null); })
      .catch((err) => {
        if (active && err.response?.status !== 404) if (process.env.NODE_ENV !== "production") console.error("GET CONFIRMED CARE PLAN ERROR =", err);
        if (active) setDoctorCarePlan(null);
      });
    return () => { active = false; };
  }, []);

  // Đơn thuốc: chỉ hiển thị đơn đã được xác nhận/kích hoạt.
  // Backend Doctor Page có thể cung cấp dữ liệu qua /prescriptions/my.
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState(false);  const doctorChatEndRef = useRef(null);
  const doctorChatBodyRef = useRef(null);
  const doctorChatStickToBottomRef = useRef(true);
  useConversationMotion(doctorChatBodyRef, selectedDoctor?._id || selectedDoctor?.id, doctorMessages, doctorLoading);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const doctorViewport = useConversationViewport(doctorChatBodyRef, getId(selectedDoctor), doctorMessages, menu === "doctor-chat", doctorLoading);  const doctorAttachmentInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const profileRef = useRef({});
  const [savedCareProfile, setSavedCareProfile] = useState(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);


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
      if (process.env.NODE_ENV !== "production") console.error("FETCH HEALTH ERROR =", err);
      setApiErrors((prev) => ({ ...prev, health: true }));
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchAdvices = useCallback(async () => {
    try {
      const res = await API.get("/health/advices");
      setAdvices(Array.isArray(res.data) ? res.data : []);
      setApiErrors((prev) => ({ ...prev, advices: false }));
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("FETCH ADVICES ERROR =", err);
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
      if (process.env.NODE_ENV !== "production") console.error("FETCH APPOINTMENTS ERROR =", err);
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
      setSavedCareProfile(profileData);

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
        province: profileData.province ?? profileData.city ?? "",
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
      if (process.env.NODE_ENV !== "production") console.error("FETCH PROFILE ERROR =", err);
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
      if (process.env.NODE_ENV !== "production") console.warn("FETCH PRESCRIPTIONS INFO =", err);
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
      if (process.env.NODE_ENV !== "production") console.error("FETCH DOCTORS ERROR =", err);

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
        behavior: reducedMotion ? "instant" : "smooth",
      });
    });
  }, [doctorMessages, menu, reducedMotion]);

  const handleDoctorChatScroll = (event) => {
    doctorViewport.onScroll(event);
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
  const enteredRisk = getRiskAssessment({ glucose:form.glucose, bmi:calculatedBMI, heartRate:form.heartRate, systolic:form.bloodPressure.split("/")[0] || "", diastolic:form.bloodPressure.split("/")[1] || "" });
  const enteredCount = Object.values(form).filter(value => String(value).trim()).length;

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
      if (process.env.NODE_ENV !== "production") console.error("AI ANALYSIS ERROR =", err);
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
    if (!String(savedCareProfile?.allergies || "").trim()) missing.push("Dị ứng đã lưu");
    if (!String(savedCareProfile?.chronicDiseases || "").trim()) {
      missing.push("Bệnh nền hiện tại");
    }

    return missing;
  }, [latest, savedCareProfile]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileSaveFeedback(null);
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const updateHealthField = (field, value) => {
    setHealthSaveFeedback(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

    const toggleChronicOption = (option) => {
    setProfileSaveFeedback(null);
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
    setProfileSaveFeedback(null);
    setChronicOther(value);
    const combined = [...chronicSelected, value.trim()]
      .filter(Boolean)
      .join(", ");
    setProfile((prev) => ({ ...prev, chronicDiseases: combined }));
  };

  const syncAllergyProfile = (nextTags) => {
    setProfileSaveFeedback(null);
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
    setProfileSaveFeedback(null);
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

  const savedCare = useSavedCarePlan();
  const nutritionPlan = savedCare.plan;
  const nutritionLoading = savedCare.saving;
  const careWeek = useMemo(() => careDaysToWeek(savedCare.plan?.days), [savedCare.plan]);
  const [deferredCareSnapshot, setDeferredCareSnapshot] = useState("");
  const careSnapshotKey = JSON.stringify([latest?._id,latest?.updatedAt,savedCareProfile?.allergies,savedCareProfile?.chronicDiseases]);
  const careNeedsRefresh = nutritionPlan && careSnapshotChanged(nutritionPlan.inputSnapshot, latest, savedCareProfile) && deferredCareSnapshot !== careSnapshotKey;
  const careExpired = nutritionPlan?.endDate && vietnamDay() > nutritionPlan.endDate;

  const handleGeneratePlan = async () => {
    if (savedCare.loading || savedCare.saving || !savedCare.ready) return;
    if (nutritionMissingFields.length > 0) {
      alert('Vui lòng cập nhật: ' + nutritionMissingFields.join(', ') + '.');
      return;
    }
    if (nutritionPlan && !window.confirm('Tạo lại kế hoạch chăm sóc? Kế hoạch hiện tại và tiến độ sẽ được lưu vào lịch sử, rồi thay bằng kế hoạch mới.')) return;
    const generated = generateNutritionPlan({ latest, profile: savedCareProfile });
    const days = weekToCareDays(buildCareWeek(generated, prescriptions));
    if (await savedCare.create(days, {healthRecordId:latest?._id || null,allergies:savedCareProfile?.allergies || "",chronicDiseases:savedCareProfile?.chronicDiseases || ""})) { setActiveDay(0);setDeferredCareSnapshot(""); }
  };
  const toggleCareActivity = savedCare.toggle;

  const handleEmailReminder = async (day, item) => {
    const activityId = `${nutritionPlan?._id}:${day?.date}:${item?.id || item?.time}`;
    const email = String(profile?.email || user?.email || "").trim();

    if (!email) {
      alert("Bạn chưa có email trong hồ sơ. Vui lòng cập nhật email trước khi bật nhắc nhở.");
      return;
    }

    if (!item?.time) {
      alert("Hoạt động này chưa có giờ để tạo nhắc nhở.");
      return;
    }
    if (!day?.date) {
      alert("Kế hoạch cũ chưa có ngày bắt đầu. Hãy tạo kế hoạch mới trước khi bật nhắc email.");
      return;
    }

    if (emailRemindedIds.has(activityId) || reminderSendingId === activityId) return;

    setReminderSendingId(activityId);

    try {
      const scheduleDate = day.date;
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
      if (process.env.NODE_ENV !== "production") console.error("SEND CARE EMAIL REMINDER ERROR =", err);
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
    setProfileSaveFeedback(null);

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
      setSavedCareProfile(mergedProfile);

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

      setProfileSaveFeedback({ type: "success", text: "Hồ sơ đã được lưu." });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("SAVE PROFILE ERROR =", err);
      setProfileSaveFeedback({
        type: "error",
        text: err.response?.data?.msg || err.response?.data?.message || "Cập nhật hồ sơ thất bại. Vui lòng thử lại.",
      });
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

      setHealthSaving(true);
      setHealthSaveFeedback(null);
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

      setHealthSaveFeedback({
        type: "success",
        text: `Đã lưu dữ liệu sức khỏe. BMI: ${res.data?.bmi ?? calculatedBMI}`,
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("SAVE HEALTH ERROR =", err);
      setHealthSaveFeedback({
        type: "error",
        text: err.response?.data?.msg || err.response?.data?.message || "Lưu dữ liệu thất bại. Vui lòng thử lại.",
      });
    } finally {
      setHealthSaving(false);
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
      if (process.env.NODE_ENV !== "production") console.error("FETCH DOCTOR MESSAGES ERROR =", err);
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
      if (process.env.NODE_ENV !== "production") console.error("SEND DOCTOR MESSAGE ERROR =", err);

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
    {
      key: "advices",
      icon: <FaEnvelope />,
      label: "Lời khuyên bác sĩ",
    },
  ];

  menus.push({ key: "care-team", icon: <FaUserMd />, label: "Bệnh viện và bác sĩ phụ trách" });

  const navGroups = [
    { label: "CÁ NHÂN", items: ["dashboard", "profile"] },
    { label: "THEO DÕI SỨC KHỎE", items: ["health", "analytics", "ai"] },
    { label: "ĐIỀU TRỊ & KẾT NỐI", items: ["care-team", "care-plan", "appointments", "doctor-chat", "advices"] },
  ];
  const pageMeta = {
    dashboard: ["Tổng quan sức khỏe", "Các chỉ số và hoạt động chăm sóc gần nhất của bạn."],
    "care-team": ["Bệnh viện và bác sĩ phụ trách", "Thông tin điều phối, tiếp nhận và bác sĩ đang theo dõi bạn."],
    profile: ["Hồ sơ bệnh nhân", "Thông tin cá nhân, liên hệ và tiền sử y tế."],
    health: ["Nhập dữ liệu sức khỏe", "Ghi lại chỉ số đo để cập nhật lịch sử theo dõi."],
    analytics: ["Biểu đồ & lịch sử", "Theo dõi các lần ghi nhận sức khỏe của bạn."],
    ai: ["DOCTIS AI", "Trao đổi về theo dõi và chăm sóc sức khỏe."],
    "care-plan": ["Kế hoạch chăm sóc", "Lịch ăn uống, vận động và thuốc theo dữ liệu hiện có."],
    appointments: ["Lịch hẹn khám", "Các buổi hẹn với bác sĩ phụ trách."],
    "doctor-chat": ["Trò chuyện bác sĩ", "Trao đổi trực tiếp với bác sĩ của bạn."],
    advices: ["Lời khuyên bác sĩ", "Tin nhắn và hướng dẫn được gửi đến bạn."],
  };
  const [pageTitle, pageDescription] = pageMeta[menu] || pageMeta.dashboard;
  const displayName = profile.fullName || user?.fullName || user?.username || "Tài khoản";
  const nextAppointment = useMemo(() => appointments
    .filter((item) => ["pending", "approved"].includes(item.status) && item?.appointmentDate && new Date(item.appointmentDate).getTime() >= Date.now())
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))[0] || null,
  [appointments]);



  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}><div className="dashboard-layout doctis-v5 health-studio-layout" data-studio-theme={preferences.theme} data-studio-simple={preferences.simpleUI} data-sidebar-collapsed={preferences.sidebarCollapsed}>
      <aside className={`studio-sidebar ${mobileMenuOpen ? "is-open" : ""}`} aria-label="Điều hướng DOCTIS">
        <button type="button" className="studio-brand" onClick={() => { setMenu("dashboard"); setMobileMenuOpen(false); }}>
          <span className="studio-brand-mark"><FaHeartbeat /></span>
          <span><strong>DOCTIS</strong><small>HEALTH STUDIO</small></span>
        </button>
        <div className="studio-sidebar-caption">KHÔNG GIAN CỦA BẠN</div>
        <nav className="studio-nav" aria-label="Điều hướng chính">
          {navGroups.map((group) => (
            <div className="studio-nav-group" key={group.label}>
              <button type="button" className="studio-nav-heading studio-group-toggle" aria-expanded={!collapsedGroups[group.label]} onClick={() => setCollapsedGroups(current => ({...current,[group.label]:!current[group.label]}))}>{group.label}<FaChevronDown aria-hidden="true" /></button>
              <motion.div className="studio-nav-group-items" initial={false} animate={{height:collapsedGroups[group.label] ? 0 : "auto",opacity:collapsedGroups[group.label] ? 0 : 1}} transition={{duration:reducedMotion ? 0 : .2}} inert={!!collapsedGroups[group.label]}>
              {group.items.map((key) => {
                const item = menus.find((navItem) => navItem.key === key);
                if (!item) return null;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={`studio-nav-item ${menu === item.key ? "is-active" : ""}`}
                    title={item.label}
                    onClick={() => { setMenu(item.key); setMobileMenuOpen(false); }}
                    aria-current={menu === item.key ? "page" : undefined}
                  >
                    <span className="studio-nav-icon">{item.icon}</span>
                    <span>{item.label}</span>
                    {menu === item.key && <motion.i layoutId="studio-nav-indicator" className="studio-nav-indicator" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                  </button>
                );
              })}
              </motion.div>
            </div>
          ))}
        </nav>
        <div className="studio-sidebar-bottom">
          <button type="button" className="studio-user-card" onClick={() => { setMenu("profile"); setMobileMenuOpen(false); }}>
            <span className="studio-user-avatar">{displayName.slice(0, 1).toUpperCase()}</span>
            <span className="studio-user-copy"><strong>{displayName}</strong><small>Hồ sơ cá nhân</small></span>
            <FaChevronDown />
          </button>
          <button type="button" className="studio-logout" onClick={logout}><FaSignOutAlt /><span>Đăng xuất</span></button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileMenuOpen && <motion.button type="button" className="studio-mobile-backdrop" aria-label="Đóng menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} />}
      </AnimatePresence>

      <div className="studio-main-shell">
        <header className="studio-topbar">
          <div className="studio-topbar-title">
            <button type="button" className="studio-menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Mở điều hướng" aria-expanded={mobileMenuOpen}><FaBars /></button>
            <div><span className="studio-breadcrumb">DOCTIS <i>/</i> BỆNH NHÂN</span><h1>{pageTitle}</h1><p>{pageDescription}</p></div>
          </div>
          <div className="studio-topbar-actions">
            {menu !== "dashboard" && <HeartScene compact className="patient-header-heart" bpm={latest?.heartRate} status={risk.label} busy={healthSaving || nutritionLoading} />}
            <StudioControls />
            <span className="studio-today"><FaCalendarCheck />{new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}</span>
            <NotificationInbox onOpen={notification => { if (notification.entityType === "appointment") { setFocusAppointmentId(notification.entityId); setMenu("appointments"); fetchAppointments(); } else { setCareTeamRefresh(value => value + 1); setMenu("care-team"); } }} />
            <button type="button" className="studio-topbar-user" onClick={() => setMenu("profile")} aria-label={`Mở hồ sơ: ${displayName}`}><span className="studio-user-avatar">{displayName.slice(0, 1).toUpperCase()}</span><FaChevronDown /></button>
          </div>
        </header>
        <StudioExperience page={menu} name={displayName} smoothScroll={menu === "dashboard"} />

        {mobileMenuOpen && <span className="studio-close-on-select" aria-hidden="true" />}

      <main ref={screenRef} className={`studio-content ${menu === "doctor-chat" ? "is-conversation" : ""}`}>
        {["health", "analytics"].includes(menu) && careNeedsRefresh && <div className="care-refresh-banner"><p>Chỉ số của bạn đã thay đổi. Cập nhật kế hoạch chăm sóc?</p><div><button type="button" className="care-persistence-button" onClick={() => setMenu("care-plan")}>Cập nhật kế hoạch</button><button type="button" className="care-persistence-button" onClick={() => setDeferredCareSnapshot(careSnapshotKey)}>Để sau</button></div></div>}
        {menu === "dashboard" && <PatientOverview
          displayName={displayName} latest={latest} data={data} risk={risk}
          analysisData={analysisData} nextAppointment={nextAppointment}
          nutritionPlan={nutritionPlan} loading={healthLoading} error={apiErrors.health}
          navigate={setMenu} formatDate={formatDate} formatTime={formatTime}
          appointmentStatusLabel={appointmentStatusLabel}
        />}

        {apiErrors.profile && menu === "profile" && (
          <div className="danger-alert">
            <FaExclamationTriangle />
            <span>
              Không tải được hồ sơ. Vui lòng tải lại trang hoặc thử lại sau.
            </span>
          </div>
        )}

        {menu === "profile" && (
          <motion.div
            className="studio-profile-page"
            initial={false}
          >
            <div className="studio-profile-card">
              <div className="profile-page-header">
                <div>
                  <span className="patient-function-kicker">Hồ sơ cá nhân / DOCTIS</span>
                  <h2>{displayName}</h2>
                  <p>
                    Thông tin cá nhân và thông tin cần thiết cho quá trình
                    khám bệnh.
                  </p>
                  <div className="profile-mode-switch" role="group" aria-label="Chế độ hồ sơ"><button type="button" aria-pressed={profileReadOnly} disabled={profileSaving} onClick={() => setProfileReadOnly(true)}>Xem hồ sơ</button><button type="button" aria-pressed={!profileReadOnly} disabled={profileSaving} onClick={() => setProfileReadOnly(false)}>Chỉnh sửa</button></div>
                </div>
                <div className="profile-masthead-seal" aria-hidden="true"><FaAddressBook /><span>Thông tin<br/>chăm sóc của bạn</span></div>
              </div>

              <div className="profile-photo-section">
                <div
                  className="patient-photo-box"
                  onClick={() => { if (!profileReadOnly) handleAvatarClick(); }}
                  role="button"
                  tabIndex={profileReadOnly ? -1 : 0}
                  aria-disabled={profileReadOnly}
                  onKeyDown={(e) => {
                    if (!profileReadOnly && (e.key === "Enter" || e.key === " ")) {
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
              <nav className="profile-section-nav" aria-label="Các phần trong hồ sơ">{["Thông tin cá nhân","Thông tin người thân","Thông tin địa chỉ","Thông tin y tế cơ bản","Người liên hệ khẩn cấp"].map((title,index) => <button type="button" key={title} onClick={() => document.getElementById(profileSectionId(title))?.scrollIntoView({behavior:reducedMotion ? "instant" : "smooth",block:"start"})}><span>{String(index+1).padStart(2,"0")}</span>{title}</button>)}</nav>
              <fieldset className="profile-editor" disabled={profileReadOnly} aria-label={profileReadOnly ? "Hồ sơ ở chế độ xem" : "Chỉnh sửa hồ sơ"}>

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

              <ProfileSection title="Thông tin địa chỉ" icon={<FaMapMarkerAlt />}>
                <ProfileField full label="Địa chỉ chi tiết"><input value={profile.address || "Chưa bổ sung"} readOnly /></ProfileField>
                <ProfileField label="Thành phố"><input value={profile.province || "Chưa xác minh"} readOnly /></ProfileField>
                <ProfileField label="Phường"><input value={profile.ward || "Chưa bổ sung"} readOnly /></ProfileField>
                <div className="profile-field full-width"><p>Cập nhật địa chỉ và phường trong danh mục phục vụ tại mục bệnh viện.</p><button type="button" className="coord-secondary" onClick={() => setMenu("care-team")}>Cập nhật địa chỉ phục vụ</button></div>
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
                  <div className="allergy-selected-list">
                    <AnimatePresence initial={false}>
                      {allergyTags.map((tag) => (
                        <motion.span
                          className="allergy-chip"
                          key={tag}
                          layout
                          initial={{ opacity: 0, y: 5, scale: .96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: .94 }}
                          transition={{ duration: .18 }}
                        >
                          <span>{tag}</span>
                          <button
                            type="button"
                            onClick={() => removeAllergyTag(tag)}
                            aria-label={`Xóa ${tag}`}
                          >
                            <FaTimes />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>

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
                  <div className="studio-condition-grid">
                     {CHRONIC_DISEASE_OPTIONS.map((option) => (
                      <label
                        className={`studio-condition-tile ${
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
                  {profileSaving ? <span className="button-spinner" aria-hidden="true" /> : <FaSave />}
                  {profileSaving ? "Đang lưu..." : "Lưu hồ sơ bệnh nhân"}
                </button>
                <AnimatePresence mode="wait">
                  {profileSaveFeedback && (
                    <motion.div
                      key={profileSaveFeedback.type}
                      className={`form-feedback ${profileSaveFeedback.type}`}
                      role={profileSaveFeedback.type === "error" ? "alert" : "status"}
                      initial={{ opacity: 0, y: 6, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <span className="feedback-mark" aria-hidden="true">{profileSaveFeedback.type === "success" ? "✓" : "!"}</span>
                      {profileSaveFeedback.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </fieldset>
            </div>
          </motion.div>
        )}

        {menu === "doctor-chat" && (
          <motion.div
            className="conversation-workspace"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={`conversation-frame ${mobileConversationOpen ? "is-mobile-conversation" : ""}`}>
              <div className="conversation-rail">
                <div className="conversation-rail-heading">
                  <div>
                    <h2>Hội thoại</h2>
                    <p>Chọn bác sĩ để trò chuyện</p>
                  </div>
                  <span className="conversation-count">{doctors.length}</span>
                </div>

                <div className="conversation-search">
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

                <div className="conversation-contacts">
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
                          className={`conversation-contact ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => { selectDoctor(doctor); setMobileConversationOpen(true); }}
                        >
                          {isSelected && <motion.i className="conversation-selection" layoutId="patient-conversation-selection" transition={{ duration: .2 }} />}
                          <div className="conversation-avatar">
                            {doctor.avatar ? (
                              <img
                                src={doctor.avatar}
                                alt={getDoctorName(doctor)}
                              />
                            ) : (
                              <FaUserMd />
                            )}

                          </div>

                                                    <div className="conversation-person">
                            <h4>{getDoctorName(doctor)}</h4>
                            <p>
                              {doctor.lastMessage ||
                                doctor.specialty ||
                                doctor.specialization ||
                                "Bác sĩ"}
                            </p>
                          </div>

                          {doctor.unread > 0 && (
                            <span className="conversation-unread">
                              {doctor.unread}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="conversation-empty">
                      <FaUserMd />
                      <h4>Không tìm thấy bác sĩ</h4>
                      <p>
                        Thử tìm kiếm với tên hoặc chuyên khoa khác.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="conversation-pane">
                {selectedDoctor ? (
                  <>
                    <div className="conversation-heading">
                      <ConversationBack onClick={() => setMobileConversationOpen(false)} />
                      <div className="conversation-avatar">
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

                          {selectedDoctor.specialty ||
                            selectedDoctor.specialization ||
                            "Bác sĩ"}
                        </p>
                      </div>

                      <div className="conversation-actions">
                        {selectedDoctor.phone && (
                          <a
                            href={`tel:${selectedDoctor.phone}`}
                            className="conversation-call"
                            title="Gọi bác sĩ"
                          >
                            <FaPhone />
                          </a>
                        )}
                      </div>
                    </div>

                    <div
                      ref={doctorChatBodyRef}
                      className="conversation-timeline"
                      onScroll={handleDoctorChatScroll}
                    >
                      {doctorLoading ? (
                        <div className="conversation-loading">
                          Đang tải cuộc trò chuyện...
                        </div>
                      ) : doctorMessages.length > 0 ? (
                        doctorMessages.map((msg, index) => {
                          const isUser = isCurrentUserMessage(msg);

                          return (
                            <div
                              key={msg._id || index}
                              className={`conversation-message ${
                                isUser ? "patient" : "doctor"
                              }`}
                            >
                              <div className="conversation-bubble">
                                {msg.content || msg.text ? (
                                  <div className="conversation-text">
                                    {msg.content || msg.text}
                                  </div>
                                ) : null}
                                {renderDoctorAttachment(msg.attachment)}
                                <div className="conversation-time">
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
                        <div className="conversation-empty">
                          <div className="conversation-empty-icon">
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

                    <ConversationNotice viewport={doctorViewport} />
                    <div className="conversation-composer">
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

                      <div className="conversation-input">
                        <button
                          type="button"
                          className="conversation-attach"
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
                  <div className="conversation-empty" >
                    <CareScene kind="chat" className="small" />
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
            className="studio-health-form"
            initial={false}
            data-save-state={healthSaveFeedback?.type || "idle"}
          >
            <div className="health-entry-intro"><div><span className="patient-function-kicker">Ghi nhận / Sức khỏe mỗi ngày</span><h2 className="studio-form-title">Lắng nghe cơ thể,<br/><em>từng chỉ số nhỏ.</em></h2><p className="studio-form-subtitle">Nhập kết quả bạn vừa đo. Dữ liệu chỉ được ghi nhận khi lưu thành công.</p></div><div className="health-entry-progress"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="38"/><motion.circle cx="45" cy="45" r="38" initial={false} animate={{strokeDashoffset:238.76*(1-enteredCount/5)}} transition={{duration:reducedMotion ? 0 : .25}}/></svg><strong>{enteredCount}<small>/5</small></strong><span>trường đã nhập</span></div></div>

            <section className="health-entry-group"><div className="health-entry-group-heading"><span>01</span><div><h3>Thể trạng</h3><p>Chiều cao và cân nặng để tính BMI.</p></div><FaRulerVertical aria-hidden="true" /></div><div className="form-grid">
              <HealthInput
                id="health-height"
                label="Chiều cao (cm)"
                icon={<FaRulerVertical />}
                placeholder="Ví dụ: 175"
                type="number"
                value={form.height}
                onChange={(value) => updateHealthField("height", value)}
              />

              <HealthInput
                id="health-weight"
                label="Cân nặng (kg)"
                icon={<FaWeight />}
                placeholder="Ví dụ: 70"
                type="number"
                value={form.weight}
                onChange={(value) => updateHealthField("weight", value)}
              />

              <div className="studio-health-field studio-bmi-field">
                <div className="studio-field-label">BMI · Tự tính</div>
                <div className="studio-bmi-result">
                  {calculatedBMI || "Nhập chiều cao + cân nặng"}
                </div>
              </div>

              </div></section><section className="health-entry-group"><div className="health-entry-group-heading"><span>02</span><div><h3>Chỉ số sinh hiệu</h3><p>Ghi lại đúng đơn vị từ thiết bị đo.</p></div><FaHeartbeat aria-hidden="true" /></div><div className="form-grid"><HealthInput
                id="health-glucose"
                label="Glucose (mg/dL)"
                icon={<FaTint />}
                placeholder="Ví dụ: 90"
                type="number"
                value={form.glucose}
                onChange={(value) => updateHealthField("glucose", value)}
              />

              <HealthInput
                id="health-blood-pressure"
                label="Huyết áp"
                icon={<FaHeartbeat />}
                placeholder="Ví dụ: 120/80"
                type="text"
                value={form.bloodPressure}
                onChange={(value) => updateHealthField("bloodPressure", value)}
              />

              <HealthInput
                id="health-heart-rate"
                label="Nhịp tim (bpm)"
                icon={<FaHeartbeat />}
                placeholder="Ví dụ: 80"
                type="number"
                value={form.heartRate}
                onChange={(value) => updateHealthField("heartRate", value)}
              />
            </div></section>

            {enteredRisk !== "Chưa có dữ liệu" && <div className={`health-entry-assessment ${enteredRisk === "Nguy hiểm" ? "is-danger" : enteredRisk === "Cao" ? "is-caution" : ""}`} role="status"><FaHeartbeat/><div><span>Theo chỉ số đang nhập · chưa lưu</span><strong>{enteredRisk}</strong></div><p>Đánh giá theo quy tắc hiện có của DOCTIS. Kiểm tra lại số đo trước khi lưu.</p></div>}

            {calculatedBMI && <p className="studio-form-note" role="status">BMI được tính từ chiều cao và cân nặng bạn vừa nhập.</p>}

            <div className="health-save-area">
              <span className="health-save-hint"><FaSave aria-hidden="true"/> Lưu vào lịch sử theo dõi của bạn</span>
              <button type="button" className="studio-save-action" onClick={saveHealth} disabled={healthSaving}>
                {healthSaving && <span className="button-spinner" aria-hidden="true" />}
                {healthSaving ? "Đang lưu dữ liệu..." : "Lưu dữ liệu sức khỏe"}
              </button>
              <AnimatePresence mode="wait">
                {healthSaveFeedback && (
                  <motion.div
                    key={healthSaveFeedback.type}
                    className={`form-feedback ${healthSaveFeedback.type}`}
                    role={healthSaveFeedback.type === "error" ? "alert" : "status"}
                    initial={{ opacity: 0, y: 6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    <span className="feedback-mark" aria-hidden="true">{healthSaveFeedback.type === "success" ? "✓" : "!"}</span>
                    {healthSaveFeedback.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {menu === "analytics" && <HealthAnalytics data={data} loading={healthLoading} error={apiErrors.health} />}

        <AIWorkspace active={menu === "ai"} />

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
                <CareScene kind="calendar" className="compact" />
                <div>
                  <span className="care-kicker">DOCTIS • DAILY WELLNESS</span>
                  <h2>Kế hoạch chăm sóc hằng ngày</h2>
                  <p>Lịch 7 ngày được cá nhân hóa từ chỉ số sức khỏe, dinh dưỡng, vận động và đơn thuốc đã được bác sĩ xác nhận.</p>
                  <div className="care-hero-tags">
                    <span><FaRobot /> AI cá nhân hóa</span>
                    <span><FaUtensils /> Dinh dưỡng</span>
                    <span><FaHeartbeat /> Vận động</span>
                    <span><FaUserMd /> Theo đơn bác sĩ</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="generate-plan-btn care-generate-v6"
                onClick={handleGeneratePlan}
                disabled={savedCare.loading || !savedCare.ready || !!savedCare.pendingItem || nutritionLoading || nutritionMissingFields.length > 0}
              >
                <span>{nutritionLoading ? "Đang xây dựng..." : nutritionPlan ? "Tạo lại kế hoạch" : "Tạo kế hoạch 7 ngày"}</span>
                <b>{nutritionLoading ? "•••" : "✦"}</b>
              </button>
            </section>

            {savedCare.loading && <p role="status" className="care-save-feedback">Đang tải kế hoạch đã lưu…</p>}
            {savedCare.error && <div role="alert" className="care-save-feedback" data-error="true">{savedCare.error} {!savedCare.ready && <button type="button" className="care-persistence-button" onClick={savedCare.load}>Thử tải lại</button>}</div>}
            {savedCare.notice && <p role="status" className="care-save-feedback">{savedCare.notice}</p>}
            {nutritionPlan && <p className="care-save-feedback">Kế hoạch đã lưu · {nutritionPlan.startDate || 'Ngày bắt đầu chưa được lưu'}{nutritionPlan.endDate ? ' → ' + nutritionPlan.endDate : ''}. Tiến độ được đồng bộ sau mỗi thao tác.</p>}
            {careNeedsRefresh && <div className="care-refresh-banner"><p>Chỉ số của bạn đã thay đổi. Cập nhật kế hoạch chăm sóc?</p><div><button type="button" className="care-persistence-button" disabled={nutritionLoading || !!savedCare.pendingItem} onClick={handleGeneratePlan}>Cập nhật kế hoạch</button><button type="button" className="care-persistence-button" onClick={() => setDeferredCareSnapshot(careSnapshotKey)}>Để sau</button></div></div>}
            {careExpired && <div className="care-refresh-banner"><p>Chu kỳ 7 ngày đã kết thúc. Kế hoạch và tiến độ cũ vẫn được giữ; bạn có thể tạo kế hoạch mới khi sẵn sàng.</p><button type="button" className="care-persistence-button" disabled={nutritionLoading || !!savedCare.pendingItem} onClick={handleGeneratePlan}>Tạo kế hoạch mới</button></div>}

            <section className="care-health-strip-v6">
              <div className="care-health-card bmi">
                <span className="care-health-icon">⚖️</span>
                <div><small>BMI</small><strong>{Number(latest?.bmi) > 0 ? latest.bmi : "—"}</strong></div>
                <em>Theo dõi</em>
              </div>
              <div className="care-health-card glucose">
                <span className="care-health-icon">🩸</span>
                <div><small>Glucose</small><strong>{Number(latest?.glucose) > 0 ? <>{latest.glucose}<i> mg/dL</i></> : "—"}</strong></div>
                <em>Gần nhất</em>
              </div>
              <div className="care-health-card pressure">
                <span className="care-health-icon">💗</span>
                <div><small>Huyết áp</small><strong>{latest?.systolic && latest?.diastolic ? `${latest.systolic}/${latest.diastolic}` : "—"}</strong></div>
                <em>mmHg</em>
              </div>
              <div className="care-health-card allergy">
                <span className="care-health-icon">🛡️</span>
                <div><small>Dị ứng</small><strong>{savedCareProfile?.allergies || "Chưa cập nhật"}</strong></div>
                <em>Đã lưu</em>
              </div>
              <div className="care-health-card chronic">
                <span className="care-health-icon">🫀</span>
                <div><small>Bệnh nền</small><strong>{savedCareProfile?.chronicDiseases || "Chưa cập nhật"}</strong></div>
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

                <CareWeekGallery days={careWeek} activeDay={activeDay} onSelectDay={setActiveDay} onToggleActivity={toggleCareActivity} pending={!!savedCare.pendingItem || savedCare.saving} />
              </section>
            )}

            {savedCare.ready && !nutritionPlan && !nutritionLoading && (
              <section className="care-empty-v6">
                <div className="care-empty-orb">✦</div>
                <span className="care-section-kicker">BẮT ĐẦU HÔM NAY</span>
                <h3>Tạo lịch chăm sóc 7 ngày của riêng bạn</h3>
                <p>DOCTIS sẽ kết hợp dữ liệu sức khỏe gần nhất, hồ sơ dị ứng/bệnh nền và đơn thuốc đã chốt để tạo một lịch dễ theo dõi.</p>
                <button type="button" className="generate-plan-btn" onClick={handleGeneratePlan} disabled={!savedCare.ready || nutritionMissingFields.length > 0}>✨ Bắt đầu tạo kế hoạch</button>
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
                    const reminderId = `${nutritionPlan?._id}:${careWeek[activeDay]?.date}:${item.id || item.time}`;
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
                          <button type="button" className={`care-reminder-btn ${sent ? "sent" : ""}`} title={!careWeek[activeDay]?.date ? "Tạo lại kế hoạch để đặt ngày nhắc chính xác" : undefined} onClick={() => handleEmailReminder(careWeek[activeDay], item)} disabled={!careWeek[activeDay]?.date || reminderSendingId === reminderId}>
                            <FaBell /> {reminderSendingId === reminderId ? "Đang tạo..." : sent ? "Đã bật email" : "Nhắc email"}
                          </button>
                          <button type="button" className="care-done-btn" disabled={!!savedCare.pendingItem || savedCare.saving} onClick={() => toggleCareActivity(activeDay, item.id)}>{item.done ? "✓ Đã xong" : "Đánh dấu xong"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <details className="care-history-panel" onToggle={event => {if(event.currentTarget.open) savedCare.loadHistory();}}><summary>Lịch sử kế hoạch chăm sóc</summary>
              {savedCare.historyLoading ? <p role="status">Đang tải lịch sử…</p> : !savedCare.history.length ? <p>Chưa có kế hoạch lưu trữ.</p> : savedCare.history.map(plan => <article key={plan._id}><strong>{plan.startDate || 'Kế hoạch trước'}{plan.endDate ? ' → ' + plan.endDate : ''}</strong><p>{(plan.days || []).flatMap(d => d.items || []).filter(i => i.done).length} việc đã hoàn thành. Bản lưu chỉ để xem lại.</p><details><summary>Xem nội dung</summary>{(plan.days || []).map(day => <div key={day.dayIndex}><h4>{day.label}</h4><ul>{(day.items || []).map(item => <li key={item.id}>{item.done ? '✓ ' : ''}{item.time} · {item.title} — {item.description}</li>)}</ul></div>)}</details></article>)}
            </details>
            <PrescriptionPanel prescriptions={prescriptions.filter(isConfirmedPrescription)} loading={prescriptionLoading} />
          </motion.div>
        )}

        <CareTeamPanel active={menu === "care-team"} refreshKey={careTeamRefresh} onUpdated={value => { const location = value.address || {}; setProfile(old => ({ ...old, address: location.address || old.address, ward: location.ward?.name || location.wardName || (typeof location.ward === "string" ? location.ward : old.ward), province: location.city || old.province })); }} />

        {menu === "appointments" && <AppointmentCalendar focusAppointmentId={focusAppointmentId} onCancelled={updated => { setAppointments(old => old.map(item => getId(item) === getId(updated) ? { ...item, ...updated, doctorId: typeof updated.doctorId === "object" ? updated.doctorId : item.doctorId, patientId: typeof updated.patientId === "object" ? updated.patientId : item.patientId } : item)); fetchAppointments(); }} appointments={appointments} formatDate={formatDate} formatTime={formatTime} statusLabel={appointmentStatusLabel} />}

      </main>
      </div>
    </div></MotionConfig>
  );
}

function profileSectionId(title) {
  return `profile-${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g,"d").replace(/[^a-z0-9]+/g,"-")}`;
}

function ProfileSection({ title, icon, children }) {
  return (
    <section className="studio-profile-section" id={profileSectionId(title)}>
      <div className="profile-section-title">
        {icon}
        <span>{title}</span>
      </div>

      <div className="profile-form-grid">{children}</div>
    </section>
  );
}

function ProfileField({ label, icon, full = false, children }) {
  const fieldId = useId();
  const childList = Children.toArray(children);
  const control = childList.find((child) => isValidElement(child) && ["input", "select", "textarea"].includes(child.type));
  const controlId = control?.props.id || fieldId;
  const labelledChildren = childList.map((child) => child === control ? cloneElement(child, { id: controlId }) : child);
  return (
    <div className={`studio-profile-field ${full ? "full" : ""}`}>
      <label htmlFor={control ? controlId : undefined}>{label}</label>

      {icon ? (
        <div className="studio-profile-control">
          {icon}
          {labelledChildren}
        </div>
      ) : (
        labelledChildren
      )}
    </div>
  );
}

function HealthInput({ id, label, icon, placeholder, type, value, onChange }) {
  const suffix = { "health-height": "cm", "health-weight": "kg", "health-glucose": "mg/dL", "health-blood-pressure": "mmHg", "health-heart-rate": "bpm" }[id];
  return (
    <div className="studio-health-field" data-filled={!!String(value).trim()}>
      <label className="studio-field-label" htmlFor={id}>{label}</label>
      <div className="studio-field-control">
        <span className="studio-field-icon" aria-hidden="true">{icon}</span>
        <input id={id} className="studio-input" type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="studio-field-unit" aria-hidden="true">{suffix}</span>}
        {type === "number" && <span className="health-value-stepper"><button type="button" aria-label={`Giảm ${label}`} disabled={!value || Number(value) <= 1} onClick={() => onChange(String(Number(value)-1))}>−</button><button type="button" aria-label={`Tăng ${label}`} disabled={!value || !Number.isFinite(Number(value))} onClick={() => onChange(String(Number(value)+1))}>+</button></span>}
      </div>
    </div>
  );
}
