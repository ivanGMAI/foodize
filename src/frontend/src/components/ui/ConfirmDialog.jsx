import { Trash } from '@phosphor-icons/react';
import { useModalStore } from '../../store/useModalStore';
import { useShallow } from 'zustand/react/shallow';

const ConfirmDialog = () => {
  const { dialog, loading, cancelConfirm, runConfirmAction } = useModalStore(
    useShallow((s) => ({
      dialog: s.confirmDialog,
      loading: s.confirmLoading,
      cancelConfirm: s.cancelConfirm,
      runConfirmAction: s.runConfirmAction,
    }))
  );

  if (!dialog) return null;

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 5000 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) cancelConfirm();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 440,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--r-sm)',
              background: 'var(--color-error-bg)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Trash size={20} />
          </div>
          <div>
            <h3
              style={{ color: 'var(--text-1)', fontSize: '1.05rem', margin: 0 }}
            >
              {dialog.title}
            </h3>
            <p
              style={{
                color: 'var(--text-3)',
                fontSize: '0.88rem',
                lineHeight: 1.55,
                margin: '8px 0 0',
              }}
            >
              {dialog.message}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn-secondary"
            disabled={loading}
            onClick={cancelConfirm}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            disabled={loading}
            onClick={runConfirmAction}
            style={{
              background: dialog.danger ? 'var(--error)' : 'var(--fire)',
            }}
          >
            {loading ? 'Выполняю...' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
