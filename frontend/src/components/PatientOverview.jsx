import { lazy, Suspense, useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import useLiveReducedMotion from './useLiveReducedMotion';
import { FaArrowRight, FaPlus, FaTint, FaWeight, FaHeartbeat, FaHeart, FaCalendarCheck, FaUtensils, FaRobot, FaShieldAlt, FaExclamationTriangle, FaChartLine, FaCube } from 'react-icons/fa';
import HeartScene from './3d/HeartScene';
import { useStudioPreferences } from './studio/StudioPreferences';
import { AppointmentCountdown } from './studio/AppointmentCalendar';
import { HEALTH_METRICS, MeasurementPlot } from './DashboardChart';
import { filterMeasurementRange, formatMeasurement, prepareHealthChartData } from './healthChartData';
import '../CSS/patient-overview.css';

const ChartDepth = lazy(() => import('./3d/ChartDepth'));

const KNOWLEDGE = [
  ['/images/diabetes/diabetes-01.jpg', '01', 'Kiểm soát đường huyết', 'Theo dõi đều đặn, nhận biết những thay đổi.'],
  ['/images/diabetes/diabetes-02.jpg', '02', 'Dinh dưỡng & vận động', 'Những thói quen nhỏ trong chăm sóc hằng ngày.'],
  ['/images/diabetes/diabetes-03.jpg', '03', 'Chăm sóc chủ động', 'Gắn kết lịch sử đo, kế hoạch và bác sĩ.'],
];

export default function PatientOverview({ displayName, latest, data, risk, analysisData, nextAppointment, nutritionPlan, loading, error, navigate, formatDate, formatTime, appointmentStatusLabel }) {
  const reduced = useLiveReducedMotion();
  const { simpleUI } = useStudioPreferences();
  const id = useId();
  const [metricKey, setMetricKey] = useState('glucose');
  const [days, setDays] = useState(0);
  const [mode, setMode] = useState('readings');
  const [depth, setDepth] = useState(false);
  const actualDepth = depth && !reduced && !simpleUI;
  const records = useMemo(() => prepareHealthChartData(data), [data]);
  const filtered = useMemo(() => filterMeasurementRange(records, days), [records, days]);
  const metric = HEALTH_METRICS.find(item => item.key === metricKey);
  const metricLatest = [...filtered].reverse().find(row => metric.lines.some(line => formatMeasurement(row[line.key]) !== '—'));
  const recorded = latest?.createdAt ? `${formatDate(latest.createdAt)} · ${formatTime(latest.createdAt)}` : 'Chưa có lần ghi nhận';
  const metrics = [
    { key:'glucose', title:'Đường huyết', value:Number(latest?.glucose) > 0 ? latest.glucose : '—', unit:'mg/dL', icon:<FaTint />, tone:'coral' },
    { key:'pressure', title:'Huyết áp', value:latest?.systolic && latest?.diastolic ? `${latest.systolic}/${latest.diastolic}` : '—', unit:'mmHg', icon:<FaHeart />, tone:'rose' },
    { key:'heartRate', title:'Nhịp tim', value:Number(latest?.heartRate) > 0 ? latest.heartRate : '—', unit:'bpm', icon:<FaHeartbeat />, tone:'teal' },
    { key:'bmi', title:'BMI', value:Number(latest?.bmi) > 0 ? latest.bmi : '—', unit:'kg/m²', icon:<FaWeight />, tone:'olive' },
  ];
  const action = (page) => navigate(page);
  return <div className="patient-overview overview-depth-edition" data-design-version="patient-3d-studio-20261017">
    <section className="overview-intro" aria-labelledby="overview-greeting">
      <div className="overview-intro-copy">
        <span className="overview-eyebrow"><i /> Không gian chăm sóc của bạn</span>
        <h2 id="overview-greeting"><span className="overview-greeting-lead">Xin chào,</span><span>{displayName}</span></h2>
        <p>Cùng theo dõi thay đổi của cơ thể và tiếp tục chăm sóc sức khỏe mỗi ngày.</p>
        <div className="overview-actions"><motion.button whileHover={reduced ? undefined : { y: -2 }} whileTap={reduced ? undefined : { scale: .97 }} className="overview-button primary" type="button" onClick={() => action('health')}><FaPlus /> Ghi nhận chỉ số <FaArrowRight /></motion.button><button className="overview-button text" type="button" onClick={() => action('profile')}>Hồ sơ của tôi <FaArrowRight /></button></div>
        <div className="overview-intro-caption"><span className="overview-caption-line" /><p>Mỗi lần ghi nhận.<br /><strong>Một bước hiểu cơ thể hơn.</strong></p></div>
      </div>
      <div className="overview-scene">
        <span className="overview-scene-index">DOCTIS / HEALTH STUDIO</span>
        <div className="overview-heart-slot"><HeartScene bpm={latest?.heartRate} status={risk?.label} busy={loading} className="overview-heart-canvas" /></div>
        <div className={`overview-risk ${latest ? risk?.className || '' : ''}`}><span className="overview-risk-symbol"><FaShieldAlt /></span><div><small>Đánh giá từ chỉ số gần nhất</small><strong>{latest ? risk?.label || '—' : 'Chưa có đánh giá'}</strong></div></div>
      </div>
    </section>

    {Number(latest?.glucose || 0) >= 240 && <div className="overview-alert" role="alert"><FaExclamationTriangle /> Glucose đang ở mức rất cao. Bạn nên kiểm tra y tế sớm.</div>}

    <section className="overview-metrics" aria-labelledby="overview-latest-title">
      <div className="overview-section-line"><h2 id="overview-latest-title">Lần ghi nhận gần nhất</h2><time>{recorded}</time><button type="button" onClick={() => action('analytics')}>Xem lịch sử <FaArrowRight /></button></div>
      <div className="overview-metric-grid">{metrics.map((item,index) => <motion.button key={item.key} type="button" className={`overview-metric ${item.tone}`} onClick={() => setMetricKey(item.key)} aria-label={`Xem biểu đồ ${item.title}`} aria-pressed={metricKey === item.key} initial={false} whileHover={reduced ? undefined : { y: -4, rotateX: 2 }} whileTap={reduced ? undefined : { scale: .98 }} transition={{duration:.2}}><span className="overview-metric-top"><span className="overview-metric-icon">{item.icon}</span><span className="overview-metric-order">0{index+1}</span></span><div><span className="overview-metric-label">{item.title}</span><strong>{item.value}<small>{item.value !== '—' ? item.unit : ''}</small></strong></div><span className="overview-metric-bottom"><span><i />{item.value !== '—' ? 'Đã ghi nhận' : 'Chưa có dữ liệu'}</span><FaArrowRight className="overview-metric-arrow" /></span></motion.button>)}</div>
    </section>

    <section className="overview-workbench" aria-label="Diễn biến và chăm sóc">
      <article className="overview-chart">
        <div className="overview-panel-heading"><div><span className="overview-eyebrow">Nhìn lại sức khỏe</span><h2>Diễn biến các lần đo</h2></div><div className="overview-dimension" role="group" aria-label="Chiều hiển thị biểu đồ"><button type="button" aria-pressed={!actualDepth} onClick={() => setDepth(false)}><FaChartLine /> 2D</button><button type="button" aria-pressed={actualDepth} disabled={reduced || simpleUI} onClick={() => setDepth(true)} title={reduced || simpleUI ? 'Dùng biểu đồ 2D khi giảm chuyển động hoặc bật giao diện đơn giản.' : 'Xem cùng dữ liệu trong không gian 3D'}><FaCube /> 3D</button></div></div>
        <div className="overview-chart-tabs" role="group" aria-label="Chỉ số trên biểu đồ">{HEALTH_METRICS.map(item => <button type="button" key={item.key} aria-pressed={metricKey === item.key} onClick={() => setMetricKey(item.key)}>{metricKey === item.key && <motion.i layoutId={`overview-metric-selection-${id}`} transition={{duration:reduced ? 0 : .18}} />}<span>{item.label}</span></button>)}</div>
        <div className="overview-chart-summary"><div><span>{metric.label} · Gần nhất trong khoảng</span><strong>{metricLatest ? metric.lines.map(line => formatMeasurement(metricLatest[line.key])).join(' / ') : '—'}<small>{metricLatest ? metric.unit : ''}</small></strong><time>{metricLatest ? new Date(metricLatest.timestamp).toLocaleString('vi-VN') : 'Chưa có chỉ số phù hợp'}</time></div><div className="overview-chart-controls"><label>Khoảng dữ liệu<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={0}>Tất cả</option><option value={7}>7 ngày</option><option value={30}>30 ngày</option><option value={90}>90 ngày</option></select></label><label>Trục biểu đồ<select value={mode} onChange={e => setMode(e.target.value)}><option value="readings">Theo lần đo</option><option value="time">Theo thời gian</option></select></label></div></div>
        <motion.div key={`${metricKey}-${actualDepth}`} initial={{opacity:reduced ? 1 : 0}} animate={{opacity:1}} transition={{duration:reduced ? 0 : .18}}>
          {loading ? <div className="overview-chart-state" role="status">Đang tải lịch sử đo…</div> : error ? <div className="overview-chart-state" role="alert">Không tải được lịch sử sức khỏe. Vui lòng thử lại sau.</div> : actualDepth ? <Suspense fallback={<MeasurementPlot data={filtered} metric={metric} mode={mode} />}><ChartDepth data={filtered} metric={metric} mode={mode} /></Suspense> : <MeasurementPlot data={filtered} metric={metric} mode={mode} />}
        </motion.div>
        <div className="overview-chart-footer"><span>{records.length ? `${filtered.length} lần ghi nhận · Khoảng đến ${new Date(records[records.length - 1].timestamp).toLocaleDateString('vi-VN')}` : 'Ghi nhận chỉ số để bắt đầu theo dõi.'}</span><button type="button" onClick={() => action('analytics')}>Toàn bộ lịch sử <FaArrowRight /></button></div>
      </article>

      <aside className="overview-care-rail">
        <article className="overview-appointment"><div className="overview-rail-heading"><span className="overview-rail-icon"><FaCalendarCheck /></span><span>Lịch hẹn tiếp theo</span></div>
          {nextAppointment ? <><div className="overview-appointment-date"><strong>{new Date(nextAppointment.appointmentDate).getDate()}</strong><div><span>{new Date(nextAppointment.appointmentDate).toLocaleDateString('vi-VN',{month:'long',year:'numeric'})}</span><time>{formatTime(nextAppointment.appointmentDate)}</time></div></div><h3>{nextAppointment.doctorId?.fullName || nextAppointment.doctorId?.username || 'Bác sĩ phụ trách'}</h3><p>{nextAppointment.type || 'Lịch khám'} · {appointmentStatusLabel(nextAppointment.status)}</p><AppointmentCountdown date={nextAppointment.appointmentDate} /></> : <div className="overview-appointment-empty"><h3>Chưa có lịch sắp tới</h3><p>Những cuộc hẹn với bác sĩ sẽ xuất hiện tại đây.</p><div className="overview-calendar-paper" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div></div>}
          <button className="overview-rail-link" type="button" onClick={() => action('appointments')}>Mở lịch hẹn <FaArrowRight /></button>
        </article>
        <article className="overview-care-plan"><span className="overview-rail-icon"><FaUtensils /></span><span className="overview-eyebrow">Dành cho bạn</span><h3>Chăm sóc từ<br />những việc nhỏ.</h3><p>{nutritionPlan ? 'Tiếp tục kế hoạch dinh dưỡng, vận động và chăm sóc của bạn.' : 'Chưa có kế hoạch cá nhân hóa. Mở mục chăm sóc để bắt đầu.'}</p><button className="overview-rail-link" type="button" onClick={() => action('care-plan')}>Kế hoạch chăm sóc <FaArrowRight /></button></article>
      </aside>
    </section>

    <section className="overview-insights" aria-labelledby="overview-insights-title"><div className="overview-assistant-intro"><span className="overview-assistant-icon"><FaRobot /></span><span className="overview-eyebrow">DOCTIS AI</span><h2 id="overview-insights-title">Hiểu chỉ số.<br />Chăm sóc tốt hơn.</h2><p>Nhận định từ lần ghi nhận gần nhất của bạn.</p><button type="button" onClick={() => action('ai')}>Trò chuyện với AI <FaArrowRight /></button></div><div className="overview-insight-list">{analysisData.length ? analysisData.map((item,index) => <div className="overview-insight" key={`${item.title}-${index}`}><span className="overview-insight-number">{String(index+1).padStart(2,'0')}</span><div><h3>{item.title}</h3><p>{item.description}</p></div><span className="overview-insight-symbol">{item.icon || <FaHeartbeat />}</span></div>) : <div className="overview-insight"><div><h3>Chưa đủ dữ liệu để phân tích</h3><p>Ghi nhận chỉ số để xem nội dung phù hợp.</p></div></div>}</div></section>

    <section className="overview-library" aria-labelledby="overview-library-title"><div className="overview-section-line"><h2 id="overview-library-title">Một chút kiến thức, mỗi ngày</h2><span>Tham khảo về đái tháo đường</span></div><div className="overview-library-grid">{KNOWLEDGE.map(([image,index,title,description]) => <article key={index}><div className="overview-library-image"><img src={image} alt="" loading="lazy" /><span>{index}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
  </div>;
}
