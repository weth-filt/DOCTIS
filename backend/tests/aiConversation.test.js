const test=require("node:test");
const assert=require("node:assert/strict");
const {planConversation,selectPatientContext}=require("../services/aiConversation");

test("historical extrema with 'đang có' wording are still saved-data queries", () => {
  const plan = planConversation("Đường huyết cao nhất trong các bản ghi bạn đang có là bao nhiêu?", []);
  assert.equal(plan.kind, "records");
  assert.equal(plan.recordMode, "highest");
  assert.equal(plan.currentSymptoms, false);
});

test("medication meal timing is not confused with a request for dinner ideas", () => {
  assert.equal(planConversation("Thuốc này uống cùng bữa ăn hay lúc đói?", []).topic, "medication");
  assert.equal(planConversation("Gợi ý bữa tối khi dùng metformin", []).topic, "nutrition");
});

const recordHistory=[{role:"user",content:"Đường huyết gần nhất đã lưu của tôi là bao nhiêu?"},{role:"assistant",content:"A previous generated answer is not a source of clinical facts."}];
const row=(day,values)=>({recordedAt:`2026-10-${day}T05:00:00.000Z`,...values});

test("explicit third-party follow-ups cannot inherit signed-in patient's context",()=>{
  for(const question of ["Thế còn của mẹ tôi?","Thế còn huyết áp của mẹ tôi?","Tôi muốn hỏi cho mẹ: mẹ nên ăn gì?","Tôi muốn hỏi về dinh dưỡng cho con"]){
    const plan=planConversation(question,recordHistory);
    assert.equal(plan.needsPatientContext,false,question);
    assert.deepEqual(plan.metrics,[]);
    assert.deepEqual(selectPatientContext({profile:{allergies:"Private"},measurements:[row(18,{glucose:100})]},plan),{profile:{},measurements:[]});
  }
});

test("ordinary personal profile questions select the saved field despite 'là gì' wording",()=>{
  for(const [question,field] of [["Bệnh nền của tôi là gì?","chronicDiseases"],["Tiền sử bệnh của tôi?","medicalHistory"],["Nhóm máu của tôi là gì?","bloodType"],["Tuổi của tôi bao nhiêu?","age"],["Dị ứng của tôi là gì?","allergies"]]){
    const plan=planConversation(question,[]);
    assert.equal(plan.kind,"records",question);
    assert.equal(plan.needsPatientContext,true,question);
    assert.ok(plan.profileFields.includes(field),question);
  }
  assert.equal(planConversation("Dị ứng là gì?",[]).needsPatientContext,false);
});

test("today/yesterday select Vietnam calendar dates and do not silently return older values",()=>{
  const now=new Date("2026-10-17T18:00:00.000Z"); // 01:00 on Oct 18 in Vietnam.
  const context={measurements:[{recordedAt:"2026-10-17T18:00:00.000Z",glucose:101},{recordedAt:"2026-10-17T15:00:00.000Z",glucose:102},{recordedAt:"2026-09-18T08:00:00.000Z",glucose:103}]};
  const today=selectPatientContext(context,planConversation("Đường huyết hôm nay đã lưu bao nhiêu?",[]),now);
  assert.equal(today.recordScope.requestedDate,"2026-10-18");
  assert.deepEqual(today.measurements.map(item=>item.glucose),[101]);
  const yesterday=selectPatientContext(context,planConversation("Đường huyết hôm qua đã lưu bao nhiêu?",[]),now);
  assert.equal(yesterday.recordScope.requestedDate,"2026-10-17");
  assert.deepEqual(yesterday.measurements.map(item=>item.glucose),[102]);
  const empty=selectPatientContext({measurements:[context.measurements[2]]},planConversation("Đường huyết hôm nay đã lưu bao nhiêu?",[]),now);
  assert.deepEqual(empty.measurements,[]);
});

test("exact social messages never need saved data even after a record discussion",()=>{
  for(const message of ["hello","hello bạn","Hello DOCTIS!","xin chào bạn ạ","chào bạn, tôi quay lại rồi","Cảm ơn bạn rất nhiều","thanks bạn"]){
    const plan=planConversation(message,recordHistory);
    assert.equal(plan.kind,"social",message);
    assert.equal(plan.needsPatientContext,false,message);
    assert.deepEqual(plan.metrics,[]);
    assert.deepEqual(plan.profileFields,[]);
  }
  assert.notEqual(planConversation("Hello bạn, tôi đang bị huyết áp thấp",recordHistory).kind,"social");
});

test("current low pressure overrides possessive wording and historical glucose",()=>{
  const plan=planConversation("Tôi đang bị huyết áp thấp",recordHistory);
  assert.equal(plan.kind,"conversation");
  assert.equal(plan.topic,"bloodPressure");
  assert.equal(plan.currentSymptoms,true);
  assert.deepEqual(plan.metrics,[]);
  assert.deepEqual(plan.profileFields,["chronicDiseases","currentMedications"]);
  const selected=selectPatientContext({profile:{chronicDiseases:"Saved condition",currentMedications:"Saved medication"},measurements:[row(20,{glucose:94,systolic:120,diastolic:80})]},plan);
  assert.deepEqual(selected.measurements,[]);
  assert.ok(!JSON.stringify(selected).includes("120"));
});

