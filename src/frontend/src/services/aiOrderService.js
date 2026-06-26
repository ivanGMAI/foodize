const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

export const aiOrderService = {
  // Streams the assistant reply; onChunk(text) is called for every chunk.
  streamChat: async (messages, { onChunk, signal } = {}) => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${BASE_URL}/ai/order/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages }),
      signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ошибка ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) onChunk?.(text);
    }
  },
};
