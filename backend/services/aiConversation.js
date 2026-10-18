const METRICS = ["glucose", "bmi", "height", "weight", "systolic", "diastolic", "heartRate"];
const PROFILE_FIELDS = ["age", "gender", "bloodType", "allergies", "medicalHistory", "chronicDiseases", "currentMedications"];
const RECORD_MODES = new Set(["latest", "highest", "lowest", "recent"]);

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().trim();
}

function requestedMetrics(text) {
  const metrics = [];
  if (/\b(duong huyet|duong mau|glucose|blood sugar)\b/.test(text)) metrics.push("glucose");
  if (/\b(bmi|chi so khoi co the)\b/.test(text)) metrics.push("bmi");
  if (/\b(chieu cao|height)\b/.test(text)) metrics.push("height");
  if (/\b(can nang|trong luong|weight)\b/.test(text)) metrics.push("weight");
  if (/\b(huyet ap|blood pressure)\b/.test(text)) metrics.push("systolic", "diastolic");
  else {
    if (/\btam thu\b/.test(text)) metrics.push("systolic");
    if (/\btam truong\b/.test(text)) metrics.push("diastolic");
  }
  if (/\b(nhip tim|heart rate|bpm)\b|\bmach\b(?!\s*mau)/.test(text)) metrics.push("heartRate");
  return metrics;
}

function metricTopic(metrics) {
  if (metrics.includes("systolic") || metrics.includes("diastolic")) return "bloodPressure";
  return metrics[0] || "general";
}

function requestedMode(text) {
  const highest = /\b(cao nhat|lon nhat|nhieu nhat|maximum|max)\b/.test(text);
  const lowest = /\b(thap nhat|nho nhat|it nhat|minimum|min)\b/.test(text);
  const latest = /\b(gan nhat|moi nhat|cuoi cung|lan cuoi)\b/.test(text);
  if ((highest && lowest) || (latest && (highest || lowest))) return {mode:"recent", explicit:true};
  if (highest) return {mode:"highest", explicit:true};
  if (lowest) return {mode:"lowest", explicit:true};
  if (latest) return {mode:"latest", explicit:true};
  if (/\b(lich su|cac lan|nhung lan|cac ban ghi|gan day|\d+ lan|tat ca chi so|toan bo chi so)\b/.test(text)) return {mode:"recent", explicit:true};
  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b(hom nay|hom qua|tuan truoc|thang truoc)\b/.test(text)) return {mode:"recent",explicit:true};
  return {mode:"latest", explicit:false};
}

