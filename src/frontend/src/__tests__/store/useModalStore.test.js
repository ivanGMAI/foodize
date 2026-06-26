import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useModalStore } from '../../store/useModalStore';

describe('useModalStore', () => {
  beforeEach(() => {
    useModalStore.setState({ confirmDialog: null, confirmLoading: false });
  });

  it('stores and cancels confirm dialogs', () => {
    const dialog = { title: 'Delete?', onConfirm: vi.fn() };

    useModalStore.getState().requestConfirm(dialog);
    expect(useModalStore.getState().confirmDialog).toBe(dialog);

    useModalStore.getState().cancelConfirm();
    expect(useModalStore.getState().confirmDialog).toBe(null);
    expect(useModalStore.getState().confirmLoading).toBe(false);
  });

  it('runs confirm action and closes dialog', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    useModalStore.getState().requestConfirm({ title: 'Delete?', onConfirm });

    await useModalStore.getState().runConfirmAction();

    expect(onConfirm).toHaveBeenCalled();
    expect(useModalStore.getState().confirmDialog).toBe(null);
    expect(useModalStore.getState().confirmLoading).toBe(false);
  });

  it('does nothing when no confirm action exists', async () => {
    useModalStore.getState().requestConfirm({ title: 'No action' });

    await useModalStore.getState().runConfirmAction();

    expect(useModalStore.getState().confirmDialog).toEqual({
      title: 'No action',
    });
    expect(useModalStore.getState().confirmLoading).toBe(false);
  });
});
