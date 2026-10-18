import { careDaysToWeek, weekToCareDays, careSnapshotChanged, vietnamDay } from "./savedCarePlan";
test("hydrates completion and dates without regenerating the schedule", () => {
  const days=[{dayIndex:0,label:"Thứ 2",date:"2026-10-19",items:[{id:"meal",type:"MEAL",title:"Bữa sáng",description:"Đã lưu",done:true,completedAt:"2026-10-19T00:00:00Z"},{id:"exercise",type:"EXERCISE",title:"Đi bộ",description:"20 phút",done:false}]}];
  const week=careDaysToWeek(days);
  expect(week[0].meals[0].done).toBe(true);
  expect(week[0].meals[0].completedAt).toBe(days[0].items[0].completedAt);
  expect(week[0].exercise.duration).toBe("20 phút");
  expect(week[0].date).toBe("2026-10-19");
  expect(days[0].items[0].description).toBe("Đã lưu");
});
test("new generation serializes items and starts fresh completion", () => {
  const days=weekToCareDays([{label:"Ngày 1",meals:[{id:"meal",label:"Bữa sáng",text:"Nội dung",time:"07:00",done:true}],exercise:{id:"ex",title:"Đi bộ",duration:"20 phút",time:"16:00"}}]);
  expect(days[0].items[0]).toMatchObject({type:"MEAL",title:"Bữa sáng",description:"Nội dung",done:false});
  expect(days[0].items[1]).toMatchObject({type:"EXERCISE",description:"20 phút"});
});
test("health changes only suggest refreshing; missing values do not act as zero", () => {
  const snapshot={health:{glucose:100,bmi:22,systolic:120},profile:{allergies:"Không có"}};
  expect(careSnapshotChanged(snapshot,{glucose:105,bmi:22.1},{})).toBe(false);
  expect(careSnapshotChanged(snapshot,{glucose:125},{})).toBe(true);
  expect(careSnapshotChanged(snapshot,{},{})).toBe(false);
  expect(careSnapshotChanged(snapshot,{}, {allergies:"Trứng"})).toBe(true);
});
test("uses the Vietnam calendar date around midnight",()=>expect(vietnamDay(new Date("2026-10-18T18:00:00Z"))).toBe("2026-10-19"));
