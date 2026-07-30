import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE_URL, sendAiChatMessage } from '../api/client';

const STORAGE_KEY = 'messara_ai_chat_v1';
const DEFAULT_SUGGESTIONS = [
  'Help me choose furniture',
  'Flooring advice',
  'UAE delivery charges',
  'Request a quotation',
];
const WELCOME_MESSAGE = {
  role: 'assistant',
  content: 'Hello, I’m the Messara Assistant. I can search our live catalogue and help with products, colours, sizes, delivery, showrooms, and quotations. What can I help you find?',
};

function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function loadConversation() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.sessionId && Array.isArray(stored.messages)) {
      return {
        sessionId: stored.sessionId,
        messages: stored.messages.slice(-30),
      };
    }
  } catch {
    // Start a clean conversation when old browser data is invalid.
  }

  return { sessionId: newSessionId(), messages: [WELCOME_MESSAGE] };
}

function productImageUrl(imageUrl) {
  if (!imageUrl || /^(https?:)?\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export default function AiChatWidget() {
  const location = useLocation();
  const initialConversation = useMemo(loadConversation, []);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState(initialConversation.sessionId);
  const [messages, setMessages] = useState(initialConversation.messages);
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessionId,
      messages: messages.slice(-30),
    }));
  }, [messages, sessionId]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [messages, open, sending]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  async function submitMessage(rawMessage) {
    const content = String(rawMessage || '').trim();
    if (content.length < 2 || sending) return;

    const userMessage = { role: 'user', content };
    const history = messages
      .filter((message) => ['user', 'assistant'].includes(message.role))
      .map(({ role, content: historyContent }) => ({ role, content: historyContent }))
      .slice(-10);

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setError('');
    setSending(true);

    try {
      const response = await sendAiChatMessage({
        message: content,
        session_id: sessionId,
        locale: document.documentElement.lang || 'en',
        page_url: window.location.href,
        history,
      });

      setSessionId(response.session_id || sessionId);
      setSuggestions(Array.isArray(response.suggestions) ? response.suggestions : DEFAULT_SUGGESTIONS);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.answer,
          products: Array.isArray(response.products) ? response.products : [],
          handoff: Boolean(response.handoff),
        },
      ]);
    } catch (requestError) {
      const message = requestError.response?.data?.message
        || 'I could not reach the assistant just now. You can retry or continue on WhatsApp.';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  function resetConversation() {
    const nextSessionId = newSessionId();
    setSessionId(nextSessionId);
    setMessages([WELCOME_MESSAGE]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setDraft('');
    setError('');
    localStorage.removeItem(STORAGE_KEY);
  }

  const whatsappUrl = `https://wa.me/971543057077?text=${encodeURIComponent(
    `Hi Messara Living, I need help from your team.\n${window.location.href}`
  )}`;

  return (
    <div className={`ai-chat-widget ${open ? 'is-open' : ''}`}>
      {!open && (
        <button
          type="button"
          className="ai-chat-launcher"
          onClick={() => setOpen(true)}
          aria-label="Open Messara shopping assistant"
        >
          <span className="ai-chat-launcher-pulse" />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.2-.6L4 20l1.5-4A7.1 7.1 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" />
            <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" />
          </svg>
          <span className="ai-chat-launcher-label">Ask Messara</span>
        </button>
      )}

      {open && (
        <section className="ai-chat-panel" aria-label="Messara shopping assistant">
          <header className="ai-chat-header">
            <div className="ai-chat-identity">
              <span className="ai-chat-avatar">
                <img src="/messaraliving-logo.png" alt="" />
              </span>
              <span>
                <strong>Messara Assistant</strong>
                <small><i /> Catalogue &amp; business help</small>
              </span>
            </div>
            <div className="ai-chat-header-actions">
              <button type="button" onClick={resetConversation} title="New conversation" aria-label="Start a new conversation">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.5M4 4v4.5h4.5" /></svg>
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Close" aria-label="Close assistant">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>
          </header>

          <div className="ai-chat-messages" aria-live="polite">
            <div className="ai-chat-trust-note">
              Live catalogue prices and stock. Business policies are never guessed.
            </div>

            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`ai-chat-message is-${message.role}`}>
                <div className="ai-chat-bubble">{message.content}</div>

                {Array.isArray(message.products) && message.products.length > 0 && (
                  <div className="ai-chat-products">
                    {message.products.map((product) => (
                      <Link key={product.id} to={product.url} className="ai-chat-product">
                        <span className="ai-chat-product-image">
                          {product.image_url
                            ? <img src={productImageUrl(product.image_url)} alt="" loading="lazy" />
                            : <span>{product.name?.charAt(0)}</span>}
                        </span>
                        <span className="ai-chat-product-copy">
                          <strong>{product.name}</strong>
                          <small>{product.brand || product.category}</small>
                          <b>{formatPrice(product.price)}</b>
                          <em className={product.is_in_stock ? 'is-stocked' : ''}>
                            {product.is_in_stock ? 'In stock' : 'Out of stock'}
                          </em>
                        </span>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                      </Link>
                    ))}
                  </div>
                )}

                {message.handoff && (
                  <a className="ai-chat-handoff" href={whatsappUrl} target="_blank" rel="noreferrer">
                    Continue with a person on WhatsApp
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
                  </a>
                )}
              </article>
            ))}

            {sending && (
              <div className="ai-chat-typing" aria-label="Assistant is typing">
                <span /><span /><span />
              </div>
            )}
            {error && (
              <div className="ai-chat-error">
                <span>{error}</span>
                <button type="button" onClick={() => submitMessage(messages.at(-1)?.content)}>Retry</button>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {!sending && (
            <div className="ai-chat-suggestions" aria-label="Suggested questions">
              {suggestions.slice(0, 4).map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => submitMessage(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitMessage(draft);
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(draft);
                }
              }}
              placeholder="Ask about a product, room, delivery..."
              maxLength={1200}
              rows={1}
              aria-label="Message Messara Assistant"
            />
            <button type="submit" disabled={sending || draft.trim().length < 2} aria-label="Send message">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 3-8.7 18-2.1-7.2L3 11.7 21 3Z" /><path d="m10.2 13.8 4.5-4.5" /></svg>
            </button>
          </form>
          <footer className="ai-chat-footer">AI can make mistakes. Confirm important details before ordering.</footer>
        </section>
      )}
    </div>
  );
}
