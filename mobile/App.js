import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  ActivityIndicator,
  AppState,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://doctis.vercel.app/api').replace(/\/$/, '');
const TOKEN_KEY = 'doctis.session.token';
const USER_KEY = 'doctis.session.user';
const NAV_ITEMS = [
  { id: 'home', label: 'Tổng quan', icon: '⌂' },
  { id: 'health', label: 'Sức khỏe', icon: '＋' },
  { id: 'care', label: 'Chăm sóc', icon: '♡' },
  { id: 'appointments', label: 'Lịch hẹn', icon: '▦' },
  { id: 'profile', label: 'Hồ sơ', icon: '○' },
];

async function api(path, { token, method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.');
  }
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    throw new Error(data?.msg || data?.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
  }
  return data;
}

const asArray = (value) => Array.isArray(value) ? value : [];
const mergeMessages = (previous, incoming) => {
  const oldById = new Map(previous.map((message) => [String(message?._id || ''), message]));
  const serverIds = new Set(incoming.map((message) => String(message?._id || '')));
  const pending = previous.filter((message) => String(message?._id || '').startsWith('temp-') && !serverIds.has(String(message._id)));
  return [
    ...incoming.map((message) => {
      const old = oldById.get(String(message?._id || ''));
      return old?.attachment && !message?.attachment ? { ...message, attachment: old.attachment } : message;
    }),
    ...pending,
  ];
};
const fullName = (user) => user?.fullName || user?.username || 'Bạn';
const displayDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
};
const prettyStatus = (value) => ({ pending: 'Đang chờ', approved: 'Đã xác nhận', completed: 'Đã khám', cancelled: 'Đã hủy', confirmed: 'Đã chốt', draft: 'Bản nháp' }[value] || value || '—');

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, onFocus, autoCapitalize = 'sentences', autoCorrect = false }) {
  return (
    <View style={styles.fieldWrap}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#94a8af"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onFocus={onFocus}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
    </View>
  );
}

