import { fireEvent, render, screen } from '@testing-library/react';
import PatientOverview from './PatientOverview';

jest.mock('./DashboardCareArtwork', () => () => <div aria-label="Healthcare artwork" />);
jest.mock('./DashboardChart', () => ({
  HEALTH_METRICS:[{key:'glucose',label:'Đường huyết',unit:'mg/dL',lines:[{key:'glucose'}]},{key:'pressure',label:'Huyết áp',unit:'mmHg',lines:[{key:'systolic'},{key:'diastolic'}]}],
  MeasurementPlot: ({data,metric,mode}) => <div data-testid="plot">{metric.key}:{mode}:{data.length}</div>,
}));

const records = [{_id:'a',createdAt:'2026-09-01T08:00:00Z',glucose:100,systolic:120,diastolic:80},{_id:'b',createdAt:'2026-09-18T13:29:00Z',glucose:94,systolic:134,diastolic:72}];
function show() {
  const navigate=jest.fn();
  render(<PatientOverview displayName="Patient" latest={records[1]} data={records} risk={{label:'Existing assessment'}} analysisData={[]} nextAppointment={null} nutritionPlan={null} loading={false} error={false} navigate={navigate} formatDate={x=>x} formatTime={x=>x} appointmentStatusLabel={x=>x} />);
  return navigate;
}
test('overview filters actual records and changes axis without altering data', () => {
  const original=JSON.stringify(records);
  show();
  expect(screen.getByTestId('plot').textContent).toBe('glucose:readings:2');
  fireEvent.change(screen.getByLabelText('Khoảng dữ liệu'),{target:{value:'7'}});
  expect(screen.getByTestId('plot').textContent).toBe('glucose:readings:1');
  fireEvent.change(screen.getByLabelText('Trục biểu đồ'),{target:{value:'time'}});
  fireEvent.click(screen.getByRole('button',{name:'Xem biểu đồ Huyết áp'}));
  expect(screen.getByTestId('plot').textContent).toBe('pressure:time:1');
  expect(JSON.stringify(records)).toBe(original);
});
test('overview actions navigate existing functions and display existing assessment', () => {
  const navigate=show();
  fireEvent.click(screen.getByRole('button',{name:'Ghi nhận chỉ số'}));
  expect(navigate).toHaveBeenCalledWith('health');
  fireEvent.click(screen.getByRole('button',{name:'Kế hoạch chăm sóc'}));
  expect(navigate).toHaveBeenCalledWith('care-plan');
  expect(screen.getByText('Existing assessment')).toBeTruthy();
});
