import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceTabs, WorkspaceNotice } from './WorkspacePrimitives';

test('filters report selection without submitting a form', () => {
  const change = jest.fn();
  render(<WorkspaceTabs label="Roles" value="all" onChange={change} options={[{value:'all',label:'All',count:8},{value:'doctor',label:'Doctors',count:3}]} />);
  expect(screen.getByRole('button', {name:'All 8'}).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name:'Doctors 3'}));
  expect(change).toHaveBeenCalledWith('doctor');
  expect(screen.getByRole('button', {name:'Doctors 3'}).type).toBe('button');
});

test('API feedback keeps error and success semantics', () => {
  const close = jest.fn();
  const {rerender} = render(<WorkspaceNotice feedback={{type:'error',text:'Request failed'}} onClose={close} />);
  expect(screen.getByRole('alert').textContent).toContain('Request failed');
  fireEvent.click(screen.getByRole('button'));
  expect(close).toHaveBeenCalledTimes(1);
  rerender(<WorkspaceNotice feedback={{type:'success',text:'Saved'}} onClose={close} />);
  expect(screen.getByRole('status').textContent).toContain('Saved');
});
