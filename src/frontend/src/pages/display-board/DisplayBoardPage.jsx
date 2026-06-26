import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createDisplayBoardWebSocket } from '../../services/api';
import { restaurantService } from '../../services/restaurantService';

const RETRY_DELAY_MS = 3000;
const NEW_HIGHLIGHT_MS = 1500;

export default function DisplayBoardPage() {
  const { restaurantId } = useParams();
  const [cooking, setCooking] = useState([]);
  const [ready, setReady] = useState([]);
  const [newCooking, setNewCooking] = useState(new Set());
  const [newReady, setNewReady] = useState(new Set());
  const [restaurantName, setRestaurantName] = useState('');
  const [error, setError] = useState(null);
  const [time, setTime] = useState(new Date());
  const wsRef = useRef(null);
  const retryRef = useRef(null);
  const prevCookingRef = useRef(new Set());
  const prevReadyRef = useRef(new Set());

  useEffect(() => {
    restaurantService
      .getById(restaurantId)
      .then((res) => setRestaurantName(res.data?.data?.name || ''))
      .catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    const tick = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      wsRef.current = createDisplayBoardWebSocket(
        restaurantId,
        (data) => {
          if (data.error) {
            setError(data.error);
            return;
          }

          const nextCooking = data.cooking ?? [];
          const nextReady = data.ready ?? [];

          const addedCooking = nextCooking.filter(
            (id) => !prevCookingRef.current.has(id)
          );
          const addedReady = nextReady.filter(
            (id) => !prevReadyRef.current.has(id)
          );

          prevCookingRef.current = new Set(nextCooking);
          prevReadyRef.current = new Set(nextReady);

          setCooking(nextCooking);
          setReady(nextReady);

          if (addedCooking.length > 0) {
            setNewCooking((prev) => new Set([...prev, ...addedCooking]));
            setTimeout(() => {
              setNewCooking((prev) => {
                const next = new Set(prev);
                addedCooking.forEach((id) => next.delete(id));
                return next;
              });
            }, NEW_HIGHLIGHT_MS);
          }

          if (addedReady.length > 0) {
            setNewReady((prev) => new Set([...prev, ...addedReady]));
            setTimeout(() => {
              setNewReady((prev) => {
                const next = new Set(prev);
                addedReady.forEach((id) => next.delete(id));
                return next;
              });
            }, NEW_HIGHLIGHT_MS);
          }
        },
        () => {
          if (!cancelled) {
            retryRef.current = setTimeout(connect, RETRY_DELAY_MS);
          }
        }
      );
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [restaurantId]);

  if (error) {
    return (
      <div style={styles.errorScreen}>
        <span style={styles.errorText}>
          {error === 'forbidden' ? 'Нет доступа' : 'Ошибка подключения'}
        </span>
      </div>
    );
  }

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={styles.root}>
        <div style={styles.header}>
          <span style={styles.headerName}>{restaurantName}</span>
          <span style={styles.headerTime}>{timeStr}</span>
        </div>
        <div style={styles.columns}>
          <Column
            title="Готовятся"
            ids={cooking}
            newIds={newCooking}
            accentColor="#f97316"
            bgColor="rgba(249,115,22,0.06)"
          />
          <div style={styles.divider} />
          <Column
            title="Готовы к выдаче"
            ids={ready}
            newIds={newReady}
            accentColor="#22c55e"
            bgColor="rgba(34,197,94,0.06)"
          />
        </div>
      </div>
    </>
  );
}

function Column({ title, ids, newIds, accentColor, bgColor }) {
  return (
    <div style={{ ...styles.column, background: bgColor }}>
      <div style={styles.columnHeader}>
        <div style={{ ...styles.columnDot, background: accentColor }} />
        <span style={{ color: accentColor }}>{title}</span>
        <span style={{ ...styles.columnCount, color: accentColor }}>
          {ids.length}
        </span>
      </div>
      <div style={styles.grid}>
        {ids.length === 0 ? (
          <div style={styles.empty}>—</div>
        ) : (
          ids.map((id) => (
            <div
              key={id}
              style={{
                ...styles.card,
                borderColor: newIds.has(id)
                  ? accentColor
                  : 'rgba(255,255,255,0.08)',
                boxShadow: newIds.has(id)
                  ? `0 0 20px ${accentColor}40`
                  : 'none',
                animation: newIds.has(id)
                  ? 'orderSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)'
                  : undefined,
              }}
            >
              <span style={styles.cardNumber}>{id}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const KEYFRAMES = `
@keyframes orderSlideIn {
  from {
    opacity: 0;
    transform: scale(0.6) translateY(-16px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
`;

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: '#0a0a0a',
    overflow: 'hidden',
    fontFamily: 'Manrope, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 32px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: '#111',
    flexShrink: 0,
  },
  headerName: {
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  headerTime: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: '1rem',
    fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.04em',
  },
  columns: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '28px 28px 24px',
    overflow: 'hidden',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    fontSize: '1.1rem',
    fontWeight: 800,
    letterSpacing: '-0.01em',
    textTransform: 'uppercase',
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  columnCount: {
    marginLeft: 'auto',
    fontSize: '1.4rem',
    fontWeight: 900,
    letterSpacing: '-0.03em',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    flexWrap: 'wrap',
    gap: 14,
    alignContent: 'flex-start',
    overflowX: 'auto',
    overflowY: 'hidden',
    flex: 1,
  },
  card: {
    width: 110,
    height: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: 18,
    border: '2px solid',
    background: '#161616',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    cursor: 'default',
  },
  cardNumber: {
    fontSize: '2.6rem',
    fontWeight: 900,
    color: '#fff',
    lineHeight: 1,
    letterSpacing: '-0.04em',
  },
  divider: {
    width: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '20px 0',
    flexShrink: 0,
  },
  empty: {
    color: '#333',
    fontSize: '2rem',
    fontWeight: 700,
    marginTop: 40,
    width: '100%',
    textAlign: 'center',
  },
  errorScreen: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  errorText: {
    color: '#ef4444',
    fontSize: '1.25rem',
    fontWeight: 700,
    fontFamily: 'Manrope, sans-serif',
  },
};
