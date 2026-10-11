import "../../CSS/doctor.css";

import {
  FaUserInjured,
  FaHeartbeat,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaUserMd,
  FaBell,
  FaSignOutAlt,
  FaEye,
  FaTimes,
  FaEnvelope,
  FaComments,
  FaNotesMedical,
  FaPrescriptionBottleAlt,
  FaUtensils,
  FaSearch,
  FaPlus,
  FaTrash,
  FaCheckCircle,
  FaClock,
  FaPaperPlane,
  FaPaperclip,
  FaImage,
  FaFileAlt,
  FaDownload,
  FaChartLine,
  FaClipboardList
} from "react-icons/fa";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line
} from "recharts";

import API from "../../services/api";
import getRiskAssessment from "../../utils/riskAssessment";

const authConfig = () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  return {
    headers: {
      Authorization: `Bearer ${user?.token || ""}`
    }
  };
};

const safeArray = (value) => (Array.isArray(value) ? value : []);
const emptyCarePlanDays = (days = []) => {
  const existing = safeArray(days);
  const count = Math.max(7, existing.length);
  return Array.from({ length: count }, (_, dayIndex) => {
    const day = existing.find((item) => Number(item.dayIndex) === dayIndex);
    return {
      dayIndex,
      label: day?.label || `Ngày ${dayIndex + 1}`,
      status: day?.status || "draft",
      items: safeArray(day?.items).map((item) => ({
        id: item.id || `care-${dayIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: item.type || "NOTE",
        time: item.time || "07:00",
        title: item.title || "",
        description: item.description || ""
      }))
    };
  });
};

const riskClass = (risk = "") => {
  const value = String(risk).toLowerCase();
  if (value.includes("nguy") || value.includes("critical")) return "critical";
  if (value.includes("cao") || value.includes("high")) return "high";
  return "normal";
};

const riskLabel = (health) => {
  return getRiskAssessment(health);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("vi-VN");
};

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const getPatientName = (patient) =>
  patient?.fullName || patient?.username || patient?.name || "Bệnh nhân";

const initialMedicine = () => ({
  name: "",
  dosage: "",
  frequency: "1 lần/ngày",
  times: ["07:00"],
  mealRelation: ""
});

export default function DoctorDashboard() {
  const nav = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");

  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientLoading, setPatientLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState("overview");

  const [adviceData, setAdviceData] = useState({ title: "", message: "" });
  const [appointmentData, setAppointmentData] = useState({
    appointmentDate: "",
    note: "",
    type: "Tái khám"
  });
  const [appointmentActionId, setAppointmentActionId] = useState("");
  const [reminderSendingId, setReminderSendingId] = useState("");

  // Messaging
  const [messagePatients, setMessagePatients] = useState([]);
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messageAttachment, setMessageAttachment] = useState(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const messageEndRef = useRef(null);
  const messageAreaRef = useRef(null);
  const messageAttachmentInputRef = useRef(null);
  const messageStickToBottomRef = useRef(true);

  // Prescription
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionForm, setPrescriptionForm] = useState({
    title: "Đơn thuốc điều trị",
    note: "",
    medicines: [initialMedicine()]
  });
  const [savingPrescription, setSavingPrescription] = useState(false);

  // Care plan
  const [carePlan, setCarePlan] = useState(null);
  const [carePlanEditorOpen, setCarePlanEditorOpen] = useState(false);
  const [carePlanDays, setCarePlanDays] = useState(() => emptyCarePlanDays());
  const [carePlanNote, setCarePlanNote] = useState("");
  const [carePlanSaving, setCarePlanSaving] = useState(false);

  const logout = () => {
    localStorage.clear();
    nav("/");
  };

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await API.get("/appointments/doctor", authConfig());
      setAppointments(res.data || []);
    } catch (err) {
      console.error("GET DOCTOR APPOINTMENTS ERROR =", err);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/doctor/patients", authConfig());
      setPatients(res.data || []);
    } catch (err) {
      console.error("GET PATIENTS ERROR =", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessagePatients = useCallback(async () => {
    try {
      const res = await API.get("/messages/patients", authConfig());
      setMessagePatients(res.data || []);
    } catch (err) {
      console.error("GET MESSAGE PATIENTS ERROR =", err);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchAppointments();
  }, [fetchPatients, fetchAppointments]);

  useEffect(() => {
    if (activeMenu === "messages") fetchMessagePatients();
  }, [activeMenu, fetchMessagePatients]);

  // Vercel chạy API dạng serverless, nên dùng polling khi màn hình chat đang mở
  // để nhận tin nhắn mới mà không cần tải lại trang.
  useEffect(() => {
    if (activeMenu !== "messages" || !selectedChat?._id) return;

    let stopped = false;
    let inFlight = false;
    const patientId = String(selectedChat._id);

    const refreshConversation = async () => {
      if (stopped || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const res = await API.get(`/messages/patient/${patientId}`, authConfig());
        if (stopped) return;
        const incoming = safeArray(res.data);
        setMessages((previous) => {
          const previousById = new Map(previous.map((message) => [String(message?._id), message]));
          const serverIds = new Set(incoming.map((message) => String(message?._id)));
          const pending = previous.filter((message) => String(message?._id || "").startsWith("temp-") && !serverIds.has(String(message._id)));
          return [
            ...incoming.map((message) => {
              const old = previousById.get(String(message?._id));
              return old?.attachment && !message?.attachment ? { ...message, attachment: old.attachment } : message;
            }),
            ...pending,
          ];
        });
        setMessagePatients((previous) => previous.map((patient) =>
          String(patient._id) === patientId ? { ...patient, unread: 0 } : patient
        ));
      } catch (err) {
        // Giữ nguyên nội dung đang xem nếu mạng tạm thời gián đoạn.
        console.warn("REFRESH CHAT ERROR =", err?.message || err);
      } finally {
        inFlight = false;
      }
    };

    refreshConversation();
    const interval = window.setInterval(refreshConversation, 2000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [activeMenu, selectedChat?._id]);

  useEffect(() => {
    if (activeMenu !== "messages") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "hidden") fetchMessagePatients();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeMenu, fetchMessagePatients]);

  const openPatient = async (patient) => {
    setSelectedPatient(patient);
    setPatientLoading(true);
    setCarePlan(null);
    setCarePlanDays(emptyCarePlanDays());
    setPrescriptions([]);
    setCarePlanEditorOpen(false);

    try {
      const [healthRes, careRes, prescriptionRes] = await Promise.allSettled([
        API.get(`/doctor/patient-health/${patient._id}`, authConfig()),
        API.get(`/care-plans/doctor/patient/${patient._id}`, authConfig()),
        API.get(`/prescriptions/doctor/patient/${patient._id}`, authConfig())
      ]);

      const healthHistory =
        healthRes.status === "fulfilled" ? safeArray(healthRes.value.data) : [];

      const latestHealth =
        healthHistory.length > 0
          ? healthHistory[healthHistory.length - 1]
          : patient.latestHealth || null;

      setSelectedPatient({
        ...patient,
        healthHistory,
        latestHealth
      });

      if (careRes.status === "fulfilled") setCarePlan(careRes.value.data);
      else setCarePlan(null);
      if (prescriptionRes.status === "fulfilled") {
        setPrescriptions(safeArray(prescriptionRes.value.data));
      }
      const plan = careRes.status === "fulfilled" ? careRes.value.data : null;
      setCarePlanDays(emptyCarePlanDays(plan?.days));
      setCarePlanNote(plan?.doctorNote || "");
    } catch (err) {
      console.error("OPEN PATIENT ERROR =", err);
    } finally {
      setPatientLoading(false);
    }
  };

  const closePatient = () => {
    setSelectedPatient(null);
    setCarePlan(null);
    setPrescriptions([]);
    setCarePlanEditorOpen(false);
  };

  const saveCarePlan = async (status) => {
    if (!selectedPatient?._id) return;
    const days = carePlanDays.map((day) => ({
      ...day,
      items: safeArray(day.items).map((item) => ({
        ...item,
        id: String(item.id || `care-${day.dayIndex}-${Date.now()}`),
        time: String(item.time || "").trim(),
        title: String(item.title || "").trim(),
        description: String(item.description || "").trim()
      }))
    }));
    const hasIncompleteActivity = days.some((day) => day.items.some((item) => !item.time || !item.title));
    if (hasIncompleteActivity) {
      alert("Mỗi hoạt động cần có giờ và tên hoạt động trước khi lưu.");
      return;
    }

    setCarePlanSaving(true);
    try {
      const res = await API.post("/care-plans/doctor", {
        patientId: selectedPatient._id,
        days,
        status,
        doctorNote: carePlanNote,
      }, authConfig());
      setCarePlan(res.data);
      setCarePlanDays(emptyCarePlanDays(res.data?.days));
      setCarePlanEditorOpen(false);
      alert(status === "confirmed" ? "Đã chốt kế hoạch cho bệnh nhân." : "Đã lưu bản nháp kế hoạch.");
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể lưu kế hoạch chăm sóc.");
    } finally {
      setCarePlanSaving(false);
    }
  };

  const addCarePlanActivity = (dayIndex, type = "MEAL") => {
    const id = `care-${dayIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setCarePlanDays((current) => current.map((day) => day.dayIndex === dayIndex
      ? { ...day, items: [...day.items, { id, type, time: "07:00", title: type === "MEDICATION" ? "Thuốc theo đơn" : "Hoạt động mới", description: "" }] }
      : day));
  };

  const updateCarePlanActivity = (dayIndex, itemId, field, value) => {
    setCarePlanDays((current) => current.map((day) => day.dayIndex === dayIndex
      ? { ...day, items: day.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item) }
      : day));
  };

  const removeCarePlanActivity = (dayIndex, itemId) => {
    setCarePlanDays((current) => current.map((day) => day.dayIndex === dayIndex
      ? { ...day, items: day.items.filter((item) => item.id !== itemId) }
      : day));
  };

  const jumpToPrescriptionEditor = () => {
    document.getElementById("doctor-prescription-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const sendAdvice = async (patientId) => {
    if (!adviceData.message.trim()) {
      alert("Nhập nội dung lời khuyên.");
      return;
    }

    try {
      await API.post(
        "/doctor/send-advice",
        {
          patientId,
          title: adviceData.title || "Lời khuyên từ bác sĩ",
          message: adviceData.message
        },
        authConfig()
      );
      alert("Đã gửi lời khuyên.");
      setAdviceData({ title: "", message: "" });
    } catch (err) {
      alert(err.response?.data?.msg || "Gửi lời khuyên thất bại.");
    }
  };

  const sendEmailReminder = async (appointmentId) => {
    if (!appointmentId) return;
    setReminderSendingId(appointmentId);

    try {
      await API.post(
        `/appointments/remind/${appointmentId}`,
        {},
        authConfig()
      );
      alert("Đã gửi email nhắc lịch cho bệnh nhân.");
    } catch (err) {
      alert(
        err.response?.data?.msg ||
        "Không thể gửi email nhắc lịch."
      );
    } finally {
      setReminderSendingId("");
    }
  };

  const createAppointment = async () => {
    if (!selectedPatient) return alert("Vui lòng chọn bệnh nhân.");
    if (!appointmentData.appointmentDate) {
      return alert("Vui lòng chọn ngày hẹn.");
    }

    try {
      await API.post(
        "/appointments/create",
        {
          patientId: selectedPatient._id,
          appointmentDate: appointmentData.appointmentDate,
          note: appointmentData.note,
          type: appointmentData.type
        },
        authConfig()
      );

      await fetchAppointments();
      alert("Đã tạo lịch hẹn.");
      setAppointmentData({
        appointmentDate: "",
        note: "",
        type: "Tái khám"
      });
      setSelectedPatient(null);
    } catch (err) {
      alert(err.response?.data?.msg || "Tạo lịch hẹn thất bại.");
    }
  };

  const updateAppointmentStatus = async (appointment, status) => {
    setAppointmentActionId(appointment._id);
    try {
      const action = status === "approved" ? "approve" : "complete";
      await API.put(`/appointments/${action}/${appointment._id}`, {}, authConfig());
      await fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể cập nhật lịch hẹn.");
    } finally {
      setAppointmentActionId("");
    }
  };

  // ================= MESSAGING =================

  const scrollMessagesToBottom = useCallback((behavior = "smooth") => {
    requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }, []);

  useEffect(() => {
    if (activeMenu !== "messages" || !selectedChat) return;
    if (messageStickToBottomRef.current) {
      scrollMessagesToBottom("smooth");
    }
  }, [messages, selectedChat, activeMenu, scrollMessagesToBottom]);

  const handleMessageAreaScroll = (e) => {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    messageStickToBottomRef.current = distance < 120;
  };

  const handleMessageAttachmentChange = (e) => {
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

      setMessageAttachment({
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

  const removeMessageAttachment = () => setMessageAttachment(null);

  const formatFileSize = (size) => {
    if (!size) return "Tệp đính kèm";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  };

  const getAttachmentUrl = (attachment) =>
    attachment?.dataUrl ||
    attachment?.url ||
    attachment?.fileUrl ||
    attachment?.src ||
    "";

  const downloadAttachment = async (attachment) => {
    const url = getAttachmentUrl(attachment);
    if (!url) {
      alert("Tệp này không có dữ liệu để tải xuống.");
      return;
    }

    const fileName = attachment?.name || "tep-dinh-kem";

    try {
      if (url.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error("DOWNLOAD_FAILED");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("DOWNLOAD ATTACHMENT ERROR =", error);
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const renderMessageAttachment = (attachment, mine = false) => {
    if (!attachment) return null;

    const url = getAttachmentUrl(attachment);
    const type = String(attachment.type || "");
    const isImage = type.startsWith("image/");

    if (isImage && url) {
      return (
        <div className={`message-image-attachment ${mine ? "mine" : ""}`}>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="message-image-preview-link"
            title="Mở ảnh"
          >
            <img
              src={url}
              alt={attachment.name || "Ảnh đính kèm"}
              loading="lazy"
            />
          </a>

          <div className="message-attachment-meta">
            <div className="message-attachment-name">
              <FaImage />
              <span title={attachment.name || "Ảnh đính kèm"}>
                {attachment.name || "Ảnh đính kèm"}
              </span>
            </div>

            <div className="message-attachment-actions">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="attachment-action-btn"
              >
                Mở
              </a>
              <button
                type="button"
                className="attachment-action-btn download"
                onClick={() => downloadAttachment(attachment)}
              >
                <FaDownload /> Tải xuống
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={`message-file-attachment ${mine ? "mine" : ""}`}>
        <div className="message-file-icon">
          <FaFileAlt />
        </div>

        <div className="message-file-info">
          <strong title={attachment.name || "Tệp đính kèm"}>
            {attachment.name || "Tệp đính kèm"}
          </strong>
          <small>
            {formatFileSize(attachment.size)}
            {type ? ` • ${type.split("/").pop()}` : ""}
          </small>
        </div>

        {url && (
          <div className="message-attachment-actions">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="attachment-action-btn"
            >
              Mở
            </a>
            <button
              type="button"
              className="attachment-action-btn download"
              onClick={() => downloadAttachment(attachment)}
              title="Tải tệp xuống"
            >
              <FaDownload />
            </button>
          </div>
        )}
      </div>
    );
  };

  const openChat = async (patient) => {
    setSelectedChat(patient);
    messageStickToBottomRef.current = true;
    setMessageAttachment(null);
    setMessageLoading(true);

    try {
      const res = await API.get(
        `/messages/patient/${patient._id}`,
        authConfig()
      );
      setMessages(safeArray(res.data));
      setMessagePatients((prev) =>
        prev.map((p) =>
          String(p._id) === String(patient._id)
            ? { ...p, unread: 0 }
            : p
        )
      );
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể tải cuộc trò chuyện.");
    } finally {
      setMessageLoading(false);
    }
  };

  const sendMessage = async () => {
  const content = messageText.trim();

  // Phải có text hoặc attachment
  if (
    (!content && !messageAttachment) ||
    !selectedChat ||
    sendingMessage
  ) {
    return;
  }

  const attachment = messageAttachment
    ? {
        name: messageAttachment.name,
        type: messageAttachment.type,
        size: messageAttachment.size,
        dataUrl: messageAttachment.dataUrl,
      }
    : null;

  // =====================================================
  // QUAN TRỌNG:
  // Khai báo temporaryMessage bên ngoài try
  // để catch cũng sử dụng được.
  // =====================================================
  const temporaryMessage = {
    _id: `temp-${Date.now()}`,
    senderId: currentUser?.id || currentUser?._id,
    receiverId: selectedChat._id,
    senderRole: "doctor",

    // Có thể rỗng nếu chỉ gửi ảnh/file
    content: content || "",

    attachment,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // Hiển thị ngay trên giao diện trước khi server trả về
  setMessages((prev) => [
    ...prev,
    temporaryMessage,
  ]);

  setMessageText("");
  setMessageAttachment(null);

  messageStickToBottomRef.current = true;

  try {
    setSendingMessage(true);

    const res = await API.post(
      "/messages/send",
      {
        receiverId: selectedChat._id,

        // Có thể ""
        content: content || "",

        attachment,
      },
      authConfig()
    );

    // Thay message tạm bằng message thật từ server
    if (res.data) {
      setMessages((prev) =>
        prev.map((message) =>
          message._id === temporaryMessage._id
            ? {
                ...res.data,

                // Đảm bảo attachment không bị mất
                attachment:
                  res.data?.attachment || attachment,

                // Cho phép message chỉ có file
                content:
                  res.data?.content || "",
              }
            : message
        )
      );
    }

    await fetchMessagePatients();

    setTimeout(() => {
      scrollMessagesToBottom("smooth");
    }, 50);
  } catch (err) {
    console.error(
      "SEND MESSAGE ERROR =",
      err
    );

    // Xóa message tạm nếu gửi thất bại
    setMessages((prev) =>
      prev.filter(
        (message) =>
          message._id !== temporaryMessage._id
      )
    );

    alert(
      err.response?.data?.msg ||
        err.response?.data?.message ||
        "Không thể gửi tin nhắn."
    );
  } finally {
    setSendingMessage(false);
  }
};

  const filteredMessagePatients = useMemo(() => {
    const keyword = messageSearch.trim().toLowerCase();
    if (!keyword) return messagePatients;

    return messagePatients.filter((p) =>
      [
        p.fullName,
        p.username,
        p.email,
        p.phone
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [messagePatients, messageSearch]);

  // ================= PRESCRIPTIONS =================

  const updateMedicine = (index, field, value) => {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: prev.medicines.map((medicine, i) =>
        i === index ? { ...medicine, [field]: value } : medicine
      )
    }));
  };

  const addMedicine = () => {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines: [...prev.medicines, initialMedicine()]
    }));
  };

  const removeMedicine = (index) => {
    setPrescriptionForm((prev) => ({
      ...prev,
      medicines:
        prev.medicines.length === 1
          ? prev.medicines
          : prev.medicines.filter((_, i) => i !== index)
    }));
  };

  const createPrescription = async () => {
    if (!selectedPatient) return;
    const medicines = prescriptionForm.medicines.filter(
      (m) => m.name.trim()
    );

    if (!prescriptionForm.title.trim() || !medicines.length) {
      return alert("Vui lòng nhập tên đơn thuốc và ít nhất một thuốc.");
    }

    try {
      setSavingPrescription(true);

      const res = await API.post(
        "/prescriptions/doctor",
        {
          patientId: selectedPatient._id,
          title: prescriptionForm.title.trim(),
          note: prescriptionForm.note.trim(),
          medicines,
          status: "confirmed"
        },
        authConfig()
      );

      setPrescriptions((prev) => [res.data, ...prev]);
      setPrescriptionForm({
        title: "Đơn thuốc điều trị",
        note: "",
        medicines: [initialMedicine()]
      });

      alert("Đã chốt đơn thuốc cho bệnh nhân.");
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể tạo đơn thuốc.");
    } finally {
      setSavingPrescription(false);
    }
  };

  const cancelPrescription = async (prescription) => {
    const reason = window.prompt(
      "Lý do hủy đơn thuốc (ví dụ: chỉ số đã ổn định):",
      "Chỉ số sức khỏe đã ổn định"
    );

    if (!reason) return;

    try {
      const res = await API.put(
        `/prescriptions/doctor/${prescription._id}/cancel`,
        { reason },
        authConfig()
      );

      setPrescriptions((prev) =>
        prev.map((item) =>
          String(item._id) === String(prescription._id)
            ? res.data.prescription
            : item
        )
      );

      alert("Đã hủy đơn thuốc.");
    } catch (err) {
      alert(err.response?.data?.msg || "Không thể hủy đơn thuốc.");
    }
  };

  const todayAppointments = appointments.filter((a) => {
    if (!a.appointmentDate) return false;
    return new Date(a.appointmentDate).toDateString() === new Date().toDateString();
  });

  const highRisk = patients.filter(
    (p) => riskLabel(p.latestHealth) === "Nguy hiểm"
  );

  const activePrescriptionsCount = prescriptions.filter(
    (p) => p.status === "confirmed"
  ).length;

  const patientHistory =
    selectedPatient?.healthHistory ||
    selectedPatient?.healthData ||
    [];

  const chartData = [...patientHistory].map((item, index) => ({
    day: item.createdAt
      ? new Date(item.createdAt).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit"
        })
      : `Lần ${index + 1}`,
    glucose: Number(item.glucose || 0),
    bmi: Number(item.bmi || 0),
    heartRate: Number(item.heartRate || 0),
    systolic: Number(item.systolic || 0),
    diastolic: Number(item.diastolic || 0)
  }));

  const latest = selectedPatient?.latestHealth || {};

  const profileFields = [
    ["Họ và tên", getPatientName(selectedPatient)],
    ["Tên đăng nhập", selectedPatient?.username],
    ["Email", selectedPatient?.email],
    ["Điện thoại", selectedPatient?.phone],
    ["Giới tính", selectedPatient?.gender],
    ["Ngày sinh", selectedPatient?.dateOfBirth || selectedPatient?.dob],
    [
      "Dị ứng",
      selectedPatient?.allergies ||
      selectedPatient?.allergy ||
      "Chưa cập nhật"
    ],
    [
      "Bệnh nền",
      selectedPatient?.chronicDiseases ||
      selectedPatient?.underlyingDiseases ||
      selectedPatient?.underlyingDisease ||
      selectedPatient?.diseases ||
      "Chưa cập nhật"
    ]
  ];

  return (
    <div className="doctor-layout">
      <aside className="doctor-sidebar">
        <div>
          <div className="doctor-logo">
            <FaUserMd />
            <div>
              <h2>Doctor Care</h2>
              <span>Clinical workspace</span>
            </div>
          </div>

          <button
            className={`doctor-menu ${activeMenu === "overview" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("overview");
              setSelectedPatient(null);
            }}
          >
            <FaHeartbeat />
            Tổng quan
          </button>

          <button
            className={`doctor-menu ${activeMenu === "patients" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("patients");
              setSelectedPatient(null);
            }}
          >
            <FaUserInjured />
            Bệnh nhân
            {highRisk.length > 0 && <b className="menu-badge">{highRisk.length}</b>}
          </button>

          <button
            className={`doctor-menu ${activeMenu === "messages" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("messages");
              setSelectedPatient(null);
            }}
          >
            <FaComments />
            Nhắn tin bệnh nhân
            {messagePatients.some((p) => p.unread > 0) && (
              <b className="menu-badge">!</b>
            )}
          </button>

          <button
            className={`doctor-menu ${activeMenu === "appointment" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("appointment");
              setSelectedPatient(null);
            }}
          >
            <FaCalendarAlt />
            Lịch hẹn
          </button>

          <button
            className={`doctor-menu ${activeMenu === "alerts" ? "active" : ""}`}
            onClick={() => {
              setActiveMenu("alerts");
              setSelectedPatient(null);
            }}
          >
            <FaBell />
            Cảnh báo AI
          </button>
        </div>

        <button className="doctor-menu logout" onClick={logout}>
          <FaSignOutAlt />
          Đăng xuất
        </button>
      </aside>

      <main className={`doctor-main ${activeMenu === "messages" ? "doctor-main-messages" : ""}`}>
        <header className="doctor-header">
          <div>
            <div className="eyebrow">
              <span className="pulse-dot" />
              DOCTIS · CLINICAL WORKSPACE
            </div>
            <h1>
              {activeMenu === "messages"
                ? "Trung tâm nhắn tin"
                : activeMenu === "appointment"
                ? "Quản lý lịch hẹn"
                : activeMenu === "alerts"
                ? "Cảnh báo & phân tích"
                : activeMenu === "patients"
                ? "Hồ sơ bệnh nhân"
                : "Bảng điều khiển bác sĩ"}
            </h1>
            <p>
              Theo dõi dữ liệu, kế hoạch chăm sóc và điều trị của bệnh nhân
              trong một không gian duy nhất.
            </p>
          </div>

          <div className="doctor-profile">
            <div className="doctor-avatar">
              {String(currentUser?.fullName || currentUser?.username || "D")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <h4>{currentUser?.fullName || currentUser?.username || "Bác sĩ"}</h4>
              <span>Doctor • Bác sĩ phụ trách</span>
            </div>
          </div>
        </header>

        {/* ================= OVERVIEW ================= */}
        {activeMenu === "overview" && (
          <>
            <section className="doctor-grid">
              <div className="doctor-card blue">
                <div className="card-icon"><FaUserInjured /></div>
                <h2>{patients.length}</h2>
                <p>Tổng bệnh nhân</p>
                <span className="card-caption">Đang được theo dõi</span>
              </div>

              <div className="doctor-card red">
                <div className="card-icon"><FaExclamationTriangle /></div>
                <h2>{highRisk.length}</h2>
                <p>Cần chú ý</p>
                <span className="card-caption">Theo chỉ số gần nhất</span>
              </div>

              <div className="doctor-card purple">
                <div className="card-icon"><FaCalendarAlt /></div>
                <h2>{todayAppointments.length}</h2>
                <p>Lịch hôm nay</p>
                <span className="card-caption">Cuộc hẹn đã ghi nhận</span>
              </div>

              <div className="doctor-card green">
                <div className="card-icon"><FaChartLine /></div>
                <h2>{patients.filter(p => p.latestHealth).length}</h2>
                <p>Có dữ liệu sức khỏe</p>
                <span className="card-caption">Theo dõi liên tục</span>
              </div>
            </section>

            <section className="patient-table doctor-appointment-list">
              <div className="table-top">
                <div><h2>Lịch hẹn</h2><p>Duyệt lịch đang chờ và cập nhật lịch đã khám.</p></div>
              </div>
              {appointments.length ? appointments.map((appointment) => (
                <article className="mini-patient" key={appointment._id}>
                  <div className="mini-patient-info">
                    <strong>{appointment.patientId?.fullName || appointment.patientId?.username || "Bệnh nhân"}</strong>
                    <span>{formatDate(appointment.appointmentDate)} · {formatTime(appointment.appointmentDate)} · {appointment.type || "Tái khám"}</span>
                    <span>Trạng thái: {appointment.status}</span>
                  </div>
                  <div className="mini-actions">
                    {appointment.status === "pending" && <button className="view-btn" disabled={appointmentActionId === appointment._id} onClick={() => updateAppointmentStatus(appointment, "approved")}>Duyệt</button>}
                    {appointment.status === "approved" && <button className="view-btn" disabled={appointmentActionId === appointment._id} onClick={() => updateAppointmentStatus(appointment, "completed")}>Hoàn tất</button>}
                  </div>
                </article>
              )) : <div className="empty-state">Chưa có lịch hẹn.</div>}
            </section>

            <section className="dashboard-split">
              <div className="patient-table">
                <div className="table-top">
                  <div>
                    <h2>Bệnh nhân cần theo dõi</h2>
                    <p>Nhấn “Hồ sơ” để xem toàn bộ dữ liệu, kế hoạch và đơn thuốc.</p>
                  </div>
                  <button className="soft-btn" onClick={() => {
              setActiveMenu("patients");
              setSelectedPatient(null);
            }}>
                    Xem tất cả
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state"><div className="spinner" /> Đang tải bệnh nhân...</div>
                ) : patients.length === 0 ? (
                  <div className="empty-state"><FaUserInjured /> Chưa có bệnh nhân.</div>
                ) : (
                  <div className="patient-cards">
                    {patients.slice(0, 8).map((p) => (
                      <div className="mini-patient" key={p._id}>
                        <div className="mini-avatar">
                          {getPatientName(p).charAt(0).toUpperCase()}
                        </div>
                        <div className="mini-patient-info">
                          <strong>{getPatientName(p)}</strong>
                          <span>{p.email || "Chưa cập nhật email"}</span>
                          <div className="mini-metrics">
                            <span>Glu: {p.latestHealth?.glucose ?? "—"}</span>
                            <span>BMI: {p.latestHealth?.bmi ?? "—"}</span>
                          </div>
                        </div>
                        <div className="mini-actions">
                          <span className={`risk ${riskClass(riskLabel(p.latestHealth))}`}>
                            {riskLabel(p.latestHealth)}
                          </span>
                          <button className="view-btn" onClick={() => openPatient(p)}>
                            <FaEye /> Hồ sơ
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="insight-panel">
                <div className="panel-kicker"><FaNotesMedical /> CLINICAL SNAPSHOT</div>
                <h2>Không bỏ sót dữ liệu quan trọng</h2>
                <p>
                  Mỗi hồ sơ bệnh nhân gom chỉ số, lịch sử, dị ứng, bệnh nền,
                  kế hoạch ăn uống và thuốc vào cùng một màn hình.
                </p>
                <div className="insight-list">
                  <div><FaCheckCircle /> Theo dõi chỉ số mới nhất</div>
                  <div><FaUtensils /> Kiểm tra kế hoạch ăn uống</div>
                  <div><FaPrescriptionBottleAlt /> Quản lý đơn thuốc</div>
                  <div><FaComments /> Trao đổi trực tiếp với bệnh nhân</div>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================= PATIENTS ================= */}
        {activeMenu === "patients" && (
          <section className="patient-table">
            <div className="table-top">
              <div>
                <h2>Danh sách bệnh nhân</h2>
                <p>Hồ sơ đầy đủ và chỉ số mới nhất.</p>
              </div>
              <div className="table-tools">
                <span className="tool-stat">{patients.length} bệnh nhân</span>
              </div>
            </div>

            {loading ? (
              <div className="empty-state"><div className="spinner" /> Đang tải...</div>
            ) : (
              <div className="patient-grid">
                {patients.map((p) => (
                  <article className="patient-profile-card" key={p._id}>
                    <div className="patient-profile-top">
                      <div className="large-avatar">
                        {getPatientName(p).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3>{getPatientName(p)}</h3>
                        <p>{p.email || "Chưa cập nhật email"}</p>
                      </div>
                      <span className={`risk ${riskClass(riskLabel(p.latestHealth))}`}>
                        {riskLabel(p.latestHealth)}
                      </span>
                    </div>

                    <div className="patient-stat-row">
                      <div><span>Glucose</span><b>{p.latestHealth?.glucose ?? "—"}</b></div>
                      <div><span>BMI</span><b>{p.latestHealth?.bmi ?? "—"}</b></div>
                      <div><span>Nhịp tim</span><b>{p.latestHealth?.heartRate ?? "—"}</b></div>
                      <div><span>HA</span><b>{p.latestHealth ? `${p.latestHealth.systolic ?? "—"}/${p.latestHealth.diastolic ?? "—"}` : "—"}</b></div>
                    </div>

                    <div className="patient-card-actions">
                      <button className="view-btn" onClick={() => openPatient(p)}>
                        <FaEye /> Xem hồ sơ
                      </button>
                      <button
                        className="soft-btn"
                        onClick={() => {
                          setActiveMenu("messages");
                          openChat(p);
                        }}
                      >
                        <FaComments /> Nhắn tin
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= MESSAGES ================= */}
        {activeMenu === "messages" && (
          <section className="messaging-shell messenger-v2">
            <aside className="conversation-sidebar">
              <div className="conversation-title">
                <div>
                  <h2>Đoạn chat</h2>
                  <span>{messagePatients.length} cuộc trò chuyện</span>
                </div>
                <FaComments />
              </div>

              <div className="message-search">
                <FaSearch />
                <input
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Tìm bệnh nhân..."
                />
              </div>

              <div className="conversation-list">
                {filteredMessagePatients.map((p) => (
                  <button
                    className={`conversation-item ${
                      selectedChat?._id === p._id ? "selected" : ""
                    }`}
                    key={p._id}
                    onClick={() => openChat(p)}
                  >
                    <div className="chat-avatar">
                      {getPatientName(p).charAt(0).toUpperCase()}
                    </div>
                    <div className="conversation-content">
                      <strong>{getPatientName(p)}</strong>
                      <span>{p.lastMessage || "Chưa có tin nhắn"}</span>
                    </div>
                    <div className="conversation-meta">
                      {p.unread > 0 && <b>{p.unread}</b>}
                      <small>
                        {p.lastMessageAt
                          ? new Date(p.lastMessageAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </small>
                    </div>
                  </button>
                ))}

                {filteredMessagePatients.length === 0 && (
                  <div className="empty-chat-list">
                    Không tìm thấy bệnh nhân.
                  </div>
                )}
              </div>
            </aside>

            <div className="chat-window">
              {!selectedChat ? (
                <div className="chat-empty">
                  <div className="chat-empty-icon"><FaComments /></div>
                  <h2>Chọn một bệnh nhân</h2>
                  <p>
                    Chọn bệnh nhân bên trái để bắt đầu hoặc tiếp tục cuộc trò chuyện.
                  </p>
                </div>
              ) : (
                <>
                  <div className="chat-header messenger-chat-header">
                    <div className="chat-user">
                      <div className="chat-avatar big">
                        {getPatientName(selectedChat).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3>{getPatientName(selectedChat)}</h3>
                        <span>{selectedChat.email || selectedChat.phone || "Bệnh nhân"}</span>
                      </div>
                    </div>

                    <button
                      className="soft-btn"
                      onClick={() => openPatient(selectedChat)}
                    >
                      <FaEye /> Xem hồ sơ
                    </button>
                  </div>

                  <div
                    ref={messageAreaRef}
                    className="messages-area messenger-messages-area"
                    onScroll={handleMessageAreaScroll}
                  >
                    {messageLoading ? (
                      <div className="empty-state">
                        <div className="spinner" />
                        Đang tải tin nhắn...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="chat-empty compact">
                        <FaEnvelope />
                        <p>Chưa có tin nhắn. Hãy gửi lời chào cho bệnh nhân.</p>
                      </div>
                    ) : (
                      messages.map((message, index) => {
                        const mine = message.senderRole === "doctor";
                        const currentDate = message.createdAt
                          ? new Date(message.createdAt).toLocaleDateString("vi-VN")
                          : "";
                        const previousDate = messages[index - 1]?.createdAt
                          ? new Date(messages[index - 1].createdAt).toLocaleDateString("vi-VN")
                          : "";
                        const showDate = currentDate && currentDate !== previousDate;

                        return (
                          <div key={message._id || index}>
                            {showDate && (
                              <div className="message-date-divider">
                                <span>{currentDate}</span>
                              </div>
                            )}

                            <div className={`message-row ${mine ? "mine" : "theirs"}`}>
                              <div className="message-bubble messenger-bubble">
                                {message.content && (
                                  <p>{message.content}</p>
                                )}
                                {renderMessageAttachment(message.attachment, mine)}
                                <small>
                                  {message.createdAt
                                    ? new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : ""}
                                  {mine && (message.read ? " · Đã xem" : " · Đã gửi")}
                                </small>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <div ref={messageEndRef} aria-hidden="true" />
                  </div>

                  {messageAttachment && (
                    <div className="message-attachment-preview">
                      <div className="attachment-preview-icon">
                        {messageAttachment.type.startsWith("image/") ? (
                          <FaImage />
                        ) : (
                          <FaFileAlt />
                        )}
                      </div>

                      <div className="attachment-preview-info">
                        <strong>{messageAttachment.name}</strong>
                        <span>{formatFileSize(messageAttachment.size)}</span>
                      </div>

                      {messageAttachment.type.startsWith("image/") && (
                        <img
                          src={messageAttachment.dataUrl}
                          alt={messageAttachment.name}
                        />
                      )}

                      <button
                        type="button"
                        onClick={removeMessageAttachment}
                        title="Bỏ tệp đính kèm"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  )}

                  <div className="message-composer messenger-composer">
                    <button
                      type="button"
                      className="message-attach-btn"
                      onClick={() => messageAttachmentInputRef.current?.click()}
                      title="Gửi ảnh hoặc tệp"
                      aria-label="Gửi ảnh hoặc tệp"
                    >
                      <FaPaperclip />
                    </button>

                    <input
                      ref={messageAttachmentInputRef}
                      type="file"
                      hidden
                      accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                      onChange={handleMessageAttachmentChange}
                    />

                    <textarea
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={`Nhắn tin cho ${getPatientName(selectedChat)}...`}
                    />

                    <button
                      className="send-message-btn messenger-send-btn"
                      disabled={
                        sendingMessage ||
                        (!messageText.trim() && !messageAttachment)
                      }
                      onClick={sendMessage}
                      title="Gửi"
                    >
                      <FaPaperPlane />
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* ================= APPOINTMENTS ================= */}
        {activeMenu === "appointment" && (
          <div className="appointment-page">
            <section className="patient-table">
              <div className="table-top">
                <div>
                  <h2>Chọn bệnh nhân để tạo lịch</h2>
                  <p>Lịch hẹn sẽ được gửi về tài khoản bệnh nhân.</p>
                </div>
              </div>

              <div className="appointment-patient-grid">
                {patients.map((p) => (
                  <button
                    className={`appointment-patient ${
                      selectedPatient?._id === p._id ? "selected" : ""
                    }`}
                    key={p._id}
                    onClick={() => setSelectedPatient(p)}
                  >
                    <div className="mini-avatar">
                      {getPatientName(p).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong>{getPatientName(p)}</strong>
                      <span>{p.email || "Chưa có email"}</span>
                    </div>
                    <FaCalendarAlt />
                  </button>
                ))}
              </div>
            </section>

            {selectedPatient && (
              <section className="appointment-box">
                <div className="appointment-header">
                  <div>
                    <span className="section-kicker">NEW APPOINTMENT</span>
                    <h2>Tạo lịch hẹn cho {getPatientName(selectedPatient)}</h2>
                    <p>Chọn thời gian và nội dung cần trao đổi.</p>
                  </div>
                  <button className="close-btn" onClick={() => setSelectedPatient(null)}>
                    <FaTimes /> Đóng
                  </button>
                </div>

                <div className="appointment-grid">
                  <div className="appointment-input">
                    <label>Ngày & giờ hẹn</label>
                    <input
                      type="datetime-local"
                      value={appointmentData.appointmentDate}
                      onChange={(e) =>
                        setAppointmentData({
                          ...appointmentData,
                          appointmentDate: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="appointment-input">
                    <label>Loại lịch hẹn</label>
                    <select
                      value={appointmentData.type}
                      onChange={(e) =>
                        setAppointmentData({
                          ...appointmentData,
                          type: e.target.value
                        })
                      }
                    >
                      <option>Tái khám</option>
                      <option>Khám tổng quát</option>
                      <option>Theo dõi tim mạch</option>
                      <option>Khẩn cấp</option>
                    </select>
                  </div>

                  <div className="appointment-input full">
                    <label>Nội dung lịch hẹn</label>
                    <textarea
                      placeholder="Nhập nội dung lịch hẹn..."
                      value={appointmentData.note}
                      onChange={(e) =>
                        setAppointmentData({
                          ...appointmentData,
                          note: e.target.value
                        })
                      }
                    />
                  </div>
                </div>

                <button className="create-appointment-btn" onClick={createAppointment}>
                  <FaCalendarAlt /> Tạo lịch hẹn
                </button>
              </section>
            )}

            <section className="patient-table">
              <div className="table-top">
                <div>
                  <h2>Lịch hẹn</h2>
                  <p>Quản lý các cuộc hẹn đã tạo.</p>
                </div>
              </div>

              <div className="appointment-list">
                {appointments.map((a) => (
                  <div className="appointment-row" key={a._id}>
                    <div className="appointment-date-icon"><FaCalendarAlt /></div>
                    <div className="appointment-main">
                      <strong>{a.patientId?.fullName || a.patientId?.username || "Bệnh nhân"}</strong>
                      <span>{formatDate(a.appointmentDate)} · {a.type}</span>
                      {a.note && <p>{a.note}</p>}
                    </div>
                    <span className={`appointment-status ${a.status}`}>
                      {a.status || "pending"}
                    </span>
                    <div className="appointment-actions">
                      {a.status !== "cancelled" && (
                        <>
                          <button
                            className="reminder-btn"
                            disabled={reminderSendingId === a._id}
                            onClick={() => sendEmailReminder(a._id)}
                          >
                            <FaEnvelope />
                            {reminderSendingId === a._id ? "Đang gửi" : "Nhắc email"}
                          </button>
                          <button
                            className="close-btn"
                            onClick={async () => {
                              const reason = window.prompt("Lý do hủy lịch?");
                              if (!reason) return;
                              try {
                                await API.put(
                                  `/appointments/cancel/${a._id}`,
                                  { reason },
                                  authConfig()
                                );
                                await fetchAppointments();
                              } catch (err) {
                                alert(err.response?.data?.msg || "Không thể hủy lịch.");
                              }
                            }}
                          >
                            Hủy
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {appointments.length === 0 && (
                  <div className="empty-state"><FaCalendarAlt /> Chưa có lịch hẹn.</div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================= AI ALERTS ================= */}
        {activeMenu === "alerts" && (
          <section className="patient-table">
            <div className="table-top">
              <div>
                <h2>Cảnh báo AI</h2>
                <p>Ưu tiên bệnh nhân có chỉ số bất thường để bác sĩ kiểm tra hồ sơ.</p>
              </div>
            </div>

            <div className="alert-grid">
              {patients
                .filter((p) => riskLabel(p.latestHealth) !== "Ổn định")
                .map((p) => (
                  <article className="alert-card" key={p._id}>
                    <div className="alert-icon"><FaExclamationTriangle /></div>
                    <div className="alert-content">
                      <strong>{getPatientName(p)}</strong>
                      <span className={`risk ${riskClass(riskLabel(p.latestHealth))}`}>
                        {riskLabel(p.latestHealth)}
                      </span>
                      <p>
                        Glucose: {p.latestHealth?.glucose ?? "—"} · BMI: {p.latestHealth?.bmi ?? "—"} ·
                        HA: {p.latestHealth ? `${p.latestHealth.systolic ?? "—"}/${p.latestHealth.diastolic ?? "—"}` : "—"}
                      </p>
                    </div>
                    <button className="view-btn" onClick={() => openPatient(p)}>
                      <FaEye /> Kiểm tra
                    </button>
                  </article>
                ))}

              {patients.filter((p) => riskLabel(p.latestHealth) !== "Ổn định").length === 0 && (
                <div className="empty-state">
                  <FaCheckCircle /> Hiện chưa có bệnh nhân nằm trong nhóm cảnh báo.
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ================= PATIENT DETAIL DRAWER ================= */}
      {selectedPatient && activeMenu !== "appointment" && (
        <div className="patient-drawer-backdrop" onClick={closePatient}>
          <aside className="patient-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-patient">
                <div className="large-avatar">
                  {getPatientName(selectedPatient).charAt(0).toUpperCase()}
                </div>
                <div>
                  <span className="section-kicker">PATIENT PROFILE</span>
                  <h2>{getPatientName(selectedPatient)}</h2>
                  <p>{selectedPatient.email || "Bệnh nhân"}</p>
                </div>
              </div>
              <button className="drawer-close" onClick={closePatient}>
                <FaTimes />
              </button>
            </div>

            {patientLoading ? (
              <div className="drawer-loading">
                <div className="spinner" />
                Đang tải toàn bộ hồ sơ...
              </div>
            ) : (
              <div className="drawer-body">
                {/* Profile */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">01 · PROFILE</span>
                      <h3>Thông tin bệnh nhân</h3>
                    </div>
                    <span className={`risk ${riskClass(riskLabel(latest))}`}>
                      {riskLabel(latest)}
                    </span>
                  </div>

                  <div className="profile-info-grid">
                    {profileFields.map(([label, value]) => (
                      <div className="profile-info" key={label}>
                        <span>{label}</span>
                        <strong>
                          {Array.isArray(value) ? value.join(", ") : value || "Chưa cập nhật"}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Latest vitals */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">02 · VITALS</span>
                      <h3>Chỉ số mới nhất</h3>
                    </div>
                    <span className="data-time">
                      <FaClock /> {formatDate(latest.createdAt)}
                    </span>
                  </div>

                  <div className="vitals-grid">
                    <div className="vital-card glucose">
                      <span>Glucose</span>
                      <strong>{latest.glucose ?? "—"}</strong>
                      <small>mg/dL</small>
                    </div>
                    <div className="vital-card bmi">
                      <span>BMI</span>
                      <strong>{latest.bmi ?? "—"}</strong>
                      <small>kg/m²</small>
                    </div>
                    <div className="vital-card heart">
                      <span>Nhịp tim</span>
                      <strong>{latest.heartRate ?? "—"}</strong>
                      <small>bpm</small>
                    </div>
                    <div className="vital-card pressure">
                      <span>Huyết áp</span>
                      <strong>
                        {latest.systolic ?? "—"}/{latest.diastolic ?? "—"}
                      </strong>
                      <small>mmHg</small>
                    </div>
                    <div className="vital-card">
                      <span>Cân nặng</span>
                      <strong>{latest.weight ?? "—"}</strong>
                      <small>kg</small>
                    </div>
                    <div className="vital-card">
                      <span>Chiều cao</span>
                      <strong>{latest.height ?? "—"}</strong>
                      <small>cm</small>
                    </div>
                  </div>
                </section>

                {/* History */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">03 · HISTORY</span>
                      <h3>Toàn bộ lịch sử sức khỏe</h3>
                    </div>
                    <span className="tool-stat">{patientHistory.length} lần ghi nhận</span>
                  </div>

                  <div className="history-table-wrap">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Glucose</th>
                          <th>BMI</th>
                          <th>Nhịp tim</th>
                          <th>Huyết áp</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...patientHistory].reverse().map((item, index) => (
                          <tr key={item._id || index}>
                            <td>{formatDate(item.createdAt)}</td>
                            <td>{item.glucose ?? "—"}</td>
                            <td>{item.bmi ?? "—"}</td>
                            <td>{item.heartRate ?? "—"}</td>
                            <td>{item.systolic ?? "—"}/{item.diastolic ?? "—"}</td>
                            <td>
                              <span className={`risk ${riskClass(riskLabel(item))}`}>
                                {riskLabel(item)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Charts */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">04 · TRENDS</span>
                      <h3>Diễn biến chỉ số</h3>
                    </div>
                  </div>

                  <div className="chart-grid">
                    <div className="doctor-chart">
                      <h4><FaHeartbeat /> Glucose</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
                          <defs>
                            <linearGradient id="doctorGlucoseGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3977f2" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#3977f2" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" tick={{ fill: "#68818b", fontSize: 11 }} tickMargin={8} minTickGap={24} padding={{ left: 12, right: 18 }} />
                          <YAxis />
                          <Tooltip />
                          <Area
                            type="monotone"
                            dataKey="glucose"
                            stroke="#3977f2"
                            fill="url(#doctorGlucoseGradient)"
                            strokeWidth={3}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="doctor-chart">
                      <h4><FaChartLine /> BMI</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData} margin={{ top: 8, right: 18, bottom: 8, left: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" tick={{ fill: "#68818b", fontSize: 11 }} tickMargin={8} minTickGap={24} padding={{ left: 12, right: 18 }} />
                          <YAxis />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="bmi"
                            stroke="#8068ee"
                            strokeWidth={3}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                {/* Care plan */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">05 · CARE PLAN</span>
                      <h3>Kế hoạch chăm sóc & ăn uống</h3>
                      <p className="care-plan-caption">Lịch trình đã lưu của bệnh nhân theo ngày và từng hoạt động.</p>
                      {carePlan?.source === "AI" && <p className="care-plan-review-note">Bệnh nhân đã tạo kế hoạch này. Hãy rà soát và điều chỉnh trước khi chốt.</p>}
                    </div>
                    <div className="care-plan-heading-actions">
                      {carePlan?.status && (
                        <span className={`plan-status ${carePlan.status}`}>
                          {carePlan.source === "AI" ? "Chờ bác sĩ rà soát" : carePlan.status === "confirmed" ? "Đã chốt" : carePlan.status === "draft" ? "Bản nháp" : carePlan.status}
                        </span>
                      )}
                      <button type="button" className="soft-btn" onClick={jumpToPrescriptionEditor}>
                        <FaPrescriptionBottleAlt /> Thêm đơn thuốc
                      </button>
                    </div>
                  </div>

                  {carePlan?.doctorNote && !carePlanEditorOpen && (
                    <div className="doctor-note">
                      <strong>Ghi chú bác sĩ</strong>
                      <p>{carePlan.doctorNote}</p>
                    </div>
                  )}

                  <div className="care-plan-toolbar">
                    <div className="care-plan-summary">
                      <FaClipboardList />
                      <span>{carePlanDays.reduce((total, day) => total + day.items.length, 0)} hoạt động · {carePlanDays.length} ngày</span>
                    </div>
                    <button type="button" className="soft-btn" onClick={() => setCarePlanEditorOpen((open) => !open)}>
                      {carePlanEditorOpen ? "Hủy chỉnh sửa" : carePlan ? "Chỉnh sửa kế hoạch" : "Tạo kế hoạch"}
                    </button>
                  </div>

                  {!carePlan && !carePlanEditorOpen && (
                    <div className="empty-inline"><FaClipboardList /> Chưa có kế hoạch đã lưu. Bảng bên dưới đang sẵn sàng để tạo lịch theo dõi.</div>
                  )}

                  <div className="care-plan-table-wrap">
                    <table className="care-plan-table">
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th>Giờ</th>
                          <th>Loại</th>
                          <th>Hoạt động</th>
                          <th>Ghi chú</th>
                          <th>{carePlanEditorOpen ? "Thao tác" : "Tình trạng"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {carePlanDays.flatMap((day) => day.items.length
                          ? day.items.map((item, itemIndex) => (
                            <tr key={item.id}>
                              {itemIndex === 0 && (
                                <th className="care-plan-day-cell" scope="rowgroup" rowSpan={day.items.length}>
                                  <span>NGÀY {day.dayIndex + 1}</span>
                                  <strong>{day.label}</strong>
                                </th>
                              )}
                              <td>
                                {carePlanEditorOpen
                                  ? <input aria-label="Giờ hoạt động" type="time" value={item.time} onChange={(event) => updateCarePlanActivity(day.dayIndex, item.id, "time", event.target.value)} />
                                  : <span className="care-plan-time">{item.time}</span>}
                              </td>
                              <td>
                                {carePlanEditorOpen
                                  ? <select aria-label="Loại hoạt động" value={item.type} onChange={(event) => updateCarePlanActivity(day.dayIndex, item.id, "type", event.target.value)}>
                                      <option value="MEAL">Bữa ăn</option><option value="EXERCISE">Vận động</option><option value="MEDICATION">Thuốc</option><option value="NOTE">Ghi chú</option>
                                    </select>
                                  : <span className={`care-plan-type ${item.type?.toLowerCase()}`}>{item.type === "MEAL" ? "Bữa ăn" : item.type === "EXERCISE" ? "Vận động" : item.type === "MEDICATION" ? "Thuốc" : "Ghi chú"}</span>}
                              </td>
                              <td>
                                {carePlanEditorOpen
                                  ? <input aria-label="Tên hoạt động" value={item.title} onChange={(event) => updateCarePlanActivity(day.dayIndex, item.id, "title", event.target.value)} placeholder="Tên hoạt động" />
                                  : <strong className="care-plan-activity-title">{item.title}</strong>}
                              </td>
                              <td>
                                {carePlanEditorOpen
                                  ? <input aria-label="Mô tả hoạt động" value={item.description} onChange={(event) => updateCarePlanActivity(day.dayIndex, item.id, "description", event.target.value)} placeholder="Ghi chú thêm (không bắt buộc)" />
                                  : <span className="care-plan-description">{item.description || "—"}</span>}
                              </td>
                              <td>
                                {carePlanEditorOpen
                                  ? <button type="button" className="care-plan-remove" aria-label="Xóa hoạt động" onClick={() => removeCarePlanActivity(day.dayIndex, item.id)}><FaTrash /></button>
                                  : <span className="care-plan-row-status">Đã lên lịch</span>}
                              </td>
                            </tr>
                          ))
                          : (
                            <tr key={`empty-day-${day.dayIndex}`} className="care-plan-empty-row">
                              <th className="care-plan-day-cell" scope="row"><span>NGÀY {day.dayIndex + 1}</span><strong>{day.label}</strong></th>
                              <td colSpan="4">Chưa có hoạt động trong ngày này</td>
                              <td>{carePlanEditorOpen && <button type="button" className="care-plan-add" onClick={() => addCarePlanActivity(day.dayIndex)}>+ Thêm hoạt động</button>}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {carePlanEditorOpen && (
                    <div className="care-plan-edit-footer">
                      <div className="care-plan-add-actions">
                        {carePlanDays.map((day) => <button type="button" key={day.dayIndex} className="care-plan-add" onClick={() => addCarePlanActivity(day.dayIndex)}>+ {day.label}</button>)}
                      </div>
                      <label htmlFor="care-plan-doctor-note">Ghi chú bác sĩ</label>
                      <textarea id="care-plan-doctor-note" rows={3} value={carePlanNote} onChange={(event) => setCarePlanNote(event.target.value)} placeholder="Trao đổi hoặc lưu ý theo dõi cho bệnh nhân..." />
                      <div className="care-plan-save-actions">
                        <button type="button" className="soft-btn" disabled={carePlanSaving} onClick={() => saveCarePlan("draft")}>{carePlanSaving ? "Đang lưu..." : "Lưu nháp"}</button>
                        <button type="button" className="view-btn" disabled={carePlanSaving} onClick={() => saveCarePlan("confirmed")}>{carePlanSaving ? "Đang lưu..." : "Chốt cho bệnh nhân"}</button>
                      </div>
                    </div>
                  )}
                </section>

                {/* Prescriptions */}
                <section className="drawer-section" id="doctor-prescription-editor">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">06 · MEDICATION</span>
                      <h3>Đơn thuốc</h3>
                    </div>
                    <span className="tool-stat">{activePrescriptionsCount} đơn đang chốt</span>
                  </div>

                  <div className="prescription-list">
                    {prescriptions.map((prescription) => (
                      <article className={`prescription-card ${prescription.status}`} key={prescription._id}>
                        <div className="prescription-head">
                          <div className="prescription-icon"><FaPrescriptionBottleAlt /></div>
                          <div>
                            <h4>{prescription.title}</h4>
                            <span>
                              {prescription.status === "confirmed"
                                ? `Đã chốt · ${formatDate(prescription.confirmedAt)}`
                                : prescription.status === "cancelled"
                                ? "Đã hủy"
                                : "Bản nháp"}
                            </span>
                          </div>

                          {prescription.status === "confirmed" && (
                            <button
                              className="close-btn"
                              onClick={() => cancelPrescription(prescription)}
                            >
                              <FaTimes /> Hủy đơn
                            </button>
                          )}
                        </div>

                        {prescription.note && (
                          <p className="prescription-note">{prescription.note}</p>
                        )}

                        <div className="medicine-list">
                          {safeArray(prescription.medicines).map((medicine, index) => (
                            <div className="medicine-row" key={`${prescription._id}-${index}`}>
                              <div className="medicine-name">
                                <FaCheckCircle />
                                <strong>{medicine.name}</strong>
                              </div>
                              <span>{medicine.dosage || "Theo chỉ định"}</span>
                              <span>{medicine.frequency}</span>
                              <span>{safeArray(medicine.times).join(", ")}</span>
                              {medicine.mealRelation && (
                                <span>
                                  {medicine.mealRelation === "BEFORE_MEAL"
                                    ? "Trước ăn"
                                    : "Sau ăn"}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}

                    {prescriptions.length === 0 && (
                      <div className="empty-inline">
                        <FaPrescriptionBottleAlt />
                        Bệnh nhân chưa có đơn thuốc.
                      </div>
                    )}
                  </div>

                  <div className="prescription-editor">
                    <div className="editor-title">
                      <div>
                        <span className="section-kicker">NEW PRESCRIPTION</span>
                        <h4>Tạo đơn thuốc mới</h4>
                      </div>
                      <button className="soft-btn" onClick={addMedicine}>
                        <FaPlus /> Thêm thuốc
                      </button>
                    </div>

                    <div className="appointment-grid">
                      <div className="appointment-input">
                        <label>Tên đơn thuốc</label>
                        <input
                          value={prescriptionForm.title}
                          onChange={(e) =>
                            setPrescriptionForm({
                              ...prescriptionForm,
                              title: e.target.value
                            })
                          }
                        />
                      </div>
                      <div className="appointment-input">
                        <label>Ghi chú</label>
                        <input
                          value={prescriptionForm.note}
                          onChange={(e) =>
                            setPrescriptionForm({
                              ...prescriptionForm,
                              note: e.target.value
                            })
                          }
                          placeholder="Ví dụ: dùng trong 30 ngày..."
                        />
                      </div>
                    </div>

                    <div className="medicine-editor-list">
                      {prescriptionForm.medicines.map((medicine, index) => (
                        <div className="medicine-editor-row" key={index}>
                          <div className="medicine-number">{index + 1}</div>
                          <div className="appointment-input">
                            <label>Tên thuốc</label>
                            <input
                              value={medicine.name}
                              onChange={(e) => updateMedicine(index, "name", e.target.value)}
                              placeholder="Tên thuốc"
                            />
                          </div>
                          <div className="appointment-input">
                            <label>Liều dùng</label>
                            <input
                              value={medicine.dosage}
                              onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                              placeholder="500mg..."
                            />
                          </div>
                          <div className="appointment-input">
                            <label>Tần suất</label>
                            <input
                              value={medicine.frequency}
                              onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                              placeholder="2 lần/ngày"
                            />
                          </div>
                          <div className="appointment-input">
                            <label>Giờ uống</label>
                            <input
                              value={medicine.times.join(", ")}
                              onChange={(e) =>
                                updateMedicine(
                                  index,
                                  "times",
                                  e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean)
                                )
                              }
                              placeholder="07:00, 19:00"
                            />
                          </div>
                          <div className="appointment-input">
                            <label>Liên quan bữa ăn</label>
                            <select
                              value={medicine.mealRelation}
                              onChange={(e) => updateMedicine(index, "mealRelation", e.target.value)}
                            >
                              <option value="">Không chỉ định</option>
                              <option value="BEFORE_MEAL">Trước ăn</option>
                              <option value="AFTER_MEAL">Sau ăn</option>
                            </select>
                          </div>
                          <button
                            className="icon-danger-btn"
                            type="button"
                            onClick={() => removeMedicine(index)}
                            title="Xóa thuốc"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      className="create-appointment-btn full-action"
                      disabled={savingPrescription}
                      onClick={createPrescription}
                    >
                      <FaCheckCircle />
                      {savingPrescription ? "Đang chốt đơn..." : "Chốt đơn thuốc"}
                    </button>
                  </div>
                </section>

                {/* Advice */}
                <section className="drawer-section">
                  <div className="section-heading">
                    <div>
                      <span className="section-kicker">07 · COMMUNICATION</span>
                      <h3>Gửi lời khuyên</h3>
                    </div>
                  </div>

                  <div className="advice-editor">
                    <input
                      value={adviceData.title}
                      onChange={(e) =>
                        setAdviceData({ ...adviceData, title: e.target.value })
                      }
                      placeholder="Tiêu đề lời khuyên"
                    />
                    <textarea
                      value={adviceData.message}
                      onChange={(e) =>
                        setAdviceData({ ...adviceData, message: e.target.value })
                      }
                      placeholder="Nhập hướng dẫn cho bệnh nhân..."
                    />
                    <div className="advice-actions">
                      <button
                        className="soft-btn"
                        onClick={() => {
                          setActiveMenu("messages");
                          openChat(selectedPatient);
                        }}
                      >
                        <FaComments /> Mở tin nhắn
                      </button>
                      <button
                        className="create-appointment-btn"
                        onClick={() => sendAdvice(selectedPatient._id)}
                      >
                        <FaEnvelope /> Gửi lời khuyên
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