test("general education does not ask for saved numbers",()=>{
  for(const message of ["Huyết áp thấp là gì?","Tại sao đường huyết tăng?","BMI nghĩa là gì?","Insulin có tác dụng gì?"]){
    const plan=planConversation(message,recordHistory);
    assert.equal(plan.kind,"conversation",message);
    assert.equal(plan.needsPatientContext,false,message);
    assert.deepEqual(plan.metrics,[]);
  }
});

test("a personal current symptom remains current even when asking its cause",()=>{
  const plan=planConversation("Tại sao tôi đang bị huyết áp thấp?",recordHistory);
  assert.equal(plan.kind,"conversation");
  assert.equal(plan.currentSymptoms,true);
  assert.deepEqual(plan.metrics,[]);
});

test("a new personal nutrition question overrides the previous metric",()=>{
  const plan=planConversation("Vậy tôi ăn gì?",recordHistory);
  assert.equal(plan.kind,"conversation");
  assert.equal(plan.topic,"nutrition");
  assert.equal(plan.needsPatientContext,true);
  assert.deepEqual(plan.metrics,[]);
  assert.ok(plan.profileFields.includes("allergies"));
});

test("a freshly reported reading is not silently replaced by a saved reading",()=>{
  const plan=planConversation("Tôi vừa đo huyết áp 90/60",recordHistory);
  assert.equal(plan.kind,"conversation");
  assert.equal(plan.currentSymptoms,true);
  assert.deepEqual(plan.metrics,[]);
});

test("questions about another person do not select the signed-in patient's records",()=>{
  const plan=planConversation("Huyết áp đã lưu của mẹ tôi bao nhiêu?",recordHistory);
  assert.equal(plan.kind,"conversation");
  assert.equal(plan.needsPatientContext,false);
  assert.deepEqual(plan.metrics,[]);
  assert.deepEqual(plan.profileFields,[]);
});

test("a date follow-up inherits the latest user record topic but not assistant numbers",()=>{
  const plan=planConversation("Ngày đo?",recordHistory);
  assert.equal(plan.kind,"records");
  assert.deepEqual(plan.metrics,["glucose"]);
  assert.equal(plan.recordMode,"latest");
  const ungrounded=planConversation("Ngày đo?",[{role:"assistant",content:"Glucose 999 đã lưu hôm qua."}]);
  assert.equal(ungrounded.needsPatientContext,false);
});

test("metric-switch follow-ups survive a subsequent date follow-up",()=>{
  const pressure=planConversation("Còn huyết áp?",recordHistory);
  assert.equal(pressure.kind,"records");
  assert.deepEqual(pressure.metrics,["systolic","diastolic"]);
  const date=planConversation("Ngày đo?",[...recordHistory,{role:"user",content:"Còn huyết áp?"},{role:"assistant",content:"Prior answer"}]);
  assert.deepEqual(date.metrics,["systolic","diastolic"]);
  assert.equal(date.topic,"bloodPressure");
});

test("an explicit topic change prevents an older record topic resurfacing",()=>{
  const plan=planConversation("Ngày đo?",[...recordHistory,{role:"user",content:"Tôi muốn hỏi về bữa ăn tối"},{role:"assistant",content:"Nutrition answer"}]);
  assert.equal(plan.needsPatientContext,false);
  assert.deepEqual(plan.metrics,[]);
});

test("latest and extrema are distinct and multiple operations retain the dated window",()=>{
  assert.equal(planConversation("Đường huyết gần nhất đã lưu?").recordMode,"latest");
  assert.equal(planConversation("Đường huyết cao nhất đã lưu?").recordMode,"highest");
  assert.equal(planConversation("Đường huyết thấp nhất đã lưu?").recordMode,"lowest");
  assert.equal(planConversation("Đường huyết gần nhất và cao nhất đã lưu?").recordMode,"recent");
  assert.equal(planConversation("Đường huyết cao nhất và thấp nhất?").recordMode,"recent");
  assert.equal(planConversation("Huyết áp thấp của tôi").kind,"conversation");
});

test("profile and all explicitly requested measurements can be selected together",()=>{
  const plan=planConversation("Cho tôi xem hồ sơ và tất cả chỉ số đã lưu");
  assert.equal(plan.kind,"records");
  assert.equal(plan.recordMode,"recent");
  assert.equal(plan.metrics.length,7);
  assert.ok(plan.profileFields.includes("chronicDiseases"));
});

test("personal allergy lookup and a profile follow-up select only allergies",()=>{
  const personal=planConversation("Tôi dị ứng gì?");
  assert.equal(personal.kind,"records");
  assert.deepEqual(personal.profileFields,["allergies"]);
  assert.deepEqual(personal.metrics,[]);
  const followup=planConversation("Còn dị ứng thì sao?",[{role:"user",content:"Cho tôi xem hồ sơ"},{role:"assistant",content:"Saved profile answer"}]);
  assert.equal(followup.kind,"records");
  assert.deepEqual(followup.profileFields,["allergies"]);
  assert.deepEqual(followup.metrics,[]);
});

