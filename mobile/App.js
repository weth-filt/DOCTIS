import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFonts } from 'expo-font';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Lora_500Medium } from '@expo-google-fonts/lora/500Medium';
import { LinearGradient } from 'expo-linear-gradient';
import { AmbientArt, CountValue, feedback, HealthArt, Icon, Intro, LetterGreeting, MotionProvider, Pressable, Reveal, Skeleton, successFeedback, useReducedMotion } from './ui/design';
import { styles } from './ui/styles';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

const API_BASE = (process.env.EXPO_PUBLIC_API_URL || 'https://doctis.vercel.app/api').replace(/\/$/, '');
const TOKEN_KEY = 'doctis.session.token';
const USER_KEY = 'doctis.session.user';
// expo-secure-store has no web implementation. Use browser storage for the PWA
// while keeping iOS/Android credentials in the native secure store.
const sessionStore = {
  getItemAsync: async (key) => Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? window.localStorage.getItem(key) : null)
    : SecureStore.getItemAsync(key),
  setItemAsync: async (key, value) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  deleteItemAsync: async (key) => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
const NAV_ITEMS = [
  { id: 'home', label: 'Tổng quan' },
  { id: 'health', label: 'Sức khỏe' },
  { id: 'care', label: 'Chăm sóc' },
  { id: 'appointments', label: 'Lịch hẹn' },
  { id: 'profile', label: 'Hồ sơ' },
];

async function api(path, { token, method = 'GET', body, signal } = {}) {
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
      ...(signal ? { signal } : {}),
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
const registrationFields = () => ({ cccd: '', username: '', email: '', password: '', confirmPassword: '', address: '', wardId: '' });
const wardIdentity = (ward) => String(ward?.id || ward?._id || '');
const createRegistrationKey = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 3) | 8).toString(16);
  });
};
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

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, multiline, onFocus, autoCapitalize = 'sentences', autoCorrect = false, editable = true }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      {!!label && <Text style={styles.fieldLabel}>{label}</Text>}
      <TextInput
        style={[styles.input, multiline && styles.multilineInput, focused && styles.inputFocused, !editable && styles.inputReadOnly]}
        value={value}
        accessibilityLabel={label || placeholder}
        editable={editable}
        onChangeText={onChangeText}
        placeholder={placeholder || label}
        placeholderTextColor="#57706E"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={() => setFocused(false)}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
    </View>
  );
}

function ActionButton({ title, onPress, secondary, disabled, loading = disabled, style }) {
  return (
    <Pressable onPress={() => { feedback(); onPress?.(); }} disabled={disabled} accessibilityState={{ disabled: !!disabled, busy: !!loading }} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed, style]}>
      {loading ? <ActivityIndicator color={secondary ? '#087d83' : '#fff'} /> : <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>{title}</Text>}
    </Pressable>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function RegistrationWardField({ wards, value, onChange, loading, error, onRetry, disabled }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = wards.find((ward) => wardIdentity(ward) === value);
  const matches = wards.filter((ward) => String(ward.name || '').toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>Phường tại Đà Nẵng *</Text>
    {loading ? <View style={styles.wardStatus}><ActivityIndicator color="#087d83" /><Text style={styles.bodyMuted}>Đang tải danh mục phường…</Text></View> : error ? <>
      <Text style={styles.wardError}>{error}</Text>
      <ActionButton title="Tải lại danh mục phường" secondary onPress={onRetry} disabled={disabled} loading={false} />
    </> : !wards.length ? <>
      <Text style={styles.wardError}>Danh mục phường chưa được quản trị viên công bố. Vui lòng quay lại sau hoặc liên hệ DOCTIS để được hỗ trợ đăng ký.</Text>
      <ActionButton title="Kiểm tra lại danh mục" secondary onPress={onRetry} disabled={disabled} loading={false} />
    </> : <>
      <Pressable accessibilityRole="button" accessibilityLabel="Chọn phường" accessibilityState={{ expanded: open, disabled }} disabled={disabled} style={[styles.input, styles.wardTrigger]} onPress={() => setOpen((previous) => !previous)}>
        <Text style={styles.wardName}>{selected?.name || 'Chọn phường của bạn'}</Text><Text style={styles.wardChevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open && <View style={styles.wardOptions}>
        <Field label="Tìm phường" value={search} onChangeText={setSearch} editable={!disabled} placeholder="Nhập tên phường" />
        <ScrollView style={styles.wardList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {matches.map((ward) => <Pressable key={wardIdentity(ward)} accessibilityRole="radio" accessibilityState={{ checked: wardIdentity(ward) === value, disabled }} disabled={disabled} style={[styles.wardOption, wardIdentity(ward) === value && styles.wardOptionSelected]} onPress={() => { onChange(wardIdentity(ward)); setOpen(false); setSearch(''); }}>
            <Text style={styles.wardName}>{ward.name}</Text>{wardIdentity(ward) === value && <Text style={styles.wardChevron}>✓</Text>}
          </Pressable>)}
          {!matches.length && <Text style={styles.bodyMuted}>Không tìm thấy phường phù hợp.</Text>}
        </ScrollView>
      </View>}
    </>}
  </View>;
}

export default function App() {
  useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_700Bold, Lora_500Medium });
  const [intro, setIntro] = useState(true);
  const finishIntro = useCallback(() => setIntro(false), []);
  return <MotionProvider><View style={styles.stage}><View style={styles.appFrame}><WorkspaceApp />{intro && <Intro onDone={finishIntro} />}</View></View></MotionProvider>;
}