function analyze(message) {
  const text = normalize(message);
  const socialText = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const social = /^(?:(?:xin )?chao|hello|hi|hey)(?: (?:ban|bac si|doctis|ai))?(?: nhe| nha| a| nhe a)?(?: (?:toi|minh) (?:quay lai|tro lai)(?: roi)?)?$/.test(socialText)
    || /^(?:(?:xin )?cam on(?: (?:ban|bac si|doctis))?(?: rat nhieu| nhieu)?|thank you(?: (?:ban|doctis))?|thanks(?: (?:ban|doctis))?|tam biet|ok|okay)(?: nhe| nha| a| nhe a)?$/.test(socialText);
  const metrics = requestedMetrics(text);
  const mode = requestedMode(text);
  const self = /\b(toi|minh|cua em|cua chau)\b/.test(text);
  const thirdParty = /\b(?:(?:me|bo|ba|ong|con|ban|vo|chong)(?: cua)? (?:toi|minh|em|chau)|nguoi nha|(?:cho|ve|cua) (?:me|bo|ba|ong|con|vo|chong))\b/.test(text);
  const nutrition = /\b(an|bua an|bua toi|thuc don|dinh duong|calo|carbohydrate|tinh bot|nutrition|diet)\b/.test(text);
  const medication = /\b(thuoc|insulin|metformin|duoc si|medication)\b/.test(text);
  const activity = /\b(van dong|tap the duc|di bo|the thao|luyen tap)\b/.test(text);
  const allergy = /\b(di ung|allerg)/.test(text);
  const profile = /\b(ho so|tien su|benh nen|tuoi|nhom mau|gioi tinh)\b/.test(text);
  const education = /\b(la gi|dinh nghia|co nghia|nguyen nhan|tai sao|vi sao|thong thuong|khac nhau|bao nhieu la)\b/.test(text);
  const hardSaved = /\b(da luu|duoc luu|ho so|da nhap|ban ghi|lich su|gan nhat|moi nhat|lan do|cao nhat|thap nhat|lon nhat|nho nhat)\b/.test(text);
  const freshTime = /\b(dang|vua|moi do|bay gio|hien tai|hom nay|sang nay)\b/.test(text);
  const freshReading = freshTime && /\d/.test(text) && metrics.length > 0;
  const saved = hardSaved || (/\bda do\b/.test(text) && !freshReading);
  const symptomWords = /\b(chong mat|choang|ngat|dau dau|met moi|buon non|run tay|va mo hoi|te bi|cam thay|dang bi|toi bi|minh bi)\b/.test(text)
    || /\b(huyet ap|duong huyet|nhip tim)\b.*\b(thap|cao|nhanh|cham)\b/.test(text);
  const symptomStatement = /\b(?:toi|minh|me toi|bo toi|ba toi|con toi)\s+(?:dang\s+)?(?:bi|cam thay|thay)\b/.test(text);
  const historicalExtreme = hardSaved && /\b(cao nhat|thap nhat|lon nhat|nho nhat)\b/.test(text) && !symptomStatement;
  const currentSymptoms = !historicalExtreme && (!education || symptomStatement) && (freshReading || ((self || thirdParty || freshTime || symptomWords) && symptomWords)) && (!saved || freshTime);
  const medicationTiming = medication && /\b(?:uong|dung)\b.*\b(?:bua an|luc doi|truoc an|sau an|cung)\b/.test(text);
  let topic = medicationTiming ? "medication" : nutrition ? "nutrition" : medication ? "medication" : activity ? "activity" : allergy ? "allergies" : metrics.length ? metricTopic(metrics) : profile ? "profile" : currentSymptoms ? "symptoms" : "general";
  const personalValue = self && metrics.length > 0 && !education && !currentSymptoms && !nutrition && !medication && !activity
    && (/\b(bao nhieu|ket qua|chi so|cua toi|cua minh)\b/.test(text));
  const personalProfileLookup = self && (profile || allergy) && /\b(gi|nao|bao nhieu|cua toi|cua minh|da luu|ho so)\b/.test(text) && !currentSymptoms && !nutrition && !activity && !freshTime;
  const personalAllergyLookup = personalProfileLookup && allergy;
  const relativeDay = /\bhom qua\b/.test(text) ? "yesterday" : /\b(hom nay|sang nay)\b/.test(text) ? "today" : null;
  const relativeValue = relativeDay && metrics.length > 0 && /\b(bao nhieu|gia tri|chi so|ket qua|da do|da luu)\b/.test(text) && !currentSymptoms;
  let kind = social ? "social" : saved || personalValue || personalProfileLookup || relativeValue ? "records" : "conversation";
  if(thirdParty && !social) kind="conversation";
  const fields = [];
  if (!social && !thirdParty) {
    if (kind === "records" && profile && !metrics.length) {
      if (/\bho so\b/.test(text) && !allergy && !medication && !/\b(tien su|benh nen|tuoi|nhom mau|gioi tinh)\b/.test(text)) fields.push(...PROFILE_FIELDS);
      else {
        if (/\btuoi\b/.test(text)) fields.push("age");
        if (/\bgioi tinh\b/.test(text)) fields.push("gender");
        if (/\bnhom mau\b/.test(text)) fields.push("bloodType");
        if (/\btien su\b/.test(text)) fields.push("medicalHistory");
        if (/\bbenh nen\b/.test(text)) fields.push("chronicDiseases");
        if (allergy) fields.push("allergies");
        if (medication) fields.push("currentMedications");
      }
    } else if (self && (nutrition || medication || activity || currentSymptoms)) {
      fields.push("chronicDiseases", "currentMedications");
      if (nutrition || medication || allergy) fields.push("allergies");
      if (activity) fields.push("age");
    }
    if (saved && allergy) fields.push("allergies");
    if (personalAllergyLookup) fields.push("allergies");
    if (saved && medication) fields.push("currentMedications");
  }
  let selectedMetrics = metrics;
  if (kind === "records" && !selectedMetrics.length && /\b(chi so|lan do|ban ghi)\b/.test(text) && (!fields.length || /\b(tat ca|toan bo|chi so)\b/.test(text))) selectedMetrics = [...METRICS];
  const followup = /^(?:con|the con|vay con|va)\b/.test(text) || /\b(ngay do|ngay nao|hom nao|luc nao|khi nao|chi so do|con so do|lan do do|vay thi|vay toi nen lam gi|the toi nen lam gi|co cao khong|co thap khong|co on khong|co nguy hiem khong)\b/.test(text) || (mode.explicit && !metrics.length && !profile);
  const explicitNewTopic = nutrition || medication || activity || currentSymptoms || education || (metrics.length > 0 && !/^(?:con|the con|vay con|va)\b/.test(text));
  return {
    plan:{kind,needsPatientContext:kind !== "social" && !thirdParty && (selectedMetrics.length > 0 && kind === "records" || fields.length > 0),metrics:kind === "records" && !thirdParty ? selectedMetrics : [],recordMode:relativeDay && kind === "records" && !mode.explicit ? "recent" : mode.mode,profileFields:[...new Set(fields)],topic:social ? "social" : topic,currentSymptoms,thirdParty,relativeDay},
    followup, explicitNewTopic, explicitMode:mode.explicit, requestedProfileFields:allergy ? ["allergies"] : [],thirdParty,
  };
}

