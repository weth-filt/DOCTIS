const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('node:http');
const crypto = require('node:crypto');
const User = require('../models/User');
const Health = require('../models/Health');

test('isolated HTTP: health ownership, missing ML feature, rule/model separation, service location guard and scheduler secret', { skip: process.env.DOCTIS_PUBLIC_HTTP_TEST !== '1', timeout: 20000 }, async () => {
  // This URI is fixed so the suite cannot target Atlas even by environment mistake.
  await mongoose.connect('mongodb://127.0.0.1:27028/doctis_public_e2e?replicaSet=doctis-local-review', { serverSelectionTimeoutMS: 3000 });
  const patientId = new mongoose.Types.ObjectId(), otherId = new mongoose.Types.ObjectId();
  const beforeEnv = Object.fromEntries(['JWT_SECRET','AI_SERVICE_URL','CRON_SECRET'].map(key => [key, process.env[key]]));
  let server, modelServer, calls=0;
  try {
    modelServer = await new Promise(resolve => { const value=http.createServer((req,res) => { calls++; req.resume(); res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({prediction:'TEST_ML_LABEL',riskLevel:'Nguy hiểm',recommendation:'External model response stub for local automated test only.'})); }).listen(0,'127.0.0.1',()=>resolve(value)); });
    process.env.AI_SERVICE_URL=`http://127.0.0.1:${modelServer.address().port}`;
    process.env.JWT_SECRET=crypto.randomBytes(40).toString('hex');
    delete process.env.CRON_SECRET;
    await Promise.all([User.init(),Health.init()]);
    await User.insertMany([patientId,otherId].map((id,index)=>({_id:id,cccd:`http-health-${id}`,username:`http-health-${id}`,email:`http-health-${id}@example.test`,password:'isolated-fixture-not-a-login',role:'user',address:index?'':'legacy address',ward:'legacy ward',province:'legacy city'})));
    const token=jwt.sign({id:String(patientId),role:'user'},process.env.JWT_SECRET);
    const app=require('../app');
    server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
    const request=async(route,{method='GET',body,auth=true,authorization}={})=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}${route}`,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:authorization||`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    };
    assert.equal((await request('/api/health/add',{method:'POST',auth:false,body:{height:175,weight:70}})).status,401);
    const missing=await request('/api/health/add',{method:'POST',body:{height:175,weight:70,userId:String(otherId)}});
    assert.equal(missing.status,201); assert.equal(missing.body.userId,String(patientId)); assert.equal(missing.body.glucose,null); assert.equal(missing.body.predictionStatus,'insufficient_data'); assert.equal(calls,0);
    const measured=await request('/api/health/add',{method:'POST',body:{height:175,weight:70,glucose:94,risk:'Nguy hiểm',prediction:'FORGED'}});
    assert.equal(measured.status,201); assert.equal(measured.body.risk,'Ổn định'); assert.equal(measured.body.prediction,'TEST_ML_LABEL'); assert.equal(measured.body.riskSource,'monitoring-rule'); assert.equal(calls,1);
    const history=await request(`/api/health/history?userId=${otherId}`); assert.equal(history.status,200); assert.equal(history.body.length,2); assert.ok(history.body.every(row=>row.userId===String(patientId)));
    const changed=await request('/api/profile',{method:'PUT',body:{province:'outside-city',ward:'unverified',address:'changed'}}); assert.equal(changed.status,409);
    const clinical=await request('/api/profile',{method:'PUT',body:{medicalHistory:'Isolated clinical form regression',chronicDiseases:'Fixture test text',address:'legacy address',province:'legacy city',ward:'legacy ward'}});
    assert.equal(clinical.status,200); assert.equal(clinical.body.profile.medicalHistory,'Isolated clinical form regression'); assert.equal(clinical.body.profile.address,'legacy address');
    assert.equal((await request('/api/internal/scheduler/reminders',{method:'POST',auth:false})).status,503);
    process.env.CRON_SECRET=crypto.randomBytes(32).toString('hex');
    assert.equal((await request('/api/internal/scheduler/reminders',{method:'POST',authorization:'Bearer invalid'})).status,401);
    assert.equal((await request('/api/internal/scheduler/reminders',{method:'POST',authorization:`Bearer ${process.env.CRON_SECRET}`})).status,200);
    assert.equal(await Health.countDocuments({userId:otherId}),0);
  } finally {
    for (const instance of [server,modelServer]) if(instance){instance.closeAllConnections();await new Promise(resolve=>instance.close(resolve));}
    await Health.deleteMany({userId:{$in:[patientId,otherId]}});
    await User.deleteMany({_id:{$in:[patientId,otherId]}});
    await mongoose.disconnect();
    for(const [key,value] of Object.entries(beforeEnv)) if(value===undefined) delete process.env[key]; else process.env[key]=value;
  }
});
