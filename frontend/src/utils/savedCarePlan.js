export function careDaysToWeek(days = []) {
  return days.map(day => {
    const items = (day.items || []).map(item => ({ ...item, done: !!item.done }));
    return { ...day,
      meals: items.filter(i => i.type === "MEAL").map(i => ({...i,label:i.title,text:i.description,kind:"meal"})),
      medications: items.filter(i => i.type === "MEDICATION").map(i => ({...i,kind:"medication"})),
      exercise: items.filter(i => i.type === "EXERCISE").map(i => ({...i,duration:i.description,kind:"exercise"}))[0] || null,
    };
  });
}

export function weekToCareDays(week = []) {
  return week.map((day, dayIndex) => ({dayIndex,label:day.label || `Ngày ${dayIndex+1}`,items:[
    ...(day.meals || []).filter(i => i.text).map(i => ({...i,type:"MEAL",title:i.label,description:i.text})),
    ...(day.exercise ? [{...day.exercise,type:"EXERCISE",description:day.exercise.duration || ""}] : []),
    ...(day.medications || []).map(i => ({...i,type:"MEDICATION"})),
  ].map(i => ({id:i.id,type:i.type,time:i.time,title:i.title,description:i.description || "",done:false,source:i.source,prescriptionId:i.prescriptionId}))}));
}

export const vietnamDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);

// These are refresh suggestions, never diagnostic thresholds or a reason to
// alter medication. Changes only show a banner; the saved plan is untouched.
export function careSnapshotChanged(snapshot, latest, profile) {
  if (!snapshot) return false;
  const health = snapshot.health || {};
  const thresholds = {glucose:20,bmi:1,systolic:15,diastolic:10,heartRate:20,weight:3};
  if (Object.entries(thresholds).some(([key,delta]) => Number(latest?.[key]) > 0 && Number(health[key]) > 0 && Math.abs(Number(latest[key])-Number(health[key])) >= delta)) return true;
  return ["allergies","chronicDiseases"].some(key => typeof snapshot.profile?.[key] === "string" && typeof profile?.[key] === "string" && snapshot.profile[key].trim() !== profile[key].trim());
}