function previousRecordTopic(history) {
  const users = (Array.isArray(history) ? history : []).filter(item => item?.role === "user" && typeof item.content === "string").slice(-10);
  let resolved = null;
  for (const user of users) {
    const previous = analyze(user.content);
    if (previous.thirdParty) resolved = null;
    else if (previous.plan.kind === "records" && (previous.plan.metrics.length || previous.plan.profileFields.length)) resolved = previous.plan;
    else if (previous.plan.kind === "social" || previous.explicitNewTopic || !previous.followup) resolved = null;
    else if (resolved && previous.followup) {
      const metrics = requestedMetrics(normalize(user.content));
      const fields = previous.requestedProfileFields;
      resolved = {...resolved,metrics:fields.length ? [] : metrics.length ? metrics : resolved.metrics,profileFields:fields.length ? fields : [],topic:fields.length ? previous.plan.topic : metrics.length ? metricTopic(metrics) : resolved.topic,recordMode:previous.explicitMode ? previous.plan.recordMode : resolved.recordMode};
    }
  }
  return resolved;
}

function planConversation(message, history) {
  const current = analyze(message);
  if (current.plan.kind === "social") return current.plan;
  if (current.thirdParty) return {...current.plan,kind:"conversation",needsPatientContext:false,metrics:[],profileFields:[]};
  if ((current.plan.kind !== "records" || !current.plan.metrics.length) && current.followup && !current.explicitNewTopic) {
    const previous = previousRecordTopic(history);
    const metrics=requestedMetrics(normalize(message));
    const fields=current.requestedProfileFields;
    if (previous) return {...current.plan,kind:"records",needsPatientContext:true,metrics:fields.length ? [] : metrics.length ? metrics : previous.metrics,profileFields:fields.length ? fields : previous.profileFields,recordMode:current.explicitMode || current.plan.relativeDay ? current.plan.recordMode : previous.recordMode,topic:fields.length ? current.plan.topic : metrics.length ? metricTopic(metrics) : previous.topic};
  }
  return current.plan;
}

