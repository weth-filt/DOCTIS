import { fireEvent, render, screen } from '@testing-library/react';
import useWorkspaceDialog from './useWorkspaceDialog';

function Example({open, close}) {
  const ref = useWorkspaceDialog(open, close);
  return <><button>Trigger</button>{open && <div ref={ref} role="dialog" tabIndex={-1}><button>First</button><input aria-label="Name" /><button>Last</button></div>}</>;
}

test('dialog traps tab, handles escape and restores focus and scrolling', () => {
  const close = jest.fn();
  const {rerender} = render(<Example open={false} close={close} />);
  const trigger = screen.getByText('Trigger');
  trigger.focus();
  const before = document.body.style.overflow;
  rerender(<Example open close={close} />);
  expect(document.body.style.overflow).toBe('hidden');
  screen.getByText('Last').focus();
  fireEvent.keyDown(document, {key:'Tab'});
  expect(document.activeElement).toBe(screen.getByText('First'));
  fireEvent.keyDown(document, {key:'Tab',shiftKey:true});
  expect(document.activeElement).toBe(screen.getByText('Last'));
  fireEvent.keyDown(document, {key:'Escape'});
  expect(close).toHaveBeenCalledTimes(1);
  rerender(<Example open={false} close={close} />);
  expect(document.activeElement).toBe(trigger);
  expect(document.body.style.overflow).toBe(before);
});
