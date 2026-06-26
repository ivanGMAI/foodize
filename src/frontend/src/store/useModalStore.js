import { create } from 'zustand';

export const useModalStore = create((set, get) => ({
  confirmDialog: null,
  confirmLoading: false,

  requestConfirm: (dialog) => set({ confirmDialog: dialog }),

  runConfirmAction: async () => {
    const { confirmDialog } = get();
    if (!confirmDialog?.onConfirm) return;

    set({ confirmLoading: true });
    try {
      await confirmDialog.onConfirm();
    } finally {
      set({ confirmLoading: false, confirmDialog: null });
    }
  },

  cancelConfirm: () => {
    set({ confirmDialog: null, confirmLoading: false });
  },
}));
