import { useState, useRef, useEffect, useCallback } from 'react';
import { ChartLineUp, ArrowsClockwise, CaretRight } from '@phosphor-icons/react';
import { aiAdvisorService } from '../../services/aiAdvisorService';

const SUGGESTIONS = [
  'Что добавить в меню?',
  'Когда у меня пиковые часы?',
  'Какие позиции почти не покупают?',
  'Как поднять средний чек?',
];

export default function VendorAdvisorPanel({ restaurantId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const appendToLastAssistant = useCallback((text) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      next[next.length - 1] = { ...last, content: last.content + text };
      return next;
    });
  }, []);

  const send = useCallback(
    async (text) => {
      const content = (text ?? input).trim();
      if (!content || streaming) return;

      setError(null);
      setInput('');
      const history = [...messages, { role: 'user', content }];
      setMessages([...history, { role: 'assistant', content: '' }]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        await aiAdvisorService.streamChat(
          history.map((m) => ({ role: m.role, content: m.content })),
          {
            restaurantId,
            signal: controller.signal,
            onChunk: appendToLastAssistant,
          }
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(
            'Не удалось получить ответ. Проверьте подключение и ключ модели.'
          );
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [input, streaming, messages, restaurantId, appendToLastAssistant]
  );

  const loadInsights = useCallback(async (refresh = false) => {
    setInsightsLoading(true);
    setError(null);
    try {
      const res = await aiAdvisorService.getInsights(refresh);
      setInsights(res.data?.data?.insights ?? '');
    } catch {
      setError('Не удалось получить анализ бизнеса.');
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 16,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Proactive business analysis */}
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: insights ? 12 : 0,
          }}
        >
          <h3
            style={{
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ChartLineUp size={20} /> Анализ бизнеса
          </h3>
          <button
            className="btn btn-primary"
            disabled={insightsLoading}
            onClick={() => loadInsights(Boolean(insights))}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {insights ? <ArrowsClockwise size={16} /> : <ChartLineUp size={16} />}
            {insightsLoading
              ? 'Анализирую…'
              : insights
                ? 'Обновить'
                : 'Получить анализ'}
          </button>
        </div>
        {insights && (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.92rem',
              lineHeight: 1.5,
              color: 'var(--text-2)',
            }}
          >
            {insights}
          </div>
        )}
      </div>

      {/* Chat */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h3 style={{ fontWeight: 700 }}>Спросить аналитика</h3>

        <div
          ref={scrollRef}
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  className="btn btn-secondary"
                  disabled={streaming}
                  onClick={() => send(s)}
                  style={{ fontSize: '0.85rem' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background:
                  m.role === 'user' ? 'var(--fire)' : 'var(--bg-surface)',
                color: m.role === 'user' ? 'var(--fire-text)' : 'var(--text-1)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              {m.content ||
                (streaming && i === messages.length - 1 ? '…' : '')}
            </div>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          style={{ display: 'flex', gap: 8 }}
        >
          <input
            className="form-input"
            placeholder="Например: что добавить в меню?"
            value={input}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={streaming || !input.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CaretRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
