import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { X, DownloadSimple, QrCode } from '@phosphor-icons/react';

const QRCodeModal = ({ restaurant, onClose, initialType = 'site' }) => {
  const canvasRef = useRef(null);
  const [type, setType] = useState(initialType);

  const webUrl = import.meta.env.VITE_WEB_URL || window.location.origin;
  const botUsername = (import.meta.env.VITE_BOT_USERNAME || '').replace(
    /^@/,
    ''
  );

  const publicId = restaurant.display_id || restaurant.id;
  const siteLink = `${webUrl.replace(/\/$/, '')}/restaurants/${publicId}`;
  const telegramLink = botUsername
    ? `https://t.me/${botUsername}?start=restaurant_${publicId}`
    : '';
  const deepLink = type === 'telegram' ? telegramLink : siteLink;

  useEffect(() => {
    if (!canvasRef.current) return;
    if (!deepLink) {
      const context = canvasRef.current.getContext('2d');
      context?.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      return;
    }
    QRCode.toCanvas(canvasRef.current, deepLink, {
      width: 240,
      margin: 2,
      color: {
        dark: '#2E2418',
        light: '#F5F0E8',
      },
    }).catch(() => {});
  }, [deepLink]);

  const handleDownload = async () => {
    if (!deepLink) return;
    try {
      const dataUrl = await QRCode.toDataURL(deepLink, {
        width: 512,
        margin: 2,
        color: { dark: '#2E2418', light: '#F5F0E8' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qr_${type}_${restaurant.name.replace(/\s+/g, '_')}.png`;
      a.click();
    } catch {}
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 5000 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{ maxWidth: 320, padding: '28px 24px', textAlign: 'center' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={20} color="var(--fire)" weight="fill" />
            <span
              style={{
                fontWeight: 800,
                fontSize: '1rem',
                color: 'var(--text-1)',
              }}
            >
              QR-код
            </span>
          </div>
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

        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '0.8rem',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          При сканировании откроется страница{' '}
          <strong style={{ color: 'var(--text-1)' }}>{restaurant.name}</strong>
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 6,
            marginBottom: 16,
          }}
        >
          {[
            ['site', 'Сайт'],
            ['telegram', 'Telegram'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                type === value ? 'btn btn-primary' : 'btn btn-secondary'
              }
              onClick={() => setType(value)}
              style={{ height: 36, fontSize: '0.78rem' }}
            >
              {label}
            </button>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            display: 'block',
            margin: '0 auto',
          }}
        />

        {deepLink ? (
          <p
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-3)',
              marginTop: 12,
              wordBreak: 'break-all',
              lineHeight: 1.4,
            }}
          >
            {deepLink}
          </p>
        ) : (
          <p
            className="form-error"
            style={{
              fontSize: '0.72rem',
              marginTop: 12,
              lineHeight: 1.4,
              textAlign: 'left',
            }}
          >
            Для Telegram QR задайте VITE_BOT_USERNAME. QR должен вести в бота
            как /start restaurant_{publicId}.
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{
            width: '100%',
            marginTop: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onClick={handleDownload}
          disabled={!deepLink}
        >
          <DownloadSimple size={16} weight="bold" />
          Скачать PNG
        </button>
      </div>
    </div>
  );
};

export default QRCodeModal;