function WorkspaceApp() {
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState(registrationFields);
  const [authBusy, setAuthBusy] = useState(false);
  const authSubmitLock = useRef(false);
  const registrationAttempt = useRef(null);
  const [registrationWards, setRegistrationWards] = useState([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [wardsError, setWardsError] = useState('');
  const [wardsReload, setWardsReload] = useState(0);
  const [booting, setBooting] = useState(true);
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
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
    if (authMode !== 'register' || token) return undefined;
    const controller = new AbortController();
    let active = true;
    setWardsLoading(true);
    setWardsError('');
    setRegistrationWards([]);
    api('/public/wards', { signal: controller.signal }).then((result) => {
      if (active) setRegistrationWards(asArray(result?.wards).filter((ward) => wardIdentity(ward) && ward.name));
    }).catch((err) => {
      if (active) setWardsError(err.message || 'Không tải được danh mục phường.');
    }).finally(() => {
      if (active) setWardsLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [authMode, token, wardsReload]);

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
      await sessionStore.setItemAsync(USER_KEY, JSON.stringify(profileResult.value));
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
    setDataReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    const planId = carePlan?._id;
    if (!planId) {
      setCareDoneIds([]);
      setCareActiveDay(0);
      return () => { active = false; };
    }
    sessionStore.getItemAsync(`doctis.care.done.${planId}`)
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
      sessionStore.setItemAsync(`doctis.care.done.${planId}`, JSON.stringify(next)).catch(() => {});
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
    await sessionStore.deleteItemAsync(TOKEN_KEY);
    await sessionStore.deleteItemAsync(USER_KEY);
    setToken('');
    setUser(null);
    setProfile(null);
    setDataReady(false);
    setHealth(null);
    setHistory([]);
    setAppointments([]);
    setCarePlan(null);
    setPrescriptions([]);
    setDoctors([]);
    setDoctor(null);
    setMessages([]);
    setTab('home');
    setAiInput('');
    setAiNudgeVisible(true);
    setAiMessages([{ role: 'assistant', text: 'Xin chào! Mình là trợ lý kiến thức sức khỏe DOCTIS, tập trung vào đái tháo đường type 2. Bạn có thể hỏi về theo dõi đường huyết, ăn uống, vận động, thuốc và biến chứng.' }]);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const savedToken = await sessionStore.getItemAsync(TOKEN_KEY);
        const savedUser = await sessionStore.getItemAsync(USER_KEY);
        if (savedToken && savedUser && active) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
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
    if (authSubmitLock.current) return;
    const email = authForm.email.trim().toLowerCase();
    if (!email || !authForm.password) return setError('Nhập email và mật khẩu để tiếp tục.');
    if (authMode === 'register') {
      if (!authForm.cccd.trim() || !authForm.username.trim()) return setError('Nhập đầy đủ CCCD và tên tài khoản.');
      if (authForm.password.length < 8) return setError('Mật khẩu nên có ít nhất 8 ký tự.');
      if (authForm.password !== authForm.confirmPassword) return setError('Mật khẩu xác nhận chưa khớp.');
      if (!authForm.address.trim()) return setError('Nhập số nhà, tên đường và địa chỉ chi tiết của bạn.');
      if (wardsLoading || wardsError || !registrationWards.some((ward) => wardIdentity(ward) === authForm.wardId)) return setError('Vui lòng chọn một phường trong danh mục đã tải trước khi đăng ký.');
    }
    authSubmitLock.current = true;
    setAuthBusy(true);
    setError('');
    setNotice('');
    try {
      if (authMode === 'register') {
        const payload = { cccd: authForm.cccd.trim(), username: authForm.username.trim(), email, password: authForm.password, confirmPassword: authForm.confirmPassword, address: authForm.address.trim(), wardId: authForm.wardId, city: 'Đà Nẵng' };
        const signature = JSON.stringify(payload);
        if (registrationAttempt.current?.signature !== signature) registrationAttempt.current = { signature, requestId: createRegistrationKey() };
        await api('/auth/register', { method: 'POST', body: { ...payload, requestId: registrationAttempt.current.requestId } });
        registrationAttempt.current = null;
        setAuthForm({ ...registrationFields(), email });
        setAuthMode('login');
        setNotice('Tạo tài khoản thành công. Hồ sơ đang chờ cập nhật bệnh viện hỗ trợ. Bạn có thể đăng nhập để sử dụng DOCTIS.');
      } else {
        const result = await api('/auth/login', { method: 'POST', body: { email, password: authForm.password } });
        await sessionStore.setItemAsync(TOKEN_KEY, result.token);
        await sessionStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
        setToken(result.token);
        setUser(result.user);
        setProfile(result.user);
        registrationAttempt.current = null;
        setAuthForm(registrationFields());
        setTab('home');
        if (result.user?.role !== 'user') setNotice('Phiên bản mobile hiện dành cho tài khoản bệnh nhân. Bác sĩ và quản trị viên vui lòng dùng website DOCTIS.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      authSubmitLock.current = false;
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
      successFeedback();
    } catch (err) { setError(err.message); }
    finally { setHealthBusy(false); }
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    setError('');
    try {
      // Service location belongs to /care-team/address so intake and user stay in sync.
      const locationKeys = ['address', 'addressDetail', 'province', 'district', 'ward', 'wardId', 'city'];
      const profileWithoutLocation = Object.fromEntries(Object.entries(profile || {}).filter(([key]) => !locationKeys.includes(key)));
      const result = await api('/profile', { token, method: 'PUT', body: profileWithoutLocation });
      const saved = result.profile || profile;
      setProfile(saved);
      setUser((previous) => ({ ...previous, ...saved }));
      await sessionStore.setItemAsync(USER_KEY, JSON.stringify(saved));
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
                <Field label="Số CCCD" value={authForm.cccd} onChangeText={(value) => setAuthValue('cccd', value)} keyboardType="number-pad" editable={!authBusy} />
                <Field label="Tên tài khoản" value={authForm.username} onChangeText={(value) => setAuthValue('username', value)} autoCapitalize="none" editable={!authBusy} />
              </>}
              <Field label="Email" value={authForm.email} onChangeText={(value) => setAuthValue('email', value)} keyboardType="email-address" autoCapitalize="none" editable={!authBusy} />
              <Field label="Mật khẩu" value={authForm.password} onChangeText={(value) => setAuthValue('password', value)} secureTextEntry editable={!authBusy} />
              {authMode === 'register' && <>
                <Field label="Nhập lại mật khẩu" value={authForm.confirmPassword} onChangeText={(value) => setAuthValue('confirmPassword', value)} secureTextEntry editable={!authBusy} />
                <View style={styles.registrationAddress}>
                  <Text style={styles.cardTitle}>Địa chỉ phục vụ</Text>
                  <Text style={styles.cardSub}>DOCTIS hiện tiếp nhận đăng ký tại Đà Nẵng. Bệnh viện và bác sĩ sẽ được phân công sau khi hồ sơ được tiếp nhận.</Text>
                  <Field label="Thành phố" value="Đà Nẵng" editable={false} />
                  <RegistrationWardField wards={registrationWards} value={authForm.wardId} onChange={(value) => setAuthValue('wardId', value)} loading={wardsLoading} error={wardsError} onRetry={() => setWardsReload((previous) => previous + 1)} disabled={authBusy} />
                  <Field label="Địa chỉ chi tiết *" value={authForm.address} onChangeText={(value) => setAuthValue('address', value)} placeholder="Số nhà, tên đường, thôn/tổ dân phố" multiline editable={!authBusy} />
                </View>
              </>}
              <ActionButton title={authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} onPress={submitAuth} disabled={authBusy || (authMode === 'register' && (wardsLoading || !!wardsError || !registrationWards.length))} loading={authBusy} style={styles.authSubmit} />
              <Pressable style={styles.switchAuth} disabled={authBusy} onPress={() => { setError(''); setNotice(''); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}>
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
    if (!dataReady && !['home', 'ai'].includes(tab)) return <><ScreenTitle eyebrow="KHÔNG GIAN CHĂM SÓC" title={NAV_ITEMS.find(item => item.id === tab)?.label || 'Bác sĩ phụ trách'} subtitle="Đang cập nhật dữ liệu của bạn…" /><Skeleton /><Skeleton /></>;
    if (tab === 'health') return <HealthScreen health={health} history={history} form={healthForm} setForm={setHealthForm} onSave={submitHealth} busy={healthBusy} />;
    if (tab === 'care') return <CareScreen carePlan={carePlan} prescriptions={prescriptions} activeDay={careActiveDay} setActiveDay={setCareActiveDay} doneIds={careDoneIds} onToggleActivity={toggleCareActivity} remindedIds={careRemindedIds} reminderBusyId={careReminderBusyId} onCreateReminder={createCareReminder} />;
    if (tab === 'appointments') return <AppointmentsScreen appointments={appointments} onCancel={cancelAppointment} />;
    if (tab === 'profile') return <ProfileScreen profile={profile || user} editing={editingProfile} setEditing={setEditingProfile} setProfile={setProfile} onSave={saveProfile} busy={profileBusy} onSignOut={signOut} />;
    if (tab === 'ai') return <AIChatScreen messages={aiMessages} value={aiInput} setValue={setAiInput} onSend={sendAIMessage} busy={aiBusy} onBack={() => setTab('home')} />;
    if (tab === 'messages') return <MessagesScreen doctors={doctors} doctor={doctor} setDoctor={setDoctor} messages={messages} user={user} value={messageText} setValue={setMessageText} onSend={sendMessage} busy={messageBusy} attachment={messageAttachment} attachmentBusy={attachmentBusy} onChooseAttachment={chooseMessageAttachment} onRemoveAttachment={() => setMessageAttachment(null)} onOpenAttachment={openMessageAttachment} onComposerFocus={() => setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 300)} />;
    return <HomeScreen user={profile || user} greeting={greeting} health={health} appointments={appointments} carePlan={carePlan} onNavigate={setTab} dataReady={dataReady} />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.appHeader}>
        <BrandHeader compact />
        <Pressable accessibilityLabel="Mở hồ sơ cá nhân" style={styles.avatarButton} onPress={() => setTab('profile')}><Text style={styles.avatarText}>{greeting.slice(0, 1).toUpperCase()}</Text></Pressable>
      </View>
      {!!error && <Notice tone="error" text={error} onClose={() => setError('')} />}
      {!!notice && <Notice text={notice} onClose={() => setNotice('')} />}
      <ScrollView
        key={tab}
        ref={screenScrollRef}
        style={[styles.flex, styles.screenScroll]}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#087d83" />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <Reveal key={tab}>{renderScreen()}</Reveal>
      </ScrollView>
      {!keyboardVisible && <View style={styles.tabBar}>
        <BottomDock tab={tab} onNavigate={id => { setError(''); setNotice(''); setTab(id); }} />
      </View>}
      </KeyboardAvoidingView>
      {token && patientMode && tab === 'profile' && !keyboardVisible && (
        <View pointerEvents="box-none" style={styles.aiFloatingLayer}>
          {aiNudgeVisible && (
            <View style={styles.aiWelcomeCard}>
              <HealthArt robot size={44} />
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
            <HealthArt robot size={56} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function BrandHeader({ compact = false }) {
  return (
    <View style={[styles.brandHeader, compact && styles.brandHeaderCompact]}>
      <View style={styles.logo}><Icon name="pulse" color="#E3F2C1" size={26} /></View>
      <View><Text style={styles.brand}>DOCTIS<Text style={styles.brandPeriod}>.</Text></Text><Text style={styles.brandCaption}>ĐỒNG HÀNH MỖI NGÀY</Text></View>
      {!compact && <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>Bảo mật</Text></View>}
    </View>
  );
}

function BottomDock({ tab, onNavigate }) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;
  const selected = NAV_ITEMS.findIndex(item => item.id === tab);
  useEffect(() => {
    if (selected < 0) return;
    const toValue = selected * width / NAV_ITEMS.length;
    if (reduced) { slide.setValue(toValue); return; }
    const animation = Animated.spring(slide, { toValue, stiffness: 260, damping: 26, mass: .8, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [selected, width, reduced, slide]);
  return <View accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.dockInner}>
    {width > 0 && selected >= 0 && <Animated.View pointerEvents="none" style={[styles.dockIndicator, { width: width / NAV_ITEMS.length - 4, transform: [{ translateX: slide }] }]} />}
    {NAV_ITEMS.map(item => <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.id }} style={styles.tabItem} onPress={() => { feedback(); onNavigate(item.id); }}><View style={[styles.tabIconWrap, item.id === 'care' && styles.tabCenter]}><Icon name={item.id} size={22} color={tab === item.id ? '#087E80' : '#57706E'} /></View><Text numberOfLines={1} style={[styles.tabLabel, tab === item.id && styles.tabLabelSelected]}>{item.label}</Text></Pressable>)}
  </View>;
}

function Notice({ text, tone = 'success', onClose }) {
  return <View accessibilityLiveRegion="polite" style={[styles.notice, tone === 'error' && styles.noticeError]}><Icon name={tone === 'error' ? 'shield' : 'check'} size={20} color={tone === 'error' ? '#AD3E4A' : '#087E80'} /><Text style={[styles.noticeText, tone === 'error' && styles.noticeErrorText]}>{text}</Text>{!!onClose && <Pressable onPress={onClose} accessibilityLabel="Đóng thông báo" style={styles.noticeDismiss}><Text style={styles.noticeClose}>×</Text></Pressable>}</View>;
}

function LoadingScreen() {
  return <SafeAreaView style={[styles.safeArea, styles.loadingScreen]}><HealthArt size={140} /><Text style={styles.sectionTitle}>Không gian chăm sóc của bạn</Text><ActivityIndicator style={{ marginTop: 24 }} color="#087d83" /><Text style={styles.loadingLabel}>Đang khôi phục phiên đăng nhập…</Text></SafeAreaView>;
}

function HomeScreen({ user, greeting, health, appointments, carePlan, onNavigate, dataReady }) {
  const [context, setContext] = useState(0);
  const [tip, setTip] = useState(0);
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const tips = [
    { title: 'Một chút quan tâm,\nmỗi ngày.', detail: 'Lưu lại lần đo hôm nay để theo dõi thay đổi theo thời gian.', action: 'Ghi chỉ số', screen: 'health' },
    { title: 'Chăm sóc theo\nnhịp sống của bạn.', detail: 'Xem hoạt động trong kế hoạch và cập nhật những việc đã hoàn thành.', action: 'Xem kế hoạch', screen: 'care' },
    { title: 'Luôn có một\nkết nối bên bạn.', detail: 'Trao đổi những điều bạn muốn chia sẻ với bác sĩ phụ trách.', action: 'Nhắn bác sĩ', screen: 'messages' },
  ];
  useEffect(() => {
    if (reduced) return undefined;
    const interval = setInterval(() => { if (AppState.currentState === 'active') setTip(previous => (previous + 1) % tips.length); }, 6000);
    return () => clearInterval(interval);
  }, [reduced]);
  const upcoming = asArray(appointments).find((item) => ['pending', 'approved'].includes(item.status));
  const metrics = [
    { label: 'Huyết áp', icon: 'pulse', value: health?.systolic != null && health?.diastolic != null ? `${health.systolic}/${health.diastolic}` : '—', unit: 'mmHg' },
    { label: 'Đường huyết', icon: 'drop', value: health?.glucose ?? '—', unit: 'mg/dL' },
    { label: 'Cân nặng', icon: 'scale', value: health?.weight ?? '—', unit: 'kg' },
  ];
  const selected = metrics[context];
  return <>
    <View style={styles.greetingRow}><View style={styles.flex}><Text style={styles.screenEyebrow}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}</Text><LetterGreeting text="Xin chào," style={styles.greetingTitle} /><Reveal delay={70}><Text style={styles.greetingName}>{greeting}</Text></Reveal></View><View style={styles.greetingMark}><Icon name="spark" color="#71884F" size={25} /></View></View>
    <LinearGradient colors={context === 1 ? ['#234B50', '#173C48'] : context === 2 ? ['#425544', '#253F38'] : ['#1D5955', '#103F40']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.homeHero}>
      <View style={styles.heroTop}><Text style={styles.heroEyebrow}>NHỊP SỨC KHỎE CỦA BẠN</Text><Icon name="pulse" color="#DDF2AB" size={22} /></View>
      <View style={styles.heroContext}>{metrics.map((metric, index) => <Pressable key={metric.label} accessibilityRole="tab" accessibilityState={{ selected: index === context }} onPress={() => setContext(index)} style={[styles.contextTab, context === index && styles.contextTabActive]}><Text style={[styles.contextText, context === index && styles.contextTextActive]}>{metric.label}</Text></Pressable>)}</View>
      <View style={styles.heroBody}><Reveal key={context} style={styles.heroReading}><Text style={styles.heroMetricLabel}>{selected.label} gần nhất</Text><CountValue value={selected.value} style={styles.heroNumber} /><Text style={styles.heroUnit}>{selected.unit}</Text><Text style={styles.heroUpdated}>{!dataReady ? 'Đang tải lần đo…' : health?.createdAt ? displayDate(health.createdAt) : 'Chưa có lần đo'}</Text></Reveal><AmbientArt size={width < 370 ? 100 : 142} /></View>
      <View style={styles.heroBmi}><Text style={styles.heroFooterText}>BMI gần nhất</Text><Text style={styles.heroBmiValue}>{health?.bmi ?? '—'} <Text style={styles.heroUnit}>kg/m²</Text></Text></View>
      <Pressable onPress={() => onNavigate('health')} style={styles.heroFooter}><Text style={styles.heroFooterText}>Ghi nhận một lần đo mới</Text><Icon name="arrow" size={21} color="#E0F1D5" /></Pressable>
    </LinearGradient>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Hôm nay, bạn cần gì?</Text><Text style={styles.sectionSubtitle}>Chăm sóc từ những điều nhỏ</Text></View>
    <View style={styles.quickGrid}>
      <QuickCard icon="health" title="Ghi chỉ số" detail="Thêm lần đo mới" tint="#E1EFE6" onPress={() => onNavigate('health')} />
      <QuickCard icon="care" title="Chăm sóc" detail={carePlan ? 'Kế hoạch của bạn' : 'Chờ kế hoạch mới'} tint="#EAE9F2" delay={50} onPress={() => onNavigate('care')} />
      <QuickCard icon="appointments" title="Lịch khám" detail={upcoming ? displayDate(upcoming.appointmentDate) : 'Theo dõi lịch hẹn'} tint="#F7E8D8" delay={100} onPress={() => onNavigate('appointments')} />
      <QuickCard icon="message" title="Nhắn bác sĩ" detail="Kết nối người phụ trách" tint="#E0EDF0" delay={150} onPress={() => onNavigate('messages')} />
    </View>
    <Pressable accessibilityLabel="Trò chuyện với DOCTIS AI" onPress={() => onNavigate('ai')} style={styles.aiInvite}><HealthArt robot size={82} /><View style={styles.flex}><Text style={styles.aiInviteKicker}>DOCTIS AI</Text><Text style={styles.aiInviteTitle}>Có điều bạn muốn hỏi?</Text><Text style={styles.aiInviteDetail}>Cùng tìm hiểu về sức khỏe</Text></View><Icon name="arrow" size={22} /></Pressable>
    {!dataReady ? <Skeleton /> : <Card style={styles.dashboardCard}><View style={styles.cardHeading}><View style={styles.flex}><Text style={styles.cardTitle}>Chỉ số sức khỏe gần nhất</Text><Text style={styles.cardSub}>{health?.createdAt ? `Cập nhật ${displayDate(health.createdAt)}` : 'Chưa có dữ liệu được ghi nhận'}</Text></View><Icon name="pulse" size={22} /></View><View style={styles.metricGrid}><Metric label="GLUCOSE" value={health?.glucose ?? '—'} unit="mg/dL" /><Metric label="HUYẾT ÁP" value={health?.systolic != null && health?.diastolic != null ? `${health.systolic}/${health.diastolic}` : '—'} unit="mmHg" /><Metric label="NHỊP TIM" value={health?.heartRate ?? '—'} unit="bpm" /><Metric label="CÂN NẶNG" value={health?.weight ?? '—'} unit="kg" /></View></Card>}
    <Card style={styles.tipCard}><Reveal key={tip}><Text style={styles.screenEyebrow}>ĐỒNG HÀNH CÙNG BẠN · {tip + 1}/3</Text><Text style={styles.tipTitle}>{tips[tip].title}</Text><Text style={styles.bodyText}>{tips[tip].detail}</Text><Pressable style={styles.tipAction} onPress={() => onNavigate(tips[tip].screen)}><Text style={styles.switchStrong}>{tips[tip].action}</Text><Icon name="arrow" size={20} /></Pressable></Reveal><View style={styles.tipDots}>{tips.map((_, index) => <Pressable key={index} accessibilityLabel={`Nội dung ${index + 1}`} accessibilityState={{ selected: tip === index }} onPress={() => setTip(index)} style={styles.tipDotTarget}><View style={[styles.tipDot, index === tip && styles.tipDotActive]} /></Pressable>)}</View></Card>
    {user?.chronicDiseases ? <Card><Text style={styles.cardTitle}>Thông tin sức khỏe cần lưu ý</Text><Text style={styles.bodyText}>{user.chronicDiseases}</Text>{user.allergies ? <Text style={styles.bodyMuted}>Dị ứng: {user.allergies}</Text> : null}</Card> : null}
    <Text style={styles.disclaimer}>DOCTIS hỗ trợ theo dõi thông tin sức khỏe, không thay thế chẩn đoán hoặc điều trị của nhân viên y tế.</Text>
  </>;
}

function Metric({ label, value, unit, light = false }) {
  return <View style={styles.metric}><Text style={[styles.metricLabel, light && styles.metricLabelLight]}>{label}</Text><CountValue value={value} style={[styles.metricValue, light && styles.metricValueLight]} /><Text style={[styles.metricUnit, light && styles.metricUnitLight]}>{unit}</Text></View>;
}

function QuickCard({ icon, title, detail, tint, onPress, delay = 0 }) {
  return <Reveal delay={delay} style={styles.quickCardWrap}><Pressable onPress={onPress} style={styles.quickCard}><View style={styles.quickTop}><View style={[styles.quickIcon, { backgroundColor: tint }]}><Icon name={icon} size={25} /></View><Icon name="arrow" size={18} color="#648079" /></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></Pressable></Reveal>;
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
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();

  useEffect(() => {
    requestAnimationFrame(() => chatScrollRef.current?.scrollToEnd({ animated: !reduced }));
  }, [messages, busy, reduced]);

  return <>
    <Pressable style={styles.aiBackButton} onPress={onBack} accessibilityRole="button">
      <Text style={styles.aiBackText}>‹  Quay lại</Text>
    </Pressable>
    <View style={styles.aiIntro}><View style={styles.flex}><Text style={styles.screenEyebrow}>MỘT NGƯỜI BẠN TRI THỨC</Text><Text style={styles.screenTitle}>Hỏi DOCTIS AI</Text><Text style={styles.screenSubtitle}>Cùng hiểu hơn về sức khỏe của bạn.</Text></View><AmbientArt robot size={112} /></View>
    <Card style={[styles.aiChatCard, { height: Math.max(440, Math.min(650, height - 310)) }]}>
      <View style={styles.aiChatHeader}>
        <View style={styles.aiChatIcon}><Icon name="spark" size={24} /></View>
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
        {messages.length === 1 && <View style={styles.aiSuggestions}>{['Tìm hiểu về đường huyết', 'Ăn uống và vận động', 'Tôi muốn hỏi về thuốc'].map(suggestion => <Pressable key={suggestion} onPress={() => setValue(suggestion)} style={styles.aiSuggestion}><Text style={styles.aiSuggestionText}>{suggestion}</Text><Icon name="arrow" size={18} /></Pressable>)}</View>}
        {busy ? <View style={styles.aiMessageRow}><View accessibilityLiveRegion="polite" style={styles.aiThinkingBubble}><ActivityIndicator size="small" color="#087d83" /><Text style={styles.aiThinkingText}>DOCTIS AI đang trả lời…</Text></View></View> : null}
      </ScrollView>
      <View style={styles.aiComposer}>
        <TextInput
          style={styles.aiInput}
          accessibilityLabel="Nội dung gửi DOCTIS AI"
          value={value}
          onChangeText={setValue}
          placeholder="Hỏi về đường huyết, ăn uống, vận động…"
          placeholderTextColor="#91a4a8"
          maxLength={1200}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <Pressable accessibilityLabel="Gửi câu hỏi" style={[styles.aiSendButton, (busy || !value.trim()) && styles.messageSendDisabled]} onPress={onSend} disabled={busy || !value.trim()}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="arrow" size={24} color="#FFFFFF" />}
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
  const renderActivity = (day, item, dayIndex) => {
    const key = `${carePlan?._id}-${day?.dayIndex ?? dayIndex}-${item.id || item.time}`;
    const complete = doneIds.includes(key);
    const reminded = remindedIds.includes(key);
    const meta = typeMeta(item.type);
    return <View key={key} style={[styles.careActivityRow, complete && styles.careActivityDone]}>
      <View style={styles.careActivityMain}>
        <Text style={styles.careActivityTime}>{item.time || '—'}</Text>
        <View style={[styles.careActivityIcon, meta.tone]}><Icon name={meta.label === 'Ăn uống' ? 'meal' : meta.label === 'Vận động' ? 'walk' : meta.label === 'Thuốc' ? 'medicine' : 'health'} size={22} /></View>
        <View style={styles.careActivityCopy}>
          <Text style={[styles.careActivityTitle, complete && styles.careActivityTitleDone]}>{item.title || meta.label}</Text>
          <Text style={styles.careActivityType}>{meta.label}</Text>{item.description ? <Text style={styles.careActivityDescription}>{item.description}</Text> : null}
        </View>
      </View>
      <View style={styles.careActivityActions}>
        <Pressable style={[styles.careActionButton, reminded && styles.careReminderDone]} onPress={() => onCreateReminder(day, item, dayIndex)} disabled={reminded || reminderBusyId === key}>
          {reminderBusyId === key ? <ActivityIndicator size="small" color="#3977f2" /> : <Text style={[styles.careActionText, reminded && styles.careReminderDoneText]}>{reminded ? 'Đã nhắc' : '♧ Nhắc email'}</Text>}
        </Pressable>
        <Pressable accessibilityState={{ selected: complete }} style={[styles.careDoneButton, complete && styles.careDoneButtonActive]} onPress={() => { feedback(); onToggleActivity(key); }}>
          <Text style={[styles.careDoneButtonText, complete && styles.careDoneButtonTextActive]}>{complete ? '✓ Đã xong' : 'Đánh dấu xong'}</Text>
        </Pressable>
      </View>
    </View>;
  };

  return <>
    <ScreenTitle eyebrow="ĐỒNG HÀNH ĐIỀU TRỊ" title="Kế hoạch chăm sóc" subtitle="Theo dõi lịch tuần, xem hướng dẫn từng hoạt động và đánh dấu tiến độ hằng ngày." />
    {carePlan ? <>
      <Card style={styles.carePlanIntro}>
        <View style={styles.carePlanIntroTop}>
          <View style={styles.carePlanIntroIcon}><Text style={styles.carePlanIntroIconText}>✚</Text></View>
          <View style={styles.carePlanIntroCopy}><Text style={styles.cardTitle}>{carePlan.source === 'AI' ? 'Kế hoạch chăm sóc cá nhân' : 'Kế hoạch của bác sĩ'}</Text><Text style={styles.cardSub}>Cập nhật {displayDate(carePlan.updatedAt)}</Text></View>
        </View>
        <Text style={[styles.careConfirmedPill, carePlan.source === 'AI' && styles.careDraftPill]}>{carePlan.source === 'AI' ? 'AI · Chờ rà soát' : 'Đang thực hiện'}</Text>
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
              return <Pressable accessibilityLabel={`${dayName(day, index)}, ${done} trên ${items.length} việc đã hoàn thành`} accessibilityState={{ selected: index === selectedIndex }} key={`${day.dayIndex}-${index}`} onPress={() => { feedback(); setActiveDay(index); }} style={[styles.careDayCard, index === selectedIndex && styles.careDayCardActive]}>
                <View style={styles.careDayCardHeader}><View style={[styles.careDayNumber, index === selectedIndex && styles.careDayNumberActive]}><Text style={[styles.careDayNumberText, index === selectedIndex && styles.careDayNumberTextActive]}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.careDayCardTitleWrap}><Text style={[styles.careDayCardTitle, index === selectedIndex && styles.careDayTextActive]}>{dayName(day, index)}</Text><Text style={[styles.careDayCount, index === selectedIndex && styles.careDayTextActive]}>{done}/{items.length} việc</Text></View><Text style={[styles.careDayPercent, index === selectedIndex && styles.careDayTextActive]}>{percent}%</Text></View>
                <View style={styles.careProgressTrack}><View style={[styles.careProgressFill, { width: `${percent}%` }]} /></View>
                {!items.length && <Text style={[styles.careNoActivities, index === selectedIndex && styles.careDayTextActive]}>Chưa có hoạt động</Text>}
              </Pressable>;
            })}
          </ScrollView>
        </Card>
        <Reveal key={selectedIndex}><Card style={styles.careDetailCard}>
          <View style={styles.careDetailHeader}><View style={styles.careSectionHeading}><Text style={styles.careKicker}>CHI TIẾT NGÀY</Text><Text style={styles.careSectionTitle}>{dayName(selectedDay, selectedIndex)}</Text><Text style={styles.careSectionSub}>{selectedDone}/{selectedActivities.length} hoạt động hoàn thành</Text></View><View style={styles.careDayStatus}><Text style={styles.careDayStatusText}>{carePlan.source === 'AI' ? '✦ Kế hoạch cá nhân' : '✚ Kế hoạch bác sĩ'}</Text></View></View>
          {selectedDay?.summary ? <Text style={styles.careDaySummary}>{selectedDay.summary}</Text> : null}
          {selectedActivities.length ? selectedActivities.map((item) => renderActivity(selectedDay, item, selectedIndex)) : <EmptyState text="Chưa có hoạt động cho ngày này." />}
        </Card></Reveal>
      </> : <Card><EmptyState text="Kế hoạch chưa có lịch theo ngày." /></Card>}
    </> : <Card><Text style={styles.cardTitle}>Kế hoạch của bác sĩ</Text><EmptyState text="Bác sĩ chưa chốt kế hoạch chăm sóc cho bạn." /></Card>}
    <Card><Text style={styles.cardTitle}>Đơn thuốc đã chốt</Text>{asArray(prescriptions).length ? asArray(prescriptions).map((prescription) => <View key={prescription._id} style={styles.prescriptionCard}><View style={styles.cardHeading}><Text style={styles.planItemTitle}>{prescription.title || 'Đơn thuốc'}</Text><Text style={styles.dayStatus}>Đã chốt</Text></View><Text style={styles.cardSub}>{displayDate(prescription.confirmedAt || prescription.createdAt)}</Text>{prescription.note ? <Text style={styles.bodyMuted}>{prescription.note}</Text> : null}{asArray(prescription.medicines).map((medicine, index) => <View key={`${medicine.name}-${index}`} style={styles.medicineRow}><Text style={styles.medicineName}>{medicine.name}</Text><Text style={styles.bodyMuted}>{[medicine.dosage, medicine.frequency, asArray(medicine.times).join(', ')].filter(Boolean).join(' · ')}</Text></View>)}</View>) : <EmptyState text="Chưa có đơn thuốc đã chốt." />}</Card>
  </>;
}

function AppointmentsScreen({ appointments, onCancel }) {
  const activeCount = asArray(appointments).filter(item => ['pending', 'approved'].includes(item.status)).length;
  return <>
    <ScreenTitle eyebrow="THEO DÕI KHÁM BỆNH" title="Lịch hẹn" subtitle="Xem trạng thái cuộc hẹn với bác sĩ phụ trách." />
    <View style={styles.appointmentSummary}><View style={styles.appointmentSummaryIcon}><Icon name="appointments" size={30} /></View><View style={styles.flex}><Text style={styles.cardTitle}>{activeCount} lịch hẹn đang theo dõi</Text><Text style={styles.bodyMuted}>Lịch khám được cập nhật bởi bác sĩ.</Text></View></View>
    <Text style={styles.appointmentListTitle}>Các cuộc hẹn của bạn</Text>
    {asArray(appointments).length ? asArray(appointments).map((item, index) => <Reveal key={item._id} delay={Math.min(index, 4) * 50}><AppointmentCard item={item} onCancel={onCancel} /></Reveal>) : <Card><EmptyState text="Bạn chưa có lịch hẹn. Bác sĩ phụ trách có thể tạo lịch hẹn trên DOCTIS." /></Card>}
  </>;
}

function AppointmentCard({ item, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const date = new Date(item.appointmentDate);
  const validDate = !Number.isNaN(date.getTime());
  return <Card style={styles.appointmentCard}>
    <Pressable accessibilityLabel={`${item.type || 'Lịch khám'}, ${displayDate(item.appointmentDate)}. Xem chi tiết`} accessibilityState={{ expanded }} onPress={() => setExpanded(previous => !previous)} style={styles.appointmentMain}>
      <View style={styles.appointmentDateTile}><Text style={styles.appointmentMonth}>{validDate ? `THÁNG ${date.getMonth() + 1}` : 'NGÀY'}</Text><Text style={styles.appointmentDay}>{validDate ? date.getDate() : '—'}</Text></View>
      <View style={styles.flex}><Text style={styles.appointmentType}>{item.type || 'Lịch khám'}</Text><View style={styles.appointmentTimeRow}><Icon name="clock" size={16} /><Text style={styles.appointmentTime}>{validDate ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Chưa cập nhật'}</Text></View><Text style={[styles.statusPill, item.status === 'approved' && styles.statusApproved, item.status === 'cancelled' && styles.statusCancelled]}>{prettyStatus(item.status)}</Text></View><Text style={styles.appointmentChevron}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    <Text style={styles.appointmentDate}>{displayDate(item.appointmentDate)}</Text>
    {expanded && <Reveal><View style={styles.appointmentDetails}>{item.doctorId?.fullName || item.doctorId?.username ? <Text style={styles.bodyText}>Bác sĩ: {item.doctorId.fullName || item.doctorId.username}</Text> : null}{item.note ? <Text style={styles.bodyText}>Ghi chú: {item.note}</Text> : <Text style={styles.bodyMuted}>Không có ghi chú thêm.</Text>}{['pending', 'approved'].includes(item.status) ? <Pressable onPress={() => onCancel(item)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Hủy lịch hẹn</Text></Pressable> : null}</View></Reveal>}
    <Text style={styles.appointmentHint}>{expanded ? 'Chạm thẻ để thu gọn' : 'Chạm thẻ để xem bác sĩ và ghi chú'}</Text>
  </Card>;
}

function ProfileScreen({ profile, editing, setEditing, setProfile, onSave, busy, onSignOut }) {
  const fields = [
    ['fullName', 'Họ và tên'], ['phone', 'Số điện thoại'], ['dateOfBirth', 'Ngày sinh'], ['gender', 'Giới tính'],
    ['bloodType', 'Nhóm máu'], ['chronicDiseases', 'Bệnh nền'], ['allergies', 'Dị ứng'], ['currentMedications', 'Thuốc đang dùng'],
    ['emergencyContactName', 'Người liên hệ khẩn cấp'], ['emergencyContactPhone', 'Số điện thoại khẩn cấp'], ['address', 'Địa chỉ'],
  ];
  return <>
    <ScreenTitle eyebrow="THÔNG TIN CÁ NHÂN" title="Hồ sơ sức khỏe" subtitle="Thông tin này giúp đội ngũ chăm sóc hiểu hồ sơ của bạn." />
    <Card style={styles.profileCard}>
      <View style={styles.profileIdentity}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{fullName(profile).slice(0, 1).toUpperCase()}</Text></View><View style={styles.profileIdentityText}><Text style={styles.profileName}>{fullName(profile)}</Text><Text style={styles.bodyMuted}>{profile?.email}</Text></View></View>
      <View style={styles.profileFields}>{fields.map(([key, label], index) => <View key={key}>
        {[0, 4, 8, 10].includes(index) && <View style={styles.profileGroupHeading}><Icon name={index === 0 ? 'profile' : index === 4 ? 'care' : index === 8 ? 'shield' : 'home'} size={19} /><Text style={styles.profileGroupTitle}>{index === 0 ? 'Thông tin cá nhân' : index === 4 ? 'Thông tin y tế' : index === 8 ? 'Liên hệ khẩn cấp' : 'Địa chỉ phục vụ'}</Text></View>}
        <View style={styles.profileField}>
        {editing && key !== 'address' ? <Field label={label} value={profile?.[key] || ''} onChangeText={(value) => setProfile((previous) => ({ ...previous, [key]: value }))} /> : <>
          <Text style={styles.profileLabel}>{label}</Text>
          <Text style={styles.profileValue}>{key === 'address' ? [profile?.address, profile?.ward, profile?.city || profile?.province].filter(Boolean).join(', ') || 'Chưa cập nhật' : profile?.[key] || 'Chưa cập nhật'}</Text>
          {key === 'address' && editing && <Text style={styles.bodyMuted}>Để cập nhật địa chỉ và phường, mở DOCTIS trên web → Bệnh viện và bác sĩ phụ trách. Thay đổi địa chỉ cần được đồng bộ với hồ sơ tiếp nhận.</Text>}
        </>}
      </View></View>)}</View>
      {editing ? <View style={styles.actionRow}><ActionButton title="Lưu thay đổi" onPress={onSave} disabled={busy} style={styles.flexButton} /><ActionButton title="Hủy" secondary onPress={() => setEditing(false)} style={styles.flexButton} /></View> : <ActionButton title="Chỉnh sửa hồ sơ" secondary onPress={() => setEditing(true)} style={styles.fullButton} />}
    </Card>
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
        <TextInput accessibilityLabel="Tin nhắn gửi bác sĩ" style={styles.messageComposerInput} value={value} onChangeText={setValue} placeholder="Nhập nội dung tin nhắn..." placeholderTextColor="#57706E" onFocus={onComposerFocus} multiline={false} autoCorrect autoCapitalize="sentences" returnKeyType="send" onSubmitEditing={onSend} />
        {attachment ? <View style={styles.pendingAttachment}><Text numberOfLines={1} style={styles.pendingAttachmentName}>{attachment.type?.startsWith('image/') ? '▧ ' : '▤ '}{attachment.name}</Text><Pressable accessibilityLabel="Bỏ tệp đính kèm" style={styles.noticeDismiss} onPress={onRemoveAttachment}><Text style={styles.removeAttachment}>×</Text></Pressable></View> : null}
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
      <Text numberOfLines={2} style={styles.messageAttachmentName}>{attachment.name || (isImage ? 'Ảnh đính kèm' : 'Tệp đính kèm')}</Text>
      <Text style={styles.messageAttachmentMeta}>{attachment.size ? `${(attachment.size / 1024).toFixed(1)} KB` : 'Tệp đính kèm'}{attachment.type ? ` · ${attachment.type.split('/').pop()}` : ''}</Text>
    </View>
    <Pressable style={styles.openAttachmentButton} onPress={() => onOpen(attachment)}><Text style={styles.openAttachmentText}>{isImage ? 'Lưu' : 'Mở / lưu'}</Text></Pressable>
  </View>;
}
function EmptyState({ text }) {
  return <View style={styles.emptyState}><HealthArt size={108} /><Text style={styles.emptyText}>{text}</Text></View>;
}
