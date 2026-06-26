import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useModalStore } from '../../store/useModalStore';

describe('ConfirmDialog', () => {
  beforeEach(() => {
    useModalStore.setState({ confirmDialog: null, confirmLoading: false });
  });

  it('renders nothing without a dialog request', () => {
    const { container } = render(<ConfirmDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('runs confirm action and closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    useModalStore.getState().requestConfirm({
      title: 'Delete order?',
      message: 'This cannot be undone',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm,
    });

    render(<ConfirmDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    expect(useModalStore.getState().confirmDialog).toBe(null);
  });

  it('cancels on secondary button', () => {
    useModalStore.getState().requestConfirm({
      title: 'Delete order?',
      message: 'This cannot be undone',
      confirmLabel: 'Delete',
    });

    render(<ConfirmDialog />);
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));

    expect(useModalStore.getState().confirmDialog).toBe(null);
  });
});
