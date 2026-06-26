import { useState, useRef, useEffect, useCallback } from 'react';
import { X, CaretRight } from '@phosphor-icons/react';
import { aiOrderService } from '../../services/aiOrderService';
import { useOrderStore } from '../../store/useOrderStore';

const SUGGESTIONS = [
  'Где острая шаурма дешевле 350?',
  'Хочу два бургера и колу',
  'Что есть на десерт?',
];

export default function OrderAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const fetchCart = useOrderStore((s) => s.fetchCart);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

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
        await aiOrderService.streamChat(
          history.map((m) => ({ role: m.role, content: m.content })),
          { signal: controller.signal, onChunk: appendToLastAssistant }
        );
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Не удалось получить ответ. Попробуйте ещё раз.');
          setMessages((prev) => prev.slice(0, -1));
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
        // The agent may have changed the cart — refresh the header cart.
        fetchCart?.();
      }
    },
    [input, streaming, messages, appendToLastAssistant, fetchCart]
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Помощник заказа"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 80,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          borderRadius: 999,
          border: 'none',
          background: 'var(--fire)',
          color: 'var(--fire-text)',
          fontWeight: 700,
          boxShadow: '0 6px 16px var(--fire-glow)',
          cursor: 'pointer',
        }}
      >
        ✨ Помощник
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 80,
        zIndex: 1000,
        width: 'min(380px, calc(100vw - 32px))',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong>✨ Помощник заказа</strong>
        <button
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-2)',
            display: 'flex',
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
              Спросите, что хотите заказать — найду и помогу оформить.
            </div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="btn btn-secondary"
                disabled={streaming}
                onClick={() => send(s)}
                style={{ fontSize: '0.85rem', textAlign: 'left' }}
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
              background: m.role === 'user' ? 'var(--fire)' : 'var(--bg-surface)',
              color: m.role === 'user' ? 'var(--fire-text)' : 'var(--text-1)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.9rem',
              lineHeight: 1.5,
            }}
          >
            {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      {error && (
        <div className="form-error" style={{ margin: '0 14px' }}>
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--border)' }}
      >
        <input
          className="form-input"
          placeholder="Что хотите заказать?"
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={streaming || !input.trim()}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          <CaretRight size={16} />
        </button>
      </form>
    </div>
  );
}
