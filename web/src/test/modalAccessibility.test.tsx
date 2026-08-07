import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ModalDialog } from '../components/ModalDialog';

it('el modal usa ids ARIA únicos, respeta data-autofocus, Escape y restaura el foco', async () => {
  const onClose = vi.fn();
  const view = (open: boolean) => <>
    <button type="button">Abrir modal</button>
    <ModalDialog
      open={open}
      title="Editar dato"
      description="Completá el campo requerido."
      onClose={onClose}
      footer={<button type="button">Guardar</button>}
    >
      <input aria-label="Primer campo" />
      <input aria-label="Campo preferido" data-autofocus />
    </ModalDialog>
  </>;
  const rendered = render(view(false));
  const trigger = screen.getByRole('button', { name: 'Abrir modal' });
  trigger.focus();
  rendered.rerender(view(true));

  const dialog = screen.getByRole('dialog', { name: 'Editar dato' });
  const labelledBy = dialog.getAttribute('aria-labelledby');
  const describedBy = dialog.getAttribute('aria-describedby');
  expect(labelledBy).toBeTruthy();
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(labelledBy!)).toHaveTextContent('Editar dato');
  expect(document.getElementById(describedBy!)).toHaveTextContent('Completá el campo requerido.');
  await waitFor(() => expect(screen.getByLabelText('Campo preferido')).toHaveFocus());
  expect(screen.getByLabelText('Primer campo')).not.toHaveFocus();

  await userEvent.setup().keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
  rendered.rerender(view(false));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it('dos dialogs secuenciales no comparten ids de título o descripción', () => {
  const view = (firstOpen: boolean, secondOpen: boolean) => <>
    <ModalDialog open={firstOpen} title="Primero" description="Descripción uno" onClose={vi.fn()} footer={<button>Listo</button>}><p>Uno</p></ModalDialog>
    <ModalDialog open={secondOpen} title="Segundo" description="Descripción dos" onClose={vi.fn()} footer={<button>Listo</button>}><p>Dos</p></ModalDialog>
  </>;
  const rendered = render(view(true, false));
  const first = screen.getByRole('dialog');
  const firstTitle = first.getAttribute('aria-labelledby');
  const firstDescription = first.getAttribute('aria-describedby');

  rendered.rerender(view(false, true));
  const second = screen.getByRole('dialog');
  expect(second.getAttribute('aria-labelledby')).not.toBe(firstTitle);
  expect(second.getAttribute('aria-describedby')).not.toBe(firstDescription);
});
