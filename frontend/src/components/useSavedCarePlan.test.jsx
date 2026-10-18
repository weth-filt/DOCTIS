import { act, renderHook, waitFor } from "@testing-library/react";
import useSavedCarePlan from "./useSavedCarePlan";
import API from "../services/api";
jest.mock("../services/api",()=>({__esModule:true,default:{get:jest.fn(),post:jest.fn(),patch:jest.fn()}}));
const stored=()=>({_id:"plan",revision:0,days:[{dayIndex:0,label:"Ngày 1",items:[{id:"meal",done:false}]}]});
beforeEach(()=>jest.clearAllMocks());
test("loads saved plans on re-entry without creating them",async()=>{
  API.get.mockResolvedValue({data:stored()});
  const first=renderHook(()=>useSavedCarePlan());
  await waitFor(()=>expect(first.result.current.ready).toBe(true));
  expect(first.result.current.plan._id).toBe("plan");
  first.unmount();
  const next=renderHook(()=>useSavedCarePlan());
  await waitFor(()=>expect(next.result.current.plan?._id).toBe("plan"));
  expect(API.post).not.toHaveBeenCalled();
});
test("optimistic completion rolls back on API failure",async()=>{
  API.get.mockResolvedValue({data:stored()});
  let reject;API.patch.mockImplementation(()=>new Promise((_,r)=>{reject=r;}));
  const {result}=renderHook(()=>useSavedCarePlan());
  await waitFor(()=>expect(result.current.ready).toBe(true));
  let task;act(()=>{task=result.current.toggle(0,"meal");});
  expect(result.current.plan.days[0].items[0].done).toBe(true);
  expect(API.patch).toHaveBeenCalledWith("/care-plans/items/meal",{planId:"plan",dayIndex:0,done:true,expectedRevision:0});
  await act(async()=>{reject(new Error("offline"));await task;});
  expect(result.current.plan.days[0].items[0].done).toBe(false);
  expect(result.current.error).toContain("hoàn tác");
});
test("failed load cannot accidentally create a replacement",async()=>{
  API.get.mockRejectedValue(new Error("offline"));
  const {result}=renderHook(()=>useSavedCarePlan());
  await waitFor(()=>expect(result.current.loading).toBe(false));
  await act(async()=>{await result.current.create([]);});
  expect(result.current.ready).toBe(false);expect(API.post).not.toHaveBeenCalled();
});
test("a missing API route is not mistaken for an empty saved plan",async()=>{
  API.get.mockRejectedValue({response:{status:404,data:{msg:"API endpoint không tồn tại"}}});
  const {result}=renderHook(()=>useSavedCarePlan());
  await waitFor(()=>expect(result.current.loading).toBe(false));
  expect(result.current.ready).toBe(false);
  await act(async()=>{await result.current.create([]);});
  expect(API.post).not.toHaveBeenCalled();
});
