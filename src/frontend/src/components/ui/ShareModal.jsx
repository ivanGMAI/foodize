import { useState } from 'react';
import { X, Copy, TelegramLogo, Check } from '@phosphor-icons/react';

const ShareModal = ({ restaurant, onClose }) => {
  const [copied, setCopied] = useState(false);

  const miniAppUrl = import.meta.env.VITE_MINI_APP_URL || '';
  const webUrl = import.meta.env.VITE_WEB_URL || window.location.origin;

  // Use the display_id if available, otherwise fallback to id. This handles the UUID hiding task.
  const targetId = restaurant.display_id || restaurant.id;

  const deepLink = miniAppUrl
    ? `${miniAppUrl}?startapp=restaurant_${targetId}`
    : `${webUrl}/restaurants/${targetId}`;

  const text = `🍽 Пойдем в ${restaurant.name}!\nПосмотри меню и сделай предзаказ через Foodize:`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`,
      '_blank'
    );
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 5000, padding: 20 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 340,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: '1.1rem',
              color: 'var(--text-1)',
            }}
          >
            Поделиться
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-3)',
              display: 'flex',
            }}
          >
            <X size={22} weight="bold" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={handleTelegram}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px',
              background: 'rgba(0, 136, 204, 0.1)',
              color: '#0088cc',
              border: '1px solid rgba(0, 136, 204, 0.2)',
            }}
          >
            <TelegramLogo size={20} weight="fill" />
            Отправить в Telegram
          </button>

          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px',
            }}
          >
            {copied ? (
              <>
                <Check size={20} color="var(--color-success)" weight="bold" />
                <span style={{ color: 'var(--color-success)' }}>
                  Ссылка скопирована!
                </span>
              </>
            ) : (
              <>
                <Copy size={20} />
                Скопировать ссылку
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