function selectPatientContext(context, plan = {}, now = new Date()) {
  if(plan.kind === "social" || plan.thirdParty) return {profile:{},measurements:[]};
  const profile = {};
  const fields = Array.isArray(plan.profileFields) ? plan.profileFields : [];
  fields.filter(field => PROFILE_FIELDS.includes(field)).forEach(field => {
    const value = context?.profile?.[field];
    if (field === "age" && typeof value === "number" && Number.isFinite(value) && value >= 0) profile.age = value;
    else if (typeof value === "string" && value.trim()) profile[field] = value.trim().slice(0,500);
  });
  const metrics = [...new Set((Array.isArray(plan.metrics) ? plan.metrics : []).filter(field => METRICS.includes(field)))];
  if (plan.kind !== "records" || !metrics.length) return {profile,measurements:[]};
  const source = (Array.isArray(context?.measurements) ? context.measurements : []).slice(0,7);
  const valid = (record,field) => typeof record?.[field] === "number" && Number.isFinite(record[field]) && record[field] > 0;
  let rows = source.map((record,index) => {
    const timestamp=record?.recordedAt;
    const date = new Date(timestamp instanceof Date || typeof timestamp === "string" && timestamp.trim() ? timestamp : NaN);
    return {record,index,time:date.getTime(),recordedAt:Number.isFinite(date.getTime()) ? date.toISOString() : null};
  }).filter(row=>row.recordedAt).sort((a,b)=>b.time-a.time || a.index-b.index);
  const allDatedRows = rows;
  let requestedDate = null;
  if (plan.relativeDay && Number.isFinite(now.getTime())) {
    // Calendar dates in Vietnam (UTC+7), including the UTC midnight boundary.
    requestedDate = new Date(now.getTime()+7*60*60*1000-(plan.relativeDay === "yesterday" ? 86400000 : 0)).toISOString().slice(0,10);
    rows = rows.filter(row=>new Date(row.time+7*60*60*1000).toISOString().slice(0,10) === requestedDate);
  }
  const mode = RECORD_MODES.has(plan.recordMode) ? plan.recordMode : "latest";
  const selected = new Map();
  const add = (row,keys) => {
    if (!row) return;
    const result = selected.get(row.index) || {recordedAt:row.recordedAt};
    keys.forEach(key=>{if(valid(row.record,key)) result[key]=row.record[key];});
    if(Object.keys(result).length>1) selected.set(row.index,result);
  };
  const pressurePair = metrics.includes("systolic") && metrics.includes("diastolic");
  const operationApplied = !["highest","lowest"].includes(mode) || metrics.length === 1;
  if (mode === "recent" || !operationApplied) rows.forEach(row=>add(row,metrics));
  else if (mode === "highest" || mode === "lowest") {
    const key=metrics[0];
    const matches=rows.filter(row=>valid(row.record,key));
    const chosen=matches.reduce((best,row)=>!best || (mode === "highest" ? row.record[key]>best.record[key] : row.record[key]<best.record[key]) ? row : best,null);
    add(chosen,[key]);
  } else {
    if(pressurePair) add(rows.find(row=>valid(row.record,"systolic") && valid(row.record,"diastolic")) || rows.find(row=>valid(row.record,"systolic") || valid(row.record,"diastolic")),["systolic","diastolic"]);
    metrics.filter(key=>!pressurePair || !["systolic","diastolic"].includes(key)).forEach(key=>add(rows.find(row=>valid(row.record,key)),[key]));
  }
  const measurements=[...selected.values()].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt));
  return {profile,measurements,recordScope:{basis:"latest_7_saved_records",windowCount:source.length,validDatedRecords:allDatedRows.length,selection:mode,operationApplied,requestedMetrics:metrics,selectedRecords:measurements.length,from:allDatedRows.at(-1)?.recordedAt || null,to:allDatedRows[0]?.recordedAt || null,...(requestedDate ? {requestedDate,timeZone:"Asia/Ho_Chi_Minh"} : {}),missingMetrics:metrics.filter(key=>!measurements.some(record=>valid(record,key))),...(pressurePair && !rows.some(row=>valid(row.record,"systolic") && valid(row.record,"diastolic")) ? {incompleteBloodPressure:true} : {})}};
}

module.exports = {planConversation,selectPatientContext};
