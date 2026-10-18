import { useCallback, useEffect, useRef, useState } from "react";
import API from "../services/api";
import { vietnamDay } from "../utils/savedCarePlan";

export default function useSavedCarePlan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingItem, setPendingItem] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const locked = useRef(false);
  const current = useRef(null);
  const alive = useRef(true);
  const loadVersion = useRef(0);
  const install = useCallback(value => { current.current = value; setPlan(value); }, []);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const isLatest = () => alive.current && version === loadVersion.current;
    setLoading(true); setError("");
    try { const {data} = await API.get("/care-plans/current"); if(isLatest()) { install(data);setReady(true); } }
    catch(err) { if(isLatest()) { if(err.response?.status === 404 && err.response?.data?.code === "NO_CURRENT_PLAN") {install(null);setReady(true);} else {setReady(false);setError("Chưa tải được kế hoạch đã lưu. Vui lòng thử lại trước khi tạo kế hoạch mới.");} } }
    finally { if(isLatest()) setLoading(false); }
  }, [install]);
  useEffect(() => { alive.current=true; load(); return () => {alive.current=false;loadVersion.current+=1;}; }, [load]);

  const create = async (days, basedOn) => {
    if(locked.current || loading || !ready) return false;
    locked.current=true; setSaving(true); setError(""); setNotice("");
    const previous=current.current;
    try {
      const {data} = await API.post("/care-plans/my", {days,startDate:vietnamDay(),...(basedOn ? {basedOn} : {}),...(previous ? {replacePlanId:previous._id,confirmReplace:true,expectedRevision:previous.revision || 0} : {})});
      if(alive.current) {install(data);setNotice("Đã lưu kế hoạch chăm sóc. Bạn có thể quay lại để tiếp tục theo dõi.");}
      return true;
    } catch(err) {
      if(alive.current) {setError(err.response?.data?.msg || "Chưa lưu được kế hoạch. Kế hoạch cũ vẫn được giữ nguyên."); if(err.response?.data?.currentPlan) install(err.response.data.currentPlan);}
      return false;
    } finally {locked.current=false;if(alive.current)setSaving(false);}
  };
  const toggle = async (dayIndex, itemId) => {
    if(locked.current || !current.current?._id) return;
    const before=current.current;
    const item=before.days?.find(d=>d.dayIndex===dayIndex)?.items.find(i=>i.id===itemId);
    if(!item) return;
    locked.current=true;setPendingItem(`${dayIndex}:${itemId}`);setError("");setNotice("");
    install({...before,days:before.days.map(d=>d.dayIndex!==dayIndex ? d : {...d,items:d.items.map(i=>i.id!==itemId ? i : {...i,done:!i.done,completedAt:!i.done ? new Date().toISOString() : null})})});
    try {
      const {data}=await API.patch(`/care-plans/items/${encodeURIComponent(itemId)}`, {planId:before._id,dayIndex,done:!item.done,expectedRevision:before.revision || 0});
      if(alive.current) {install(data);setNotice("Đã lưu tiến độ chăm sóc.");}
    } catch(err) {
      if(alive.current) {install(before);setError(err.response?.data?.msg || "Chưa lưu được tiến độ. Thao tác vừa rồi đã được hoàn tác.");}
      if(err.response?.status===409) {try {const {data}=await API.get("/care-plans/current");if(alive.current)install(data);}catch{/* Keep the known saved state and error visible. */}}
    } finally {locked.current=false;if(alive.current)setPendingItem("");}
  };
  const loadHistory=async()=> {
    setHistoryLoading(true);setError("");
    try {const {data}=await API.get("/care-plans/history");if(alive.current)setHistory(Array.isArray(data)?data:data.plans || []);}
    catch {if(alive.current)setError("Chưa tải được lịch sử kế hoạch. Vui lòng thử lại.");}
    finally {if(alive.current)setHistoryLoading(false);}
  };
  return {plan,loading,ready,saving,pendingItem,error,notice,history,historyLoading,load,create,toggle,loadHistory};
}
