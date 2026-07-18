/**
 * POST + Server-Sent-Events helper for the streaming chat endpoint.
 * fetch() is used (not EventSource) because we need a POST body + auth header.
 */
export async function streamChat({ question, chatId, pdfId, handlers, signal }) {
  const token = localStorage.getItem('token');

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, chatId, pdfId }),
    signal,
  });

  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // Parse SSE frames: "event: <name>\ndata: <json>\n\n"
  const processFrame = (frame) => {
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice(7).trim();
      else if (line.startsWith('data: ')) data += line.slice(6);
    }
    if (!data) return;
    try {
      handlers[event]?.(JSON.parse(data));
    } catch {
      /* skip malformed frame */
    }
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      if (frame.trim()) processFrame(frame);
    }
  }

  // Flush any final partial frame (e.g. connection closed right after an
  // "error" event without a trailing blank line)
  buffer += decoder.decode();
  if (buffer.trim()) processFrame(buffer);
}