function ActionButton({ title, onPress, secondary, disabled, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed, style]}>
      {disabled ? <ActivityIndicator color={secondary ? '#087d83' : '#fff'} /> : <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>}
    </Pressable>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ cccd: '', username: '', email: '', password: '', confirmPassword: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [healthForm, setHealthForm] = useState({ height: '', weight: '', glucose: '', systolic: '', diastolic: '', heartRate: '' });
  const [healthBusy, setHealthBusy] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [carePlan, setCarePlan] = useState(null);
  const [careActiveDay, setCareActiveDay] = useState(0);
  const [careDoneIds, setCareDoneIds] = useState([]);
  const [careRemindedIds, setCareRemindedIds] = useState([]);
  const [careReminderBusyId, setCareReminderBusyId] = useState('');
  const [prescriptions, setPrescriptions] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [messages, setMessages] = useState([]);
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', text: 'Xin chào! Mình là trợ lý kiến thức sức khỏe DOCTIS, tập trung vào đái tháo đường type 2. Bạn có thể hỏi về theo dõi đường huyết, ăn uống, vận động, thuốc và biến chứng.' }]);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNudgeVisible, setAiNudgeVisible] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [messageAttachment, setMessageAttachment] = useState(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const messagePollBusy = useRef(false);
  const screenScrollRef = useRef(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const setAuthValue = (key, value) => setAuthForm((previous) => ({ ...previous, [key]: value }));
  const patientMode = user?.role === 'user';

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const loadData = useCallback(async (activeToken, quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    const jobs = await Promise.allSettled([
      api('/profile', { token: activeToken }),
      api('/health/latest', { token: activeToken }),
      api('/health/history', { token: activeToken }),
      api('/appointments/patient', { token: activeToken }),
      api('/care-plans/my/mobile', { token: activeToken }),
      api('/prescriptions/my', { token: activeToken }),
      api('/messages/doctors', { token: activeToken }),
    ]);
    const [profileResult, healthResult, historyResult, appointmentsResult, planResult, prescriptionsResult, doctorsResult] = jobs;
    if (profileResult.status === 'rejected' && /hết hạn|đăng nhập lại/i.test(profileResult.reason?.message || '')) {
      await signOut();
      setError(profileResult.reason.message);
      setLoading(false);
      return;
    }
    if (profileResult.status === 'fulfilled') {
      setProfile(profileResult.value);
      setUser((previous) => ({ ...previous, ...profileResult.value }));
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profileResult.value));
    } else {
      setError(profileResult.reason?.message || 'Không tải được hồ sơ.');
    }
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (historyResult.status === 'fulfilled') setHistory(asArray(historyResult.value));
    if (appointmentsResult.status === 'fulfilled') setAppointments(asArray(appointmentsResult.value));
    if (planResult.status === 'fulfilled') setCarePlan(planResult.value);
    else if (planResult.reason?.message?.includes('Chưa có')) setCarePlan(null);
    if (prescriptionsResult.status === 'fulfilled') setPrescriptions(asArray(prescriptionsResult.value));
    if (doctorsResult.status === 'fulfilled') {
      const list = asArray(doctorsResult.value);
      setDoctors(list);
      setDoctor((previous) => list.find((item) => String(item._id) === String(previous?._id)) || list[0] || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const planId = carePlan?._id;
    if (!planId) {
      setCareDoneIds([]);
      setCareActiveDay(0);
      return () => { active = false; };
    }
    SecureStore.getItemAsync(`doctis.care.done.${planId}`)
      .then((value) => {
        if (!active) return;
        const saved = value ? JSON.parse(value) : [];
        setCareDoneIds(Array.isArray(saved) ? saved : []);
      })
      .catch(() => { if (active) setCareDoneIds([]); });
    setCareActiveDay(0);
    setCareRemindedIds([]);
    return () => { active = false; };
  }, [carePlan?._id]);

  const toggleCareActivity = (activityKey) => {
    const planId = carePlan?._id;
    if (!planId) return;
    setCareDoneIds((previous) => {
      const next = previous.includes(activityKey)
        ? previous.filter((key) => key !== activityKey)
        : [...previous, activityKey];
      SecureStore.setItemAsync(`doctis.care.done.${planId}`, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const createCareReminder = async (day, item, dayIndex) => {
    const activityKey = `${carePlan?._id}-${day?.dayIndex ?? dayIndex}-${item?.id || item?.time}`;
    if (!item?.time || careReminderBusyId || careRemindedIds.includes(activityKey)) return;
    setCareReminderBusyId(activityKey);
    try {
      const scheduledDate = new Date();
      scheduledDate.setHours(0, 0, 0, 0);
      scheduledDate.setDate(scheduledDate.getDate() + Number(day?.dayIndex ?? dayIndex));
      const scheduleDate = [scheduledDate.getFullYear(), String(scheduledDate.getMonth() + 1).padStart(2, '0'), String(scheduledDate.getDate()).padStart(2, '0')].join('-');
      await api('/reminders/create', {
        token,
        method: 'POST',
        body: {
          title: `${item.title || 'Hoạt động chăm sóc'} — ${day?.label || `Ngày ${dayIndex + 1}`}`,
          description: item.description || 'Nhắc nhở trong kế hoạch chăm sóc.',
          time: item.time,
          source: 'CARE_PLAN',
          activityType: item.type || 'HEALTH',
          dayLabel: day?.label || '',
          scheduleDate,
        },
      });
      setCareRemindedIds((previous) => [...previous, activityKey]);
      Alert.alert('Đã tạo nhắc nhở', `Đã bật nhắc cho ${item.time}. Email sẽ được gửi theo cấu hình của tài khoản.`);
    } catch (err) {
      Alert.alert('Chưa tạo được nhắc nhở', err.message || 'Vui lòng thử lại sau.');
    } finally {
      setCareReminderBusyId('');
    }
  };

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setToken('');
    setUser(null);
    setProfile(null);
    setTab('home');
    setAiInput('');
    setAiNudgeVisible(true);
    setAiMessages([{ role: 'assistant', text: 'Xin chào! Mình là trợ lý kiến thức sức khỏe DOCTIS, tập trung vào đái tháo đường type 2. Bạn có thể hỏi về theo dõi đường huyết, ăn uống, vận động, thuốc và biến chứng.' }]);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(USER_KEY);
        if (savedToken && savedUser && active) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
          await loadData(savedToken, true);
        }
      } catch {
        if (active) setError('Không thể khôi phục phiên đăng nhập. Hãy đăng nhập lại.');
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => { active = false; };
  }, [loadData]);

  useEffect(() => {
    if (token && user?.role === 'user') loadData(token, true);
  }, [tab, token, user?.role, loadData]);

  useEffect(() => {
    if (!token || !doctor?._id || tab !== 'messages') return;
    let active = true;
    const refreshMessages = async () => {
      if (!active || messagePollBusy.current || AppState.currentState !== 'active') return;
      messagePollBusy.current = true;
      try {
        const result = await api(`/messages/doctor/${doctor._id}`, { token });
        if (active) setMessages((previous) => mergeMessages(previous, asArray(result)));
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        messagePollBusy.current = false;
      }
    };
    refreshMessages();
    const interval = setInterval(refreshMessages, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [token, doctor?._id, tab]);

  const submitAuth = async () => {
    const email = authForm.email.trim().toLowerCase();
    if (!email || !authForm.password) return setError('Nhập email và mật khẩu để tiếp tục.');
    if (authMode === 'register') {
      if (!authForm.cccd.trim() || !authForm.username.trim()) return setError('Nhập đầy đủ CCCD và tên tài khoản.');
      if (authForm.password.length < 8) return setError('Mật khẩu nên có ít nhất 8 ký tự.');
      if (authForm.password !== authForm.confirmPassword) return setError('Mật khẩu xác nhận chưa khớp.');
    }
    setAuthBusy(true);
    setError('');
    setNotice('');
    try {
      if (authMode === 'register') {
        await api('/auth/register', { method: 'POST', body: { cccd: authForm.cccd.trim(), username: authForm.username.trim(), email, password: authForm.password, confirmPassword: authForm.confirmPassword } });
        setAuthForm({ cccd: '', username: '', email, password: '', confirmPassword: '' });
        setAuthMode('login');
        setNotice('Tạo tài khoản thành công. Đăng nhập để bắt đầu sử dụng DOCTIS.');
      } else {
        const result = await api('/auth/login', { method: 'POST', body: { email, password: authForm.password } });
        await SecureStore.setItemAsync(TOKEN_KEY, result.token);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
        setToken(result.token);
        setUser(result.user);
        setProfile(result.user);
        setAuthForm({ cccd: '', username: '', email: '', password: '', confirmPassword: '' });
        setTab('home');
        if (result.user?.role !== 'user') setNotice('Phiên bản mobile hiện dành cho tài khoản bệnh nhân. Bác sĩ và quản trị viên vui lòng dùng website DOCTIS.');
        else await loadData(result.token, true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const refresh = () => token && loadData(token);

  const submitHealth = async () => {
    const numeric = ['height', 'weight', 'glucose', 'systolic', 'diastolic', 'heartRate'];
    if (!healthForm.height || !healthForm.weight) return setError('Chiều cao và cân nặng là thông tin bắt buộc.');
    const body = Object.fromEntries(numeric.map((key) => [key, healthForm[key] === '' ? null : Number(healthForm[key])]));
    if (Object.values(body).some((value) => value !== null && !Number.isFinite(value))) return setError('Các chỉ số phải là số hợp lệ.');
    setHealthBusy(true);
    setError('');
    try {
      const saved = await api('/health/add', { token, method: 'POST', body });
      setHealth(saved);
      setHistory((previous) => [saved, ...previous]);
      setHealthForm({ height: '', weight: '', glucose: '', systolic: '', diastolic: '', heartRate: '' });
      setNotice('Đã lưu chỉ số sức khỏe vào hồ sơ của bạn.');
    } catch (err) { setError(err.message); }
    finally { setHealthBusy(false); }
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    setError('');
    try {
      const result = await api('/profile', { token, method: 'PUT', body: profile });
      const saved = result.profile || profile;
      setProfile(saved);
      setUser((previous) => ({ ...previous, ...saved }));
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(saved));
      setEditingProfile(false);
      setNotice('Đã cập nhật hồ sơ.');
    } catch (err) { setError(err.message); }
    finally { setProfileBusy(false); }
  };

  const cancelAppointment = (appointment) => Alert.alert('Hủy lịch hẹn?', 'Lịch hẹn sẽ được chuyển sang trạng thái đã hủy.', [
    { text: 'Để sau', style: 'cancel' },
    { text: 'Hủy lịch', style: 'destructive', onPress: async () => {
      try {
        await api(`/appointments/cancel/${appointment._id}`, { token, method: 'PUT', body: { reason: 'Bệnh nhân hủy trên ứng dụng mobile' } });
        await loadData(token, true);
        setNotice('Đã hủy lịch hẹn.');
      } catch (err) { setError(err.message); }
    } },
  ]);

  const sendMessage = async () => {
    const content = messageText.trim();
    if (!doctor?._id || (!content && !messageAttachment)) return;
    setMessageBusy(true);
    try {
      await api('/messages/send', { token, method: 'POST', body: { receiverId: doctor._id, content, attachment: messageAttachment } });
      setMessageText('');
      setMessageAttachment(null);
      const result = await api(`/messages/doctor/${doctor._id}`, { token });
      setMessages((previous) => mergeMessages(previous, asArray(result)));
    } catch (err) { setError(err.message); }
    finally { setMessageBusy(false); }
  };

  const sendAIMessage = async () => {
    const message = aiInput.trim();
    if (!message || aiBusy) return;
    const requestId = `${Date.now()}-${Math.random()}`;

    const history = aiMessages
      .filter((item) => !item.isError && (item.role === 'user' || item.role === 'assistant'))
      .slice(-10)
      .map(({ role, text }) => ({ role, content: text }));

    setAiMessages((previous) => [...previous, { role: 'user', text: message, requestId }]);
    setAiInput('');
    setAiBusy(true);
    try {
      const result = await api('/ai/analyze', {
        token,
        method: 'POST',
        body: {
          message,
          history,
          glucose: health?.glucose ?? 0,
          bmi: health?.bmi ?? 0,
          bloodPressure: health?.systolic != null && health?.diastolic != null
            ? `${health.systolic}/${health.diastolic}`
            : '',
          heartRate: health?.heartRate ?? 0,
        },
      });
      setAiMessages((previous) => [...previous, {
        role: 'assistant',
        text: result?.reply || 'Mình chưa nhận được phản hồi. Bạn thử hỏi lại nhé.',
      }]);
    } catch (err) {
      setAiMessages((previous) => previous.filter((item) => item.requestId !== requestId));
      setAiInput((previous) => previous || message);
      setAiMessages((previous) => [...previous, {
        role: 'assistant',
        text: err.message || 'Chưa kết nối được DOCTIS AI. Vui lòng thử lại sau.',
        isError: true,
      }]);
    } finally {
      setAiBusy(false);
    }
  };

  const chooseMessageAttachment = async (kind) => {
    setAttachmentBusy(true);
    try {
      const result = kind === 'image'
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.9,
          })
        : await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
            multiple: false,
          });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const selectedSize = asset.size || asset.fileSize || 0;
      if (selectedSize > 8 * 1024 * 1024) {
        Alert.alert('Tệp quá lớn', 'Vui lòng chọn tệp nhỏ hơn 8 MB.');
        return;
      }
      const type = asset.mimeType || (kind === 'image' ? 'image/jpeg' : 'application/octet-stream');
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const size = selectedSize || Math.floor(base64.length * 0.75);
      if (size > 8 * 1024 * 1024) {
        Alert.alert('Tệp quá lớn', 'Vui lòng chọn tệp nhỏ hơn 8 MB.');
        return;
      }
      setMessageAttachment({
        name: asset.name || asset.fileName || (kind === 'image' ? 'anh-dinh-kem.jpg' : 'tep-dinh-kem'),
        type,
        size,
        dataUrl: `data:${type};base64,${base64}`,
      });
    } catch (err) {
      Alert.alert('Không thể đính kèm', err.message || 'Hãy thử chọn tệp khác.');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const openMessageAttachment = async (attachment) => {
    try {
      const fileName = String(attachment.name || 'tep-dinh-kem').replace(/[\\/:*?"<>|]/g, '_').trim() || 'tep-dinh-kem';
      const fileUri = `${FileSystem.cacheDirectory}${Date.now()}-${fileName}`;
      let localUri = fileUri;
      const source = attachment.dataUrl || attachment.url || attachment.fileUrl || attachment.src || '';
      if (source.startsWith('data:')) {
        const base64 = source.slice(source.indexOf(',') + 1);
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      } else if (/^https?:\/\//i.test(source)) {
        const downloaded = await FileSystem.downloadAsync(source, fileUri);
        localUri = downloaded.uri;
      } else if (source.startsWith('file://')) {
        localUri = source;
      } else {
        throw new Error('Tệp này không có dữ liệu để mở.');
      }
      if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị hiện không hỗ trợ mở/chia sẻ tệp.');
      await Sharing.shareAsync(localUri, { mimeType: attachment.type || 'application/octet-stream', dialogTitle: `Mở hoặc lưu ${attachment.name || 'tệp đính kèm'}` });
    } catch (err) {
      Alert.alert('Không thể mở tệp', err.message || 'Vui lòng thử lại.');
    }
  };

  const greeting = useMemo(() => fullName(profile || user), [profile, user]);

  if (booting) return <LoadingScreen />;
  if (!token || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
            <BrandHeader />
            <View style={styles.authHero}>
              <Text style={styles.authEyebrow}>DOCTIS · CHĂM SÓC SỨC KHỎE</Text>
              <Text style={styles.authTitle}>{authMode === 'login' ? 'Chào mừng bạn trở lại' : 'Tạo tài khoản DOCTIS'}</Text>
              <Text style={styles.authSubtitle}>Theo dõi sức khỏe đái tháo đường type 2 và kết nối với bác sĩ phụ trách.</Text>
            </View>
            {!!error && <Notice tone="error" text={error} />}
            {!!notice && <Notice text={notice} />}
            <Card style={styles.authCard}>
              {authMode === 'register' && <>
                <Field label="Số CCCD" value={authForm.cccd} onChangeText={(value) => setAuthValue('cccd', value)} keyboardType="number-pad" />
                <Field label="Tên tài khoản" value={authForm.username} onChangeText={(value) => setAuthValue('username', value)} autoCapitalize="none" />
              </>}
              <Field label="Email" value={authForm.email} onChangeText={(value) => setAuthValue('email', value)} keyboardType="email-address" autoCapitalize="none" />
              <Field label="Mật khẩu" value={authForm.password} onChangeText={(value) => setAuthValue('password', value)} secureTextEntry />
              {authMode === 'register' && <Field label="Nhập lại mật khẩu" value={authForm.confirmPassword} onChangeText={(value) => setAuthValue('confirmPassword', value)} secureTextEntry />}
              <ActionButton title={authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} onPress={submitAuth} disabled={authBusy} style={styles.authSubmit} />
              <Pressable style={styles.switchAuth} onPress={() => { setError(''); setNotice(''); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}>
                <Text style={styles.switchText}>{authMode === 'login' ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}<Text style={styles.switchStrong}>{authMode === 'login' ? 'Đăng ký' : 'Đăng nhập'}</Text></Text>
              </Pressable>
            </Card>
            <Text style={styles.authFootnote}>Bằng cách tiếp tục, bạn đồng ý sử dụng DOCTIS để quản lý thông tin sức khỏe cá nhân.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (!patientMode) {
    return <SafeAreaView style={styles.safeArea}><StatusBar style="dark" /><ScrollView contentContainerStyle={styles.page}><BrandHeader /><Notice text="Phiên bản mobile hiện hỗ trợ tài khoản bệnh nhân. Vui lòng dùng DOCTIS trên web với tài khoản bác sĩ hoặc quản trị viên." /><ActionButton title="Đăng xuất" onPress={signOut} secondary /></ScrollView></SafeAreaView>;
  }

  const renderScreen = () => {
    if (tab === 'health') return <HealthScreen health={health} history={history} form={healthForm} setForm={setHealthForm} onSave={submitHealth} busy={healthBusy} />;
    if (tab === 'care') return <CareScreen carePlan={carePlan} prescriptions={prescriptions} activeDay={careActiveDay} setActiveDay={setCareActiveDay} doneIds={careDoneIds} onToggleActivity={toggleCareActivity} remindedIds={careRemindedIds} reminderBusyId={careReminderBusyId} onCreateReminder={createCareReminder} />;
    if (tab === 'appointments') return <AppointmentsScreen appointments={appointments} onCancel={cancelAppointment} />;
    if (tab === 'profile') return <ProfileScreen profile={profile || user} editing={editingProfile} setEditing={setEditingProfile} setProfile={setProfile} onSave={saveProfile} busy={profileBusy} onSignOut={signOut} />;
    if (tab === 'ai') return <AIChatScreen messages={aiMessages} value={aiInput} setValue={setAiInput} onSend={sendAIMessage} busy={aiBusy} onBack={() => setTab('home')} />;
    if (tab === 'messages') return <MessagesScreen doctors={doctors} doctor={doctor} setDoctor={setDoctor} messages={messages} user={user} value={messageText} setValue={setMessageText} onSend={sendMessage} busy={messageBusy} attachment={messageAttachment} attachmentBusy={attachmentBusy} onChooseAttachment={chooseMessageAttachment} onRemoveAttachment={() => setMessageAttachment(null)} onOpenAttachment={openMessageAttachment} onComposerFocus={() => setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 300)} />;
    return <HomeScreen user={profile || user} greeting={greeting} health={health} appointments={appointments} carePlan={carePlan} onNavigate={setTab} />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.appHeader}>
        <BrandHeader compact />
        <Pressable style={styles.avatarButton} onPress={() => setTab('profile')}><Text style={styles.avatarText}>{greeting.slice(0, 1).toUpperCase()}</Text></Pressable>
      </View>
      {!!error && <Notice tone="error" text={error} onClose={() => setError('')} />}
      {!!notice && <Notice text={notice} onClose={() => setNotice('')} />}
      <ScrollView
        key={tab}
        ref={screenScrollRef}
        style={styles.flex}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#087d83" />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {renderScreen()}
      </ScrollView>
      {!keyboardVisible && <View style={styles.tabBar}>
        {NAV_ITEMS.map((item) => (
          <Pressable key={item.id} style={styles.tabItem} onPress={() => { setError(''); setNotice(''); setTab(item.id); }}>
            <View style={[styles.tabIconWrap, tab === item.id && styles.tabIconActive]}><Text style={[styles.tabIcon, tab === item.id && styles.tabIconSelected]}>{item.icon}</Text></View>
            <Text numberOfLines={1} style={[styles.tabLabel, tab === item.id && styles.tabLabelSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>}
      </KeyboardAvoidingView>
      {token && patientMode && tab !== 'ai' && !keyboardVisible && (
        <View pointerEvents="box-none" style={styles.aiFloatingLayer}>
          {aiNudgeVisible && (
            <View style={styles.aiWelcomeCard}>
              <Text style={styles.aiWelcomeRobot}>🤖</Text>
              <Text style={styles.aiWelcomeText}>Bạn có cần DOCTIS AI hỗ trợ gì không?</Text>
              <Pressable style={styles.aiWelcomeClose} onPress={() => setAiNudgeVisible(false)} accessibilityRole="button" accessibilityLabel="Đóng lời mời DOCTIS AI">
                <Text style={styles.aiWelcomeCloseText}>×</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            style={styles.aiFloatingButton}
            onPress={() => { setAiNudgeVisible(false); setTab('ai'); }}
            accessibilityRole="button"
            accessibilityLabel="Mở trò chuyện với DOCTIS AI"
          >
            <Text style={styles.aiFloatingIcon}>🤖</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function BrandHeader({ compact = false }) {
  return (
    <View style={[styles.brandHeader, compact && styles.brandHeaderCompact]}>
      <View style={styles.logo}><Text style={styles.logoText}>♥</Text></View>
      <View><Text style={styles.brand}>DOCTIS</Text><Text style={styles.brandCaption}>SỨC KHỎE THÔNG MINH</Text></View>
      {!compact && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>Bảo mật</Text></View>}
    </View>
  );
}

function Notice({ text, tone = 'success', onClose }) {
  return <Pressable onPress={onClose} style={[styles.notice, tone === 'error' && styles.noticeError]}><Text style={[styles.noticeText, tone === 'error' && styles.noticeErrorText]}>{text}</Text>{!!onClose && <Text style={styles.noticeClose}>×</Text>}</Pressable>;
}

function LoadingScreen() {
  return <SafeAreaView style={[styles.safeArea, styles.loadingScreen]}><ActivityIndicator size="large" color="#087d83" /><Text style={styles.loadingLabel}>Đang mở DOCTIS…</Text></SafeAreaView>;
}

function HomeScreen({ user, greeting, health, appointments, carePlan, onNavigate }) {
  const upcoming = asArray(appointments).find((item) => ['pending', 'approved'].includes(item.status));
  return <>
    <View style={styles.homeHero}>
      <Text style={styles.heroEyebrow}>THEO DÕI SỨC KHỎE CÙNG DOCTIS</Text>
      <Text style={styles.homeTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>Xin chào, {greeting}</Text>
      <Text style={styles.homeDescription}>Ghi lại chỉ số và theo dõi kế hoạch chăm sóc của bạn mỗi ngày.</Text>
      <View style={styles.heroStats}><Metric light label="HUYẾT ÁP GẦN NHẤT" value={health?.systolic != null && health?.diastolic != null ? `${health.systolic}/${health.diastolic}` : '—'} unit="mmHg" /><View style={styles.statDivider} /><Metric light label="BMI GẦN NHẤT" value={health?.bmi == null ? '—' : `${health.bmi}`} unit="kg/m²" /></View>
    </View>
    <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Truy cập nhanh</Text><Text style={styles.sectionSubtitle}>Các tiện ích trong tài khoản của bạn</Text></View></View>
    <View style={styles.quickGrid}>
      <QuickCard icon="＋" title="Cập nhật sức khỏe" detail="Thêm chỉ số mới" tint="#e7f7f7" onPress={() => onNavigate('health')} />
      <QuickCard icon="♡" title="Kế hoạch chăm sóc" detail={carePlan ? 'Xem kế hoạch bác sĩ' : 'Chưa có kế hoạch chốt'} tint="#eef1ff" onPress={() => onNavigate('care')} />
      <QuickCard icon="▦" title="Lịch hẹn" detail={upcoming ? displayDate(upcoming.appointmentDate) : 'Xem lịch khám'} tint="#fff4e7" onPress={() => onNavigate('appointments')} />
      <QuickCard icon="✚" title="Trò chuyện bác sĩ" detail="Trao đổi với bác sĩ phụ trách" tint="#f1ecff" onPress={() => onNavigate('messages')} />
    </View>
    <Card style={styles.dashboardCard}><View style={styles.cardHeading}><View><Text style={styles.cardTitle}>Chỉ số sức khỏe gần nhất</Text><Text style={styles.cardSub}>{health?.createdAt ? `Cập nhật ${displayDate(health.createdAt)}` : 'Chưa có dữ liệu được ghi nhận'}</Text></View><Text style={styles.statusDot}>●</Text></View><View style={styles.metricGrid}><Metric label="GLUCOSE" value={health?.glucose ?? '—'} unit="mg/dL" /><Metric label="HUYẾT ÁP" value={health?.systolic != null && health?.diastolic != null ? `${health.systolic}/${health.diastolic}` : '—'} unit="mmHg" /><Metric label="NHỊP TIM" value={health?.heartRate ?? '—'} unit="bpm" /><Metric label="CÂN NẶNG" value={health?.weight ?? '—'} unit="kg" /></View></Card>
    {user?.chronicDiseases ? <Card><Text style={styles.cardTitle}>Thông tin sức khỏe cần lưu ý</Text><Text style={styles.bodyText}>{user.chronicDiseases}</Text>{user.allergies ? <Text style={styles.bodyMuted}>Dị ứng: {user.allergies}</Text> : null}</Card> : null}
    <Text style={styles.disclaimer}>DOCTIS hỗ trợ theo dõi thông tin sức khỏe, không thay thế chẩn đoán hoặc điều trị của nhân viên y tế.</Text>
  </>;
}

function Metric({ label, value, unit, light = false }) {
  return <View style={styles.metric}><Text style={[styles.metricLabel, light && styles.metricLabelLight]}>{label}</Text><Text style={[styles.metricValue, light && styles.metricValueLight]}>{value}<Text style={[styles.metricUnit, light && styles.metricUnitLight]}>{unit ? ` ${unit}` : ''}</Text></Text></View>;
}

function QuickCard({ icon, title, detail, tint, onPress }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.quickPressed]}><View style={[styles.quickIcon, { backgroundColor: tint }]}><Text style={styles.quickIconText}>{icon}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text numberOfLines={2} style={styles.quickDetail}>{detail}</Text><Text style={styles.quickArrow}>↗</Text></Pressable>;
}

function ScreenTitle({ eyebrow, title, subtitle }) {
  return <View style={styles.screenTitleWrap}><Text style={styles.screenEyebrow}>{eyebrow}</Text><Text style={styles.screenTitle}>{title}</Text><Text style={styles.screenSubtitle}>{subtitle}</Text></View>;
}

function HealthScreen({ health, history, form, setForm, onSave, busy }) {
  const inputs = [
    ['height', 'Chiều cao (cm)', 'numeric'], ['weight', 'Cân nặng (kg)', 'decimal-pad'],
    ['glucose', 'Đường huyết (mg/dL)', 'decimal-pad'], ['systolic', 'Huyết áp tâm thu', 'number-pad'],
    ['diastolic', 'Huyết áp tâm trương', 'number-pad'], ['heartRate', 'Nhịp tim (bpm)', 'number-pad'],
  ];
  return <>
    <ScreenTitle eyebrow="SỨC KHỎE CỦA BẠN" title="Chỉ số sức khỏe" subtitle="Ghi nhận dữ liệu để theo dõi thay đổi theo thời gian." />
    <Card><Text style={styles.cardTitle}>Chỉ số mới nhất</Text><Text style={styles.cardSub}>{health?.createdAt ? displayDate(health.createdAt) : 'Chưa có dữ liệu'}</Text><View style={styles.metricGrid}><Metric label="GLUCOSE" value={health?.glucose ?? '—'} unit="mg/dL" /><Metric label="BMI" value={health?.bmi ?? '—'} unit="kg/m²" /><Metric label="HUYẾT ÁP" value={health?.systolic != null && health?.diastolic != null ? `${health.systolic}/${health.diastolic}` : '—'} unit="mmHg" /><Metric label="NHỊP TIM" value={health?.heartRate ?? '—'} unit="bpm" /></View>{health?.risk ? <View style={styles.riskPill}><Text style={styles.riskText}>Đánh giá hệ thống: {health.risk}</Text></View> : null}</Card>
    <Card><Text style={styles.cardTitle}>Thêm lần đo</Text><Text style={styles.cardSub}>Chiều cao và cân nặng là bắt buộc để tính BMI.</Text><View style={styles.formGrid}>{inputs.map(([key, label, keyboardType]) => <View key={key} style={styles.formGridItem}><Field label={label} value={form[key]} keyboardType={keyboardType} onChangeText={(value) => setForm((previous) => ({ ...previous, [key]: value }))} /></View>)}</View><ActionButton title="Lưu chỉ số" onPress={onSave} disabled={busy} style={styles.fullButton} /></Card>
    <Card><Text style={styles.cardTitle}>Lịch sử gần đây</Text>{asArray(history).length ? asArray(history).slice(0, 8).map((item, index) => <View key={item._id || index} style={styles.historyRow}><View style={styles.historyDot} /><View style={styles.historyContent}><Text style={styles.historyDate}>{displayDate(item.createdAt)}</Text><Text style={styles.historySummary}>Glucose {item.glucose ?? '—'} · BMI {item.bmi ?? '—'} · HA {item.systolic ?? '—'}/{item.diastolic ?? '—'}</Text></View></View>) : <EmptyState text="Các lần đo đã lưu sẽ xuất hiện tại đây." />}</Card>
  </>;
}

function AIChatScreen({ messages, value, setValue, onSend, busy, onBack }) {
  const chatScrollRef = useRef(null);

  useEffect(() => {
    requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, busy]);

  return <>
    <Pressable style={styles.aiBackButton} onPress={onBack} accessibilityRole="button">
      <Text style={styles.aiBackText}>‹  Quay lại</Text>
    </Pressable>
    <ScreenTitle eyebrow="TRỢ LÝ SỨC KHỎE" title="Trò chuyện với DOCTIS AI" subtitle="Hỏi đáp kiến thức về đái tháo đường type 2 và chăm sóc sức khỏe." />
    <Card style={styles.aiChatCard}>
      <View style={styles.aiChatHeader}>
        <View style={styles.aiChatIcon}><Text style={styles.aiChatIconText}>✦</Text></View>
        <View style={styles.aiChatHeading}>
          <Text style={styles.aiChatTitle}>Trợ lý sức khỏe DOCTIS</Text>
          <Text style={styles.aiChatSubtitle}>Kiến thức tham khảo về type 2</Text>
        </View>
        <View style={styles.aiOnline}><View style={styles.aiOnlineDot} /><Text style={styles.aiOnlineText}>AI</Text></View>
      </View>
      <ScrollView
        ref={chatScrollRef}
        style={styles.aiMessageList}
        contentContainerStyle={styles.aiMessageContent}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {messages.map((item, index) => {
          const mine = item.role === 'user';
          return <View key={item.requestId || `${item.role}-${index}`} style={[styles.aiMessageRow, mine && styles.aiMessageRowMine]}>
            <View style={[styles.aiMessageBubble, mine && styles.aiMessageBubbleMine, item.isError && styles.aiMessageBubbleError]}>
              <Text style={[styles.aiMessageText, mine && styles.aiMessageTextMine]}>{item.text}</Text>
            </View>
          </View>;
        })}
        {busy ? <View style={styles.aiMessageRow}><View style={styles.aiThinkingBubble}><ActivityIndicator size="small" color="#087d83" /><Text style={styles.aiThinkingText}>DOCTIS AI đang trả lời…</Text></View></View> : null}
      </ScrollView>
      <View style={styles.aiComposer}>
        <TextInput
          style={styles.aiInput}
          value={value}
          onChangeText={setValue}
          placeholder="Hỏi về đường huyết, ăn uống, vận động…"
          placeholderTextColor="#91a4a8"
          maxLength={1200}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Pressable style={[styles.aiSendButton, (busy || !value.trim()) && styles.messageSendDisabled]} onPress={onSend} disabled={busy || !value.trim()}>
          <Text style={styles.aiSendText}>{busy ? '…' : '↑'}</Text>
        </Pressable>
      </View>
      <Text style={styles.aiDisclaimer}>AI có thể tham khảo chỉ số sức khỏe gần nhất của bạn. Thông tin chỉ để tham khảo, không thay thế bác sĩ.</Text>
    </Card>
  </>;
}

function CareScreen({ carePlan, prescriptions, activeDay, setActiveDay, doneIds, onToggleActivity, remindedIds, reminderBusyId, onCreateReminder }) {
  const days = asArray(carePlan?.days);
  const selectedIndex = Math.min(Math.max(activeDay, 0), Math.max(days.length - 1, 0));
  const selectedDay = days[selectedIndex];
  const weekNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const dayName = (day, index) => /^ngày\s*\d+/i.test(day?.label || '') ? weekNames[index % 7] : (day?.label || weekNames[index % 7]);
  const activitiesFor = (day) => asArray(day?.items).slice().sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const totalActivities = days.reduce((sum, day) => sum + asArray(day.items).length, 0);
  const completedActivities = days.reduce((sum, day, dayIndex) => sum + activitiesFor(day).filter((item) => doneIds.includes(`${carePlan?._id}-${day?.dayIndex ?? dayIndex}-${item.id || item.time}`)).length, 0);
  const selectedActivities = activitiesFor(selectedDay);
  const selectedDone = selectedActivities.filter((item) => doneIds.includes(`${carePlan?._id}-${selectedDay?.dayIndex ?? selectedIndex}-${item.id || item.time}`)).length;
  const typeMeta = (type) => {
    const key = String(type || '').toUpperCase();
    if (key.includes('MEAL') || key.includes('FOOD')) return { icon: '◉', label: 'Ăn uống', tone: styles.careMealTone };
    if (key.includes('EXERCISE') || key.includes('ACTIVITY')) return { icon: '↗', label: 'Vận động', tone: styles.careMoveTone };
    if (key.includes('MEDIC')) return { icon: '✚', label: 'Thuốc', tone: styles.careMedicineTone };
    return { icon: '＋', label: 'Chăm sóc', tone: styles.careOtherTone };
  };
  const renderActivity = (day, item, dayIndex, compact = false) => {
    const key = `${carePlan?._id}-${day?.dayIndex ?? dayIndex}-${item.id || item.time}`;
    const complete = doneIds.includes(key);
    const reminded = remindedIds.includes(key);
    const meta = typeMeta(item.type);
    return <View key={key} style={[styles.careActivityRow, complete && styles.careActivityDone, compact && styles.careActivityCompact]}>
      <Text style={styles.careActivityTime}>{item.time || '—'}</Text>
      <View style={[styles.careActivityIcon, meta.tone]}><Text style={styles.careActivityIconText}>{meta.icon}</Text></View>
      <View style={styles.careActivityCopy}>
        <Text style={[styles.careActivityTitle, complete && styles.careActivityTitleDone]} numberOfLines={compact ? 1 : 2}>{item.title || meta.label}</Text>
        {compact ? null : <><Text style={styles.careActivityType}>{meta.label}</Text>{item.description ? <Text style={styles.careActivityDescription}>{item.description}</Text> : null}</>}
      </View>
      {!compact && <View style={styles.careActivityActions}>
        <Pressable style={[styles.careActionButton, reminded && styles.careReminderDone]} onPress={() => onCreateReminder(day, item, dayIndex)} disabled={reminded || reminderBusyId === key}>
          {reminderBusyId === key ? <ActivityIndicator size="small" color="#3977f2" /> : <Text style={[styles.careActionText, reminded && styles.careReminderDoneText]}>{reminded ? 'Đã nhắc' : '♧ Nhắc email'}</Text>}
        </Pressable>
        <Pressable style={[styles.careDoneButton, complete && styles.careDoneButtonActive]} onPress={() => onToggleActivity(key)}>
          <Text style={[styles.careDoneButtonText, complete && styles.careDoneButtonTextActive]}>{complete ? '✓ Đã xong' : 'Đánh dấu xong'}</Text>
        </Pressable>
      </View>}
      {compact && <View style={[styles.careTinyCheck, complete && styles.careTinyCheckActive]}><Text style={styles.careTinyCheckText}>{complete ? '✓' : ''}</Text></View>}
    </View>;
  };

  return <>
    <ScreenTitle eyebrow="ĐỒNG HÀNH ĐIỀU TRỊ" title="Kế hoạch chăm sóc" subtitle="Theo dõi lịch tuần, xem hướng dẫn từng hoạt động và đánh dấu tiến độ hằng ngày." />
    {carePlan ? <>
      <Card style={styles.carePlanIntro}>
        <View style={styles.carePlanIntroTop}>
          <View style={styles.carePlanIntroIcon}><Text style={styles.carePlanIntroIconText}>✚</Text></View>
          <View style={styles.carePlanIntroCopy}><Text style={styles.cardTitle}>{carePlan.source === 'AI' ? 'Kế hoạch chăm sóc cá nhân' : 'Kế hoạch của bác sĩ'}</Text><Text style={styles.cardSub}>Cập nhật {displayDate(carePlan.updatedAt)}</Text></View>
          <Text style={[styles.careConfirmedPill, carePlan.source === 'AI' && styles.careDraftPill]}>{carePlan.source === 'AI' ? 'AI · Chờ rà soát' : '● Đã chốt'}</Text>
        </View>
        {carePlan.doctorNote ? <View style={styles.careDoctorNote}><Text style={styles.careDoctorNoteLabel}>LƯU Ý TỪ BÁC SĨ</Text><Text style={styles.bodyText}>{carePlan.doctorNote}</Text></View> : null}
      </Card>
      {days.length ? <>
        <Card style={styles.careWeekCard}>
          <View style={styles.careSectionHeader}>
            <View style={styles.careSectionHeading}><Text style={styles.careKicker}>LỊCH TUẦN</Text><Text style={styles.careSectionTitle}>Tuần chăm sóc của bạn</Text><Text style={styles.careSectionSub}>Chọn một ngày để xem chi tiết và cập nhật tiến độ.</Text></View>
            <View style={styles.careProgressBadge}><Text style={styles.careProgressLabel}>TIẾN ĐỘ</Text><Text style={styles.careProgressValue}>{completedActivities}/{totalActivities}</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.careWeekScroller}>
            {days.map((day, index) => {
              const items = activitiesFor(day);
              const done = items.filter((item) => doneIds.includes(`${carePlan._id}-${day?.dayIndex ?? index}-${item.id || item.time}`)).length;
              const percent = items.length ? Math.round(done / items.length * 100) : 0;
              return <Pressable key={`${day.dayIndex}-${index}`} onPress={() => setActiveDay(index)} style={[styles.careDayCard, index === selectedIndex && styles.careDayCardActive]}>
                <View style={styles.careDayCardHeader}><View style={[styles.careDayNumber, index === selectedIndex && styles.careDayNumberActive]}><Text style={[styles.careDayNumberText, index === selectedIndex && styles.careDayNumberTextActive]}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.careDayCardTitleWrap}><Text style={styles.careDayCardTitle}>{dayName(day, index)}</Text><Text style={styles.careDayCount}>{done}/{items.length} việc</Text></View><Text style={styles.careDayPercent}>{percent}%</Text></View>
                <View style={styles.careProgressTrack}><View style={[styles.careProgressFill, { width: `${percent}%` }]} /></View>
                {items.slice(0, 4).map((item) => renderActivity(day, item, index, true))}
                {!items.length && <Text style={styles.careNoActivities}>Chưa có hoạt động</Text>}
              </Pressable>;
            })}
          </ScrollView>
        </Card>
        <Card style={styles.careDetailCard}>
          <View style={styles.careDetailHeader}><View style={styles.careSectionHeading}><Text style={styles.careKicker}>CHI TIẾT NGÀY</Text><Text style={styles.careSectionTitle}>{dayName(selectedDay, selectedIndex)}</Text><Text style={styles.careSectionSub}>{selectedDone}/{selectedActivities.length} hoạt động hoàn thành</Text></View><View style={styles.careDayStatus}><Text style={styles.careDayStatusText}>{carePlan.source === 'AI' ? '✦ Kế hoạch cá nhân' : '✚ Kế hoạch bác sĩ'}</Text></View></View>
          {selectedDay?.summary ? <Text style={styles.careDaySummary}>{selectedDay.summary}</Text> : null}
          {selectedActivities.length ? selectedActivities.map((item) => renderActivity(selectedDay, item, selectedIndex)) : <EmptyState text="Chưa có hoạt động cho ngày này." />}
        </Card>
      </> : <Card><EmptyState text="Kế hoạch chưa có lịch theo ngày." /></Card>}
    </> : <Card><Text style={styles.cardTitle}>Kế hoạch của bác sĩ</Text><EmptyState text="Bác sĩ chưa chốt kế hoạch chăm sóc cho bạn." /></Card>}
    <Card><Text style={styles.cardTitle}>Đơn thuốc đã chốt</Text>{asArray(prescriptions).length ? asArray(prescriptions).map((prescription) => <View key={prescription._id} style={styles.prescriptionCard}><View style={styles.cardHeading}><Text style={styles.planItemTitle}>{prescription.title || 'Đơn thuốc'}</Text><Text style={styles.dayStatus}>Đã chốt</Text></View><Text style={styles.cardSub}>{displayDate(prescription.confirmedAt || prescription.createdAt)}</Text>{prescription.note ? <Text style={styles.bodyMuted}>{prescription.note}</Text> : null}{asArray(prescription.medicines).map((medicine, index) => <View key={`${medicine.name}-${index}`} style={styles.medicineRow}><Text style={styles.medicineName}>{medicine.name}</Text><Text style={styles.bodyMuted}>{[medicine.dosage, medicine.frequency, asArray(medicine.times).join(', ')].filter(Boolean).join(' · ')}</Text></View>)}</View>) : <EmptyState text="Chưa có đơn thuốc đã chốt." />}</Card>
  </>;
}

function AppointmentsScreen({ appointments, onCancel }) {
  return <>
    <ScreenTitle eyebrow="THEO DÕI KHÁM BỆNH" title="Lịch hẹn" subtitle="Xem trạng thái cuộc hẹn với bác sĩ phụ trách." />
    <Card><Text style={styles.cardTitle}>Các cuộc hẹn</Text>{asArray(appointments).length ? asArray(appointments).map((item) => <View key={item._id} style={styles.appointmentCard}><View style={styles.cardHeading}><Text style={styles.appointmentType}>{item.type || 'Lịch khám'}</Text><Text style={[styles.statusPill, item.status === 'approved' && styles.statusApproved, item.status === 'cancelled' && styles.statusCancelled]}>{prettyStatus(item.status)}</Text></View><Text style={styles.appointmentDate}>{displayDate(item.appointmentDate)}</Text>{item.doctorId?.fullName || item.doctorId?.username ? <Text style={styles.bodyMuted}>Bác sĩ: {item.doctorId.fullName || item.doctorId.username}</Text> : null}{item.note ? <Text style={styles.bodyMuted}>Ghi chú: {item.note}</Text> : null}{['pending', 'approved'].includes(item.status) ? <Pressable onPress={() => onCancel(item)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Hủy lịch hẹn</Text></Pressable> : null}</View>) : <EmptyState text="Bạn chưa có lịch hẹn. Bác sĩ phụ trách có thể tạo lịch hẹn trên DOCTIS." />}</Card>
  </>;
}

function ProfileScreen({ profile, editing, setEditing, setProfile, onSave, busy, onSignOut }) {
  const fields = [
    ['fullName', 'Họ và tên'], ['phone', 'Số điện thoại'], ['dateOfBirth', 'Ngày sinh'], ['gender', 'Giới tính'],
    ['bloodType', 'Nhóm máu'], ['chronicDiseases', 'Bệnh nền'], ['allergies', 'Dị ứng'], ['currentMedications', 'Thuốc đang dùng'],
    ['emergencyContactName', 'Người liên hệ khẩn cấp'], ['emergencyContactPhone', 'Số điện thoại khẩn cấp'], ['address', 'Địa chỉ'],
  ];
  return <>
    <ScreenTitle eyebrow="THÔNG TIN CÁ NHÂN" title="Hồ sơ sức khỏe" subtitle="Thông tin này giúp đội ngũ chăm sóc hiểu hồ sơ của bạn." />
    <Card><View style={styles.profileIdentity}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{fullName(profile).slice(0, 1).toUpperCase()}</Text></View><View style={styles.profileIdentityText}><Text style={styles.profileName}>{fullName(profile)}</Text><Text style={styles.bodyMuted}>{profile?.email}</Text></View></View><View style={styles.profileFields}>{fields.map(([key, label]) => <View key={key} style={styles.profileField}>{editing ? <Field label={label} value={profile?.[key] || ''} onChangeText={(value) => setProfile((previous) => ({ ...previous, [key]: value }))} /> : <><Text style={styles.profileLabel}>{label}</Text><Text style={styles.profileValue}>{profile?.[key] || 'Chưa cập nhật'}</Text></>}</View>)}</View>{editing ? <View style={styles.actionRow}><ActionButton title="Lưu thay đổi" onPress={onSave} disabled={busy} style={styles.flexButton} /><ActionButton title="Hủy" secondary onPress={() => setEditing(false)} style={styles.flexButton} /></View> : <ActionButton title="Chỉnh sửa hồ sơ" secondary onPress={() => setEditing(true)} style={styles.fullButton} />}</Card>
    <ActionButton title="Đăng xuất" secondary onPress={onSignOut} style={styles.fullButton} />
  </>;
}

function MessagesScreen({ doctors, doctor, setDoctor, messages, user, value, setValue, onSend, busy, attachment, attachmentBusy, onChooseAttachment, onRemoveAttachment, onOpenAttachment, onComposerFocus }) {
  const currentUserId = String(user?._id || user?.id || '');
  const messageListRef = useRef(null);
  const stickToLatestMessage = useRef(true);

  useEffect(() => {
    if (!stickToLatestMessage.current) return;
    requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
  }, [messages]);

  const handleMessageListScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    stickToLatestMessage.current = distanceFromBottom < 72;
  };

  return <>
    <ScreenTitle eyebrow="KẾT NỐI CHĂM SÓC" title="Bác sĩ phụ trách" subtitle="Trao đổi và gửi hồ sơ trực tiếp cho bác sĩ đã được phân công." />
    {!asArray(doctors).length ? <Card><EmptyState text="Tài khoản của bạn chưa được phân công bác sĩ. Hãy liên hệ quản trị viên để được hỗ trợ." /></Card> : <>
      <Card>
        <Text style={styles.cardTitle}>Bác sĩ của bạn</Text>
        {asArray(doctors).map((item) => <Pressable key={item._id} onPress={() => setDoctor(item)} style={[styles.doctorChoice, String(item._id) === String(doctor?._id) && styles.doctorChoiceActive]}>
          <View style={styles.doctorAvatar}><Text style={styles.doctorAvatarText}>{(item.fullName || item.username || 'B').slice(0, 1).toUpperCase()}</Text></View>
          <View style={styles.flex}><Text style={styles.planItemTitle}>{item.displayName || item.fullName || item.username}</Text><Text style={styles.bodyMuted}>Bác sĩ phụ trách</Text></View>
          <Text style={styles.quickArrow}>›</Text>
        </Pressable>)}
      </Card>
      <Card style={styles.messageHistoryCard}>
        <Text style={styles.cardTitle}>Tin nhắn</Text>
        <ScrollView
          ref={messageListRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          onScroll={handleMessageListScroll}
          scrollEventThrottle={16}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {asArray(messages).length ? asArray(messages).map((item) => {
            const mine = String(item.senderId) === currentUserId;
            return <View key={item._id} style={[styles.messageBubble, mine && styles.messageMine]}>
              {!!item.content && <Text style={[styles.messageText, mine && styles.messageMineText]}>{item.content}</Text>}
              {item.attachment ? <MobileMessageAttachment attachment={item.attachment} mine={mine} onOpen={onOpenAttachment} /> : null}
              <Text style={[styles.messageTime, mine && styles.messageMineText]}>{displayDate(item.createdAt)}</Text>
            </View>;
          }) : <EmptyState text="Chưa có tin nhắn. Bạn có thể bắt đầu trao đổi với bác sĩ." />}
        </ScrollView>

        <Text style={styles.cardTitle}>Gửi tin nhắn</Text>
        <TextInput style={styles.messageComposerInput} value={value} onChangeText={setValue} placeholder="Nhập nội dung tin nhắn..." placeholderTextColor="#91a4a8" onFocus={onComposerFocus} multiline={false} autoCorrect autoCapitalize="sentences" returnKeyType="send" onSubmitEditing={onSend} />
        {attachment ? <View style={styles.pendingAttachment}><Text numberOfLines={1} style={styles.pendingAttachmentName}>{attachment.type?.startsWith('image/') ? '▧ ' : '▤ '}{attachment.name}</Text><Pressable onPress={onRemoveAttachment}><Text style={styles.removeAttachment}>×</Text></Pressable></View> : null}
        <View style={styles.messageActionsRow}>
          <Pressable style={styles.attachmentActionButton} onPress={() => onChooseAttachment('image')} disabled={attachmentBusy}><Text style={styles.attachmentActionText}>▧ Ảnh</Text></Pressable>
          <Pressable style={styles.attachmentActionButton} onPress={() => onChooseAttachment('file')} disabled={attachmentBusy}><Text style={styles.attachmentActionText}>＋ Tệp</Text></Pressable>
          <View style={styles.flex} />
          <Pressable style={[styles.messageSendButton, (busy || attachmentBusy || (!value.trim() && !attachment)) && styles.messageSendDisabled]} onPress={onSend} disabled={busy || attachmentBusy || (!value.trim() && !attachment)}><Text style={styles.messageSendText}>{busy ? 'Đang gửi…' : 'Gửi'}</Text></Pressable>
        </View>
        <Text style={styles.attachmentHint}>{attachmentBusy ? 'Đang đọc tệp…' : 'Ảnh và tệp đính kèm tối đa 8 MB'}</Text>
      </Card>
    </>}
  </>;
}
function MobileMessageAttachment({ attachment, mine, onOpen }) {
  const isImage = String(attachment.type || '').startsWith('image/');
  const source = attachment.dataUrl || attachment.url || attachment.fileUrl || attachment.src || '';
  return <View style={[styles.messageAttachmentCard, mine && styles.messageAttachmentMine]}>
    {isImage && source ? <Image source={{ uri: source }} style={styles.messageImage} resizeMode="cover" /> : <Text style={styles.messageFileIcon}>▤</Text>}
    <View style={styles.messageAttachmentDetails}>
      <Text numberOfLines={2} style={[styles.messageAttachmentName, mine && styles.messageMineText]}>{attachment.name || (isImage ? 'Ảnh đính kèm' : 'Tệp đính kèm')}</Text>
      <Text style={[styles.messageAttachmentMeta, mine && styles.messageMineText]}>{attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Tệp đính kèm'}{attachment.type ? ` · ${attachment.type.split('/').pop()}` : ''}</Text>
    </View>
    <Pressable style={styles.openAttachmentButton} onPress={() => onOpen(attachment)}><Text style={styles.openAttachmentText}>{isImage ? 'Lưu' : 'Mở / lưu'}</Text></Pressable>
  </View>;
}
function EmptyState({ text }) {
  return <View style={styles.emptyState}><View style={styles.emptyIcon}><Text style={styles.emptyIconText}>i</Text></View><Text style={styles.emptyText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f7f8' },
  flex: { flex: 1 },
  page: { paddingHorizontal: 18, paddingTop: 17, paddingBottom: 25 },
  authPage: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 32, maxWidth: 580, width: '100%', alignSelf: 'center', flexGrow: 1 },
  brandHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  brandHeaderCompact: { marginBottom: 0 },
  logo: { width: 43, height: 43, borderRadius: 15, backgroundColor: '#087d83', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoText: { color: '#fff', fontSize: 23, fontWeight: '900' },
  brand: { color: '#17364a', fontSize: 18, fontWeight: '900', letterSpacing: 0.8 },
  brandCaption: { color: '#76909a', fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  liveBadge: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e7f5ee' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#27a879', marginRight: 6 },
  liveText: { color: '#258264', fontSize: 10, fontWeight: '700' },
  authHero: { paddingVertical: 16, paddingHorizontal: 4 },
  authEyebrow: { color: '#168b8b', fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: 9 },
  authTitle: { color: '#18394c', fontSize: 27, lineHeight: 33, fontWeight: '900', letterSpacing: -0.5 },
  authSubtitle: { color: '#728991', fontSize: 13, lineHeight: 20, marginTop: 8 },
  authCard: { padding: 18, marginTop: 10 },
  authSubmit: { marginTop: 4 },
  switchAuth: { alignItems: 'center', paddingTop: 18, paddingBottom: 3 },
  switchText: { color: '#748a91', fontSize: 12 },
  switchStrong: { color: '#087d83', fontWeight: '900' },
  authFootnote: { color: '#98a8ac', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 17, paddingHorizontal: 12 },
  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4ecee', paddingHorizontal: 18, paddingVertical: 10 },
  avatarButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2f1f0', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#087d83', fontWeight: '900' },
  homeHero: { backgroundColor: '#103b4b', borderRadius: 24, padding: 21, overflow: 'hidden' },
  heroEyebrow: { color: '#7fe0da', fontSize: 9, letterSpacing: 0.9, fontWeight: '900' },
  homeTitle: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 11, flexShrink: 1 },
  homeDescription: { color: '#c4dadd', fontSize: 12, lineHeight: 18, marginTop: 7 },
  heroStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, padding: 12, marginTop: 19 },
  statDivider: { width: 1, height: 33, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 14 },
  sectionHeading: { marginTop: 24, marginBottom: 13 },
  sectionTitle: { color: '#18394c', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#82959c', fontSize: 10, marginTop: 4 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 11 },
  quickCard: { width: '48.3%', minHeight: 138, backgroundColor: '#fff', borderColor: '#e2ebed', borderWidth: 1, borderRadius: 18, padding: 14 },
  quickPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  quickIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  quickIconText: { color: '#087d83', fontSize: 19, fontWeight: '900' },
  quickTitle: { color: '#234254', fontSize: 11, fontWeight: '900', paddingRight: 5 },
  quickDetail: { color: '#84969d', fontSize: 9, marginTop: 5, lineHeight: 14 },
  quickArrow: { color: '#85a4a8', fontSize: 16 },
  card: { backgroundColor: '#fff', borderColor: '#e2ebed', borderWidth: 1, borderRadius: 19, padding: 16, marginBottom: 12 },
  dashboardCard: { marginTop: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: '#234254', fontSize: 14, fontWeight: '900' },
  cardSub: { color: '#869aa1', fontSize: 10, lineHeight: 15, marginTop: 4, marginBottom: 11 },
  statusDot: { color: '#26ae82', fontSize: 11 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 15 },
  metric: { flex: 1, minWidth: 105 },
  metricLabel: { color: '#a0afb3', fontSize: 8, letterSpacing: 0.7, fontWeight: '900' },
  metricLabelLight: { color: '#c2e8e8' },
  metricValue: { color: '#18394c', fontSize: 17, fontWeight: '900', marginTop: 4 },
  metricValueLight: { color: '#fff' },
  metricUnit: { color: '#8a9da3', fontSize: 8, fontWeight: '600' },
  metricUnitLight: { color: '#dcf4f3' },
  disclaimer: { color: '#9aa9ad', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 8, paddingTop: 6 },
  screenTitleWrap: { marginBottom: 17 },
  screenEyebrow: { color: '#168b8b', fontSize: 9, fontWeight: '900', letterSpacing: 1.05 },
  screenTitle: { color: '#17394b', fontSize: 24, fontWeight: '900', marginTop: 5 },
  screenSubtitle: { color: '#7f939a', fontSize: 11, lineHeight: 17, marginTop: 5 },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { color: '#56717a', fontSize: 10, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#dce7e9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#234254', backgroundColor: '#fbfdfd', fontSize: 13 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  button: { minHeight: 47, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087d83' },
  buttonSecondary: { backgroundColor: '#eef7f6', borderWidth: 1, borderColor: '#d8e9e7' },
  buttonDisabled: { opacity: 0.65 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  buttonSecondaryText: { color: '#087d83' },
  fullButton: { marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 5 },
  flexButton: { flex: 1 },
  formGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  formGridItem: { width: '48.5%' },
  riskPill: { backgroundColor: '#eef7f6', borderRadius: 10, padding: 10, marginTop: 14 },
  riskText: { color: '#247b78', fontSize: 10, fontWeight: '800' },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#edf1f2' },
  historyDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: '#51b8b0', marginTop: 5, marginRight: 10 },
  historyContent: { flex: 1 },
  historyDate: { color: '#365767', fontSize: 10, fontWeight: '800' },
  historySummary: { color: '#81959c', fontSize: 9, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 17, paddingHorizontal: 12 },
  emptyIcon: { width: 31, height: 31, borderRadius: 11, backgroundColor: '#e9f4f3', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyIconText: { color: '#3a9693', fontWeight: '900' },
  emptyText: { color: '#84989e', fontSize: 10, lineHeight: 16, textAlign: 'center' },
  bodyText: { color: '#54717a', fontSize: 11, lineHeight: 17, marginTop: 7 },
  bodyMuted: { color: '#82969d', fontSize: 10, lineHeight: 15, marginTop: 4 },
  doctorNote: { backgroundColor: '#f5f8f9', borderRadius: 12, padding: 12, marginBottom: 13 },
  doctorNoteLabel: { color: '#168b8b', fontSize: 8, letterSpacing: 0.8, fontWeight: '900' },
  dayBlock: { borderTopWidth: 1, borderTopColor: '#eaf0f1', paddingTop: 12, marginTop: 12 },
  dayHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayTitle: { color: '#234254', fontSize: 12, fontWeight: '900' },
  dayStatus: { color: '#268372', backgroundColor: '#eaf7f2', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9, fontSize: 8, fontWeight: '900' },
  planItem: { flexDirection: 'row', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f0f3f4' },
  planTime: { width: 51, color: '#168b8b', fontSize: 10, fontWeight: '900', paddingTop: 1 },
  planItemContent: { flex: 1 },
  planItemTitle: { color: '#315261', fontSize: 11, fontWeight: '900' },
  planType: { color: '#9aa9ae', fontSize: 8, letterSpacing: 0.6, fontWeight: '800', marginTop: 5 },
  prescriptionCard: { borderTopWidth: 1, borderTopColor: '#edf1f2', paddingTop: 12, marginTop: 10 },
  medicineRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f4f4', marginTop: 5 },
  medicineName: { color: '#315261', fontSize: 10, fontWeight: '900' },
  carePlanIntro: { backgroundColor: '#f7fcfc', borderColor: '#dceeed' },
  carePlanIntroTop: { flexDirection: 'row', alignItems: 'center' },
  carePlanIntroIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#e5f6f3', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  carePlanIntroIconText: { color: '#078b8e', fontSize: 20, fontWeight: '900' },
  carePlanIntroCopy: { flex: 1 },
  careConfirmedPill: { color: '#13896b', backgroundColor: '#e8f8f1', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, fontSize: 8, fontWeight: '900' },
  careDraftPill: { color: '#8c6b32', backgroundColor: '#fff6e5' },
  careDoctorNote: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e7efef' },
  careDoctorNoteLabel: { color: '#168b8b', fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  careWeekCard: { paddingHorizontal: 12, paddingTop: 15, paddingBottom: 12 },
  careSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  careSectionHeading: { flex: 1, minWidth: 0 },
  careKicker: { color: '#64819a', fontSize: 8, letterSpacing: 1, fontWeight: '900' },
  careSectionTitle: { color: '#234254', fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 3 },
  careSectionSub: { color: '#82969d', fontSize: 9, lineHeight: 14, marginTop: 4 },
  careProgressBadge: { minWidth: 66, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 7, borderRadius: 12, backgroundColor: '#f3f7ff', borderWidth: 1, borderColor: '#e0e9fa', marginLeft: 8 },
  careProgressLabel: { color: '#8b9db5', fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  careProgressValue: { color: '#3977f2', fontSize: 13, fontWeight: '900', marginTop: 2 },
  careWeekScroller: { paddingRight: 3, gap: 8 },
  careDayCard: { width: 178, padding: 9, borderRadius: 14, backgroundColor: '#f8faff', borderWidth: 1, borderColor: '#e4ebf8' },
  careDayCardActive: { backgroundColor: '#fff', borderColor: '#8cb2ff', shadowColor: '#3577ee', shadowOpacity: 0.1, shadowRadius: 9, elevation: 2 },
  careDayCardHeader: { flexDirection: 'row', alignItems: 'center' },
  careDayNumber: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf0ff', marginRight: 7 },
  careDayNumberActive: { backgroundColor: '#477af1' },
  careDayNumberText: { color: '#477af1', fontSize: 8, fontWeight: '900' },
  careDayNumberTextActive: { color: '#fff' },
  careDayCardTitleWrap: { flex: 1 },
  careDayCardTitle: { color: '#315261', fontSize: 9, fontWeight: '900' },
  careDayCount: { color: '#96a7b4', fontSize: 7, marginTop: 2 },
  careDayPercent: { color: '#3977f2', fontSize: 8, fontWeight: '900' },
  careProgressTrack: { height: 3, overflow: 'hidden', backgroundColor: '#e9eef5', borderRadius: 3, marginTop: 8, marginBottom: 4 },
  careProgressFill: { height: 3, borderRadius: 3, backgroundColor: '#29b896' },
  careActivityRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', padding: 9, borderRadius: 13, backgroundColor: '#fbfdff', borderWidth: 1, borderColor: '#e8eef6', marginTop: 7 },
  careActivityDone: { backgroundColor: '#f1fbf7', borderColor: '#d9f1e6' },
  careActivityCompact: { minHeight: 36, paddingVertical: 5, paddingHorizontal: 4, borderWidth: 0, borderRadius: 9, backgroundColor: 'transparent', marginTop: 3 },
  careActivityTime: { width: 42, color: '#597a9e', fontSize: 8, fontWeight: '900' },
  careActivityIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 8, backgroundColor: '#fff1e7' },
  careMealTone: { backgroundColor: '#fff2e7' },
  careMoveTone: { backgroundColor: '#e8f8f3' },
  careMedicineTone: { backgroundColor: '#edf0ff' },
  careOtherTone: { backgroundColor: '#e8f5f6' },
  careActivityIconText: { color: '#388e92', fontSize: 13, fontWeight: '900' },
  careActivityCopy: { flex: 1, minWidth: 0 },
  careActivityTitle: { color: '#315261', fontSize: 10, fontWeight: '900', lineHeight: 14 },
  careActivityTitleDone: { color: '#36816d' },
  careActivityType: { color: '#8095a1', fontSize: 8, marginTop: 3 },
  careActivityDescription: { color: '#728996', fontSize: 9, lineHeight: 14, marginTop: 4 },
  careTinyCheck: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#d8e2ed', marginLeft: 5, alignItems: 'center', justifyContent: 'center' },
  careTinyCheckActive: { backgroundColor: '#20ad86', borderColor: '#20ad86' },
  careTinyCheckText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  careNoActivities: { color: '#8b9ba8', fontSize: 8, textAlign: 'center', paddingVertical: 14 },
  careDetailCard: { paddingHorizontal: 12 },
  careDetailHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#edf2f4', paddingBottom: 10, marginBottom: 4 },
  careDayStatus: { backgroundColor: '#f3f7ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 7 },
  careDayStatusText: { color: '#647fa5', fontSize: 7, fontWeight: '900' },
  careDaySummary: { color: '#657f8a', backgroundColor: '#f4f9f8', borderRadius: 10, padding: 9, marginTop: 8, fontSize: 9, lineHeight: 14 },
  careActivityActions: { alignItems: 'flex-end', gap: 5, marginLeft: 6 },
  careActionButton: { minWidth: 84, minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#eef4ff', borderWidth: 1, borderColor: '#dce7fb' },
  careActionText: { color: '#3977f2', fontSize: 8, fontWeight: '800' },
  careReminderDone: { backgroundColor: '#eef9f4', borderColor: '#d3efe2' },
  careReminderDoneText: { color: '#258666' },
  careDoneButton: { minWidth: 84, minHeight: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, borderRadius: 9, backgroundColor: '#078b8e' },
  careDoneButtonActive: { backgroundColor: '#e7f7f0', borderWidth: 1, borderColor: '#ccebdd' },
  careDoneButtonText: { color: '#fff', fontSize: 8, fontWeight: '900' },
  careDoneButtonTextActive: { color: '#248369' },
  appointmentCard: { borderTopWidth: 1, borderTopColor: '#edf1f2', paddingTop: 13, marginTop: 10 },
  appointmentType: { color: '#315261', fontSize: 11, fontWeight: '900' },
  appointmentDate: { color: '#087d83', fontSize: 12, fontWeight: '900', marginTop: 9 },
  statusPill: { overflow: 'hidden', color: '#94702c', backgroundColor: '#fff5e4', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, fontSize: 8, fontWeight: '900' },
  statusApproved: { color: '#247d65', backgroundColor: '#e8f7f1' },
  statusCancelled: { color: '#ab5960', backgroundColor: '#fff0f1' },
  cancelButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#f1d9da', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 10 },
  cancelButtonText: { color: '#b25760', fontSize: 9, fontWeight: '900' },
  profileIdentity: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  profileAvatar: { width: 50, height: 50, borderRadius: 18, backgroundColor: '#e5f2f1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  profileAvatarText: { color: '#087d83', fontSize: 20, fontWeight: '900' },
  profileIdentityText: { flex: 1 },
  profileName: { color: '#234254', fontSize: 14, fontWeight: '900' },
  profileFields: { borderTopWidth: 1, borderTopColor: '#edf1f2', paddingTop: 8 },
  profileField: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f4f4' },
  profileLabel: { color: '#98a8ad', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
  profileValue: { color: '#365767', fontSize: 11, fontWeight: '700', marginTop: 4 },
  doctorChoice: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e6eeee', borderRadius: 13, padding: 10, marginTop: 10 },
  doctorChoiceActive: { backgroundColor: '#f0f8f7', borderColor: '#aad7d3' },
  doctorAvatar: { width: 37, height: 37, borderRadius: 14, backgroundColor: '#e6edff', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  doctorAvatarText: { color: '#5570bc', fontWeight: '900' },
  aiChatCard: { height: 540, padding: 13, flexDirection: 'column' },
  aiChatHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: '#edf2f2' },
  aiChatIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#e9f5f4', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  aiChatIconText: { color: '#087d83', fontSize: 20, fontWeight: '900' },
  aiChatHeading: { flex: 1, minWidth: 0 },
  aiChatTitle: { color: '#234254', fontSize: 11, fontWeight: '900' },
  aiChatSubtitle: { color: '#879ba1', fontSize: 8, marginTop: 3 },
  aiOnline: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, backgroundColor: '#eef8f4' },
  aiOnlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#35a77b' },
  aiOnlineText: { color: '#32846b', fontSize: 8, fontWeight: '900' },
  aiMessageList: { flex: 1, minHeight: 0, marginVertical: 9 },
  aiMessageContent: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 3 },
  aiMessageRow: { width: '100%', alignItems: 'flex-start', marginVertical: 4 },
  aiMessageRowMine: { alignItems: 'flex-end' },
  aiMessageBubble: { maxWidth: '88%', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: '#eef4f5' },
  aiMessageBubbleMine: { borderBottomLeftRadius: 14, borderBottomRightRadius: 4, backgroundColor: '#087d83' },
  aiMessageBubbleError: { backgroundColor: '#fff0ef', borderColor: '#f2d5d3', borderWidth: 1 },
  aiMessageText: { color: '#315261', fontSize: 10, lineHeight: 16 },
  aiMessageTextMine: { color: '#fff' },
  aiThinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: '#eef4f5' },
  aiThinkingText: { color: '#708991', fontSize: 9 },
  aiComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#edf2f2' },
  aiInput: { flex: 1, height: 42, borderWidth: 1, borderColor: '#dce7e9', borderRadius: 13, paddingHorizontal: 11, color: '#234254', backgroundColor: '#fbfdfd', fontSize: 10 },
  aiSendButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087d83' },
  aiSendText: { color: '#fff', fontSize: 21, lineHeight: 24, fontWeight: '900' },
  aiDisclaimer: { color: '#98a8ad', fontSize: 7, lineHeight: 11, textAlign: 'center', marginTop: 7 },
  messageHistoryCard: { height: 440, padding: 13, flexDirection: 'column' },
  messageList: { flex: 1, minHeight: 0, marginTop: 9, marginBottom: 10 },
  messageListContent: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 2 },
  messageBubble: { alignSelf: 'flex-start', maxWidth: '85%', backgroundColor: '#eef4f5', borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 11, paddingVertical: 9, marginVertical: 4 },
  messageMine: { alignSelf: 'flex-end', backgroundColor: '#087d83', borderBottomLeftRadius: 14, borderBottomRightRadius: 4 },
  messageText: { color: '#315261', fontSize: 11, lineHeight: 16 },
  messageMineText: { color: '#fff' },
  messageTime: { color: '#8ba0a5', fontSize: 8, marginTop: 4 },
  messageAttachmentCard: { flexDirection: 'row', alignItems: 'center', maxWidth: 270, marginTop: 7, padding: 8, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce9e9' },
  messageAttachmentMine: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.32)' },
  messageImage: { width: 54, height: 54, borderRadius: 8, marginRight: 9, backgroundColor: '#e9f0f0' },
  messageFileIcon: { width: 40, height: 44, textAlign: 'center', textAlignVertical: 'center', color: '#087d83', fontSize: 20, backgroundColor: '#eaf5f4', borderRadius: 9, marginRight: 9, overflow: 'hidden' },
  messageAttachmentDetails: { flex: 1, minWidth: 0 },
  messageAttachmentName: { color: '#315261', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  messageAttachmentMeta: { color: '#82969d', fontSize: 8, marginTop: 4 },
  openAttachmentButton: { paddingHorizontal: 9, paddingVertical: 7, marginLeft: 6, borderRadius: 9, backgroundColor: '#e8f4f3' },
  openAttachmentText: { color: '#087d83', fontSize: 9, fontWeight: '900' },
  pendingAttachment: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#edf7f6' },
  pendingAttachmentName: { flex: 1, color: '#315261', fontSize: 9, fontWeight: '700' },
  removeAttachment: { color: '#9c5560', fontSize: 19, fontWeight: '700', paddingLeft: 10 },
  messageComposerInput: { width: '100%', height: 44, marginTop: 10, borderWidth: 1, borderColor: '#dce7e9', borderRadius: 12, paddingHorizontal: 12, color: '#234254', backgroundColor: '#fbfdfd', fontSize: 12 },
  messageActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  attachmentActionButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef7f6', borderWidth: 1, borderColor: '#dbeae8' },
  attachmentActionText: { color: '#087d83', fontSize: 10, fontWeight: '900' },
  messageSendButton: { minWidth: 72, height: 40, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087d83' },
  messageSendDisabled: { opacity: 0.4 },
  messageSendText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  attachmentHint: { color: '#9aabad', fontSize: 8, marginTop: 6, marginLeft: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e9f6f1', borderRadius: 11, marginHorizontal: 16, marginTop: 8, paddingVertical: 9, paddingHorizontal: 11 },
  noticeError: { backgroundColor: '#fff0ef' },
  noticeText: { flex: 1, color: '#27765f', fontSize: 10, lineHeight: 15 },
  noticeErrorText: { color: '#ad504c' },
  noticeClose: { color: '#83999d', fontSize: 18, paddingLeft: 8 },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopColor: '#e3ebed', borderTopWidth: 1, paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 5 : 8, paddingHorizontal: 5 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  tabIconWrap: { width: 30, height: 27, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabIconActive: { backgroundColor: '#e5f4f2' },
  tabIcon: { color: '#7c969c', fontSize: 19, fontWeight: '800' },
  tabIconSelected: { color: '#087d83' },
  tabLabel: { color: '#85999e', fontSize: 8, fontWeight: '700', marginTop: 3 },
  tabLabelSelected: { color: '#087d83', fontWeight: '900' },
  aiFloatingLayer: { position: 'absolute', right: 15, bottom: 82, alignItems: 'flex-end', zIndex: 30, elevation: 20 },
  aiWelcomeCard: { width: 258, minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 11, paddingRight: 34, marginBottom: 10, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfeaec', shadowColor: '#15394b', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  aiWelcomeRobot: { fontSize: 26, marginRight: 9 },
  aiWelcomeText: { flex: 1, color: '#234254', fontSize: 10, lineHeight: 15, fontWeight: '800' },
  aiWelcomeClose: { position: 'absolute', right: 7, top: 6, width: 23, height: 23, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f0f5f5' },
  aiWelcomeCloseText: { color: '#6f858c', fontSize: 17, lineHeight: 20, fontWeight: '700' },
  aiFloatingButton: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087d83', borderWidth: 2, borderColor: '#fff', shadowColor: '#087d83', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  aiFloatingIcon: { fontSize: 26 },
  aiBackButton: { alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 3, marginBottom: 8 },
  aiBackText: { color: '#087d83', fontSize: 11, fontWeight: '900' },
  loadingScreen: { alignItems: 'center', justifyContent: 'center' },
  loadingLabel: { color: '#708991', fontSize: 12, marginTop: 12 },
});