test("latest glucose uses its newest valid dated value, not the newest unrelated row",()=>{
  const plan=planConversation("Đường huyết gần nhất đã lưu?");
  const context={measurements:[row(20,{heartRate:75}),row(18,{glucose:105}),row(19,{glucose:95,heartRate:80})]};
  const selected=selectPatientContext(context,plan);
  assert.deepEqual(selected.measurements,[row(19,{glucose:95})]);
  assert.equal(selected.recordScope.basis,"latest_7_saved_records");
  assert.equal(selected.recordScope.selection,"latest");
});

test("blood-pressure components always come from the same actual record",()=>{
  const plan=planConversation("Huyết áp gần nhất đã lưu?");
  const selected=selectPatientContext({measurements:[row(20,{systolic:125}),row(19,{systolic:120,diastolic:80}),row(18,{diastolic:75})]},plan);
  assert.deepEqual(selected.measurements,[row(19,{systolic:120,diastolic:80})]);
  const partial=selectPatientContext({measurements:[row(20,{systolic:125}),row(19,{diastolic:80})]},plan);
  assert.deepEqual(partial.measurements,[row(20,{systolic:125})]);
  assert.equal(partial.recordScope.incompleteBloodPressure,true);
});

test("each requested latest metric keeps its real timestamp",()=>{
  const plan=planConversation("Đường huyết và nhịp tim gần nhất đã lưu?");
  const selected=selectPatientContext({measurements:[row(20,{heartRate:75,systolic:120}),row(19,{glucose:95,heartRate:80})]},plan);
  assert.deepEqual(selected.measurements,[row(20,{heartRate:75}),row(19,{glucose:95})]);
});

test("highest and lowest use actual valid values and disclose the seven-record window",()=>{
  const context={measurements:[row(20,{glucose:94}),row(19,{glucose:120}),row(18,{glucose:81}),row(17,{glucose:null})]};
  const highest=selectPatientContext(context,planConversation("Đường huyết cao nhất đã lưu?"));
  const lowest=selectPatientContext(context,planConversation("Đường huyết thấp nhất đã lưu?"));
  assert.deepEqual(highest.measurements,[row(19,{glucose:120})]);
  assert.deepEqual(lowest.measurements,[row(18,{glucose:81})]);
  assert.equal(highest.recordScope.windowCount,4);
  assert.equal(highest.recordScope.operationApplied,true);
  assert.equal(highest.recordScope.basis,"latest_7_saved_records");
});

test("ambiguous pressure extrema do not manufacture a max pair from different records",()=>{
  const selected=selectPatientContext({measurements:[row(20,{systolic:130,diastolic:70}),row(19,{systolic:120,diastolic:90})]},planConversation("Huyết áp cao nhất đã lưu?"));
  assert.equal(selected.recordScope.operationApplied,false);
  assert.deepEqual(selected.measurements,[row(20,{systolic:130,diastolic:70}),row(19,{systolic:120,diastolic:90})]);
});

test("missing, invalid and undated values never become zero or a made-up epoch date",()=>{
  const selected=selectPatientContext({measurements:[{recordedAt:null,glucose:999},row(20,{glucose:null}),row(19,{glucose:"94"}),row(18,{glucose:0}),row(17,{glucose:Infinity})]},planConversation("Đường huyết gần nhất đã lưu?"));
  assert.deepEqual(selected.measurements,[]);
  assert.deepEqual(selected.recordScope.missingMetrics,["glucose"]);
  assert.ok(!JSON.stringify(selected).includes("1970"));
});

test("selection keeps only allowed fields and never mutates source data",()=>{
  const context={profile:{age:40,allergies:"Saved allergy",email:"private@example.test",password:"private",fullName:"Private name"},measurements:[row(20,{glucose:94,systolic:120,userId:"private-user",_id:"private-record"})]};
  const before=JSON.stringify(context);
  const selected=selectPatientContext(context,{kind:"records",metrics:["glucose","userId"],profileFields:["allergies","password","email"],recordMode:"latest"});
  assert.deepEqual(selected.profile,{allergies:"Saved allergy"});
  assert.deepEqual(selected.measurements,[row(20,{glucose:94})]);
  assert.ok(!JSON.stringify(selected).includes("private"));
  assert.equal(JSON.stringify(context),before);
});

test("a missing context callback result is safe, and intentionally omitted measurements stay empty",()=>{
  const noData=selectPatientContext(undefined,planConversation("Đường huyết gần nhất đã lưu?"));
  assert.deepEqual(noData.profile,{});
  assert.deepEqual(noData.measurements,[]);
  const social=selectPatientContext({profile:{age:40},measurements:[row(20,{glucose:94})]},planConversation("hello bạn"));
  assert.deepEqual(social,{profile:{},measurements:[]});
});
