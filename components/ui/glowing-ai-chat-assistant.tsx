import React, { useState, useRef, useEffect } from 'react';
import { useEscapeClose } from '../../lib/use-escape-close';
import { Paperclip, Link, Mic, Send, Info, Bot, X } from 'lucide-react';
import { getFallbackResponse, formatChatText } from './chat-knowledge-base';

type MessageRole = 'user' | 'assistant';
interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function fetchGeminiReply(messages: { role: MessageRole; content: string }[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string' || !key.trim()) return null;

  const contents = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  try {
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' ? text.trim() : null;
  } catch {
    return null;
  }
}

const FloatingAiAssistant: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  useEscapeClose(isChatOpen, () => setIsChatOpen(false), 1100);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleSend = async () => {
    const text = message.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessage('');
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    const conversationSoFar = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    let replyText: string;
    const geminiReply = await fetchGeminiReply(conversationSoFar);
    if (geminiReply) {
      replyText = geminiReply;
    } else {
      replyText = getFallbackResponse(text);
    }

    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: replyText,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (chatRef.current && target && !chatRef.current.contains(target)) {
        if (!target.closest('.floating-ai-button')) {
          setIsChatOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 md:bottom-6 md:right-8 z-[1100]">
      <button
        type="button"
        className={`floating-ai-button relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center transition-all duration-500 transform cursor-pointer touch-manipulation ${
          isChatOpen ? 'rotate-90' : 'rotate-0'
        }`}
        onClick={() => setIsChatOpen(!isChatOpen)}
        aria-label={isChatOpen ? 'Close chat' : 'Open chat'}
        style={{
          background:
            'linear-gradient(135deg, rgba(12,11,9,0.95) 0%, rgba(20,82,112,0.95) 100%)',
          boxShadow:
            '0 0 20px rgba(12, 11, 9, 0.6), 0 0 40px rgba(20, 82, 112, 0.4)',
          border: '2px solid rgba(255, 255, 255, 0.25)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-30 pointer-events-none" />
        <div className="absolute inset-0 rounded-full border-2 border-white/10 pointer-events-none" />
        <div className="relative z-10 text-white flex items-center justify-center pointer-events-none">
          {isChatOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" /> : <Bot className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />}
        </div>
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-navy-600 pointer-events-none" />
      </button>

      {isChatOpen && (
        <div
          ref={chatRef}
          role="dialog"
          aria-modal="true"
          aria-label="Concierge chat"
          className="absolute bottom-20 right-0 w-[min(100vw-3rem,420px)] transition-all duration-300 origin-bottom-right flex flex-col max-h-[min(80vh,640px)]"
          style={{
            animation: 'popInChat 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
          }}
        >
          <div className="relative flex flex-col rounded-3xl border border-zinc-600/60 shadow-2xl backdrop-blur-3xl overflow-hidden bg-zinc-950/95 flex-1 flex min-h-0">
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(63,63,70,0.7) 1px, transparent 1px), linear-gradient(to bottom, rgba(63,63,70,0.7) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
            <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-medium text-zinc-400">Melissa</span>
              </div>
              <button
                onClick={() => setIsChatOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-700/50 transition-colors"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 md:px-6 py-3 space-y-4">
              {messages.length === 0 && !isLoading && (
                <p className="text-xs text-zinc-500 text-center py-4">
                  Ask me about pricing, Nivoda, after-hours, integrations, or book a demo.
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-navy-600 text-white'
                        : 'bg-zinc-800/80 text-zinc-100 border border-zinc-700/50'
                    }`}
                  >
                    {m.role === 'user' ? (
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    ) : (
                      <span
                        className="whitespace-pre-wrap break-words [&_strong]:font-semibold [&_strong]:text-white"
                        dangerouslySetInnerHTML={{ __html: formatChatText(m.content) }}
                      />
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-2xl px-4 py-2.5 text-zinc-400 text-sm flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="inline-block w-2 h-2 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="relative overflow-hidden shrink-0 border-t border-zinc-800/50">
              <textarea
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={3}
                className="w-full px-4 md:px-6 py-3 bg-transparent border-none outline-none resize-none text-sm md:text-base leading-relaxed min-h-[80px] text-zinc-100 placeholder-zinc-500 disabled:opacity-60"
                placeholder="Ask Melissa how Fourcee would handle your callers, integrations, or after‑hours coverage…"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, rgba(39,39,42,0.15), transparent)',
                }}
              />
            </div>

            <div className="px-3 md:px-4 pb-3 pt-2 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 p-1 bg-zinc-800/40 rounded-xl border border-zinc-700/50">
                    <button type="button" className="group relative p-2 bg-transparent rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all" title="Upload files (coming soon)">
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button type="button" className="group relative p-2 bg-transparent rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 transition-all" title="Web link (coming soon)">
                      <Link className="w-4 h-4" />
                    </button>
                  </div>
                  <button type="button" className="group relative p-2 bg-transparent border border-zinc-700/30 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800/80 transition-all" title="Voice input (coming soon)">
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!message.trim() || isLoading}
                  className="relative flex items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-3 py-2 text-white shadow-lg hover:from-red-500 hover:to-red-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-2 pt-2 border-t border-zinc-800/50 text-[11px] text-zinc-500 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-zinc-400 font-mono text-[10px]">Shift + Enter</kbd> new line
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  <span>Melissa is listening</span>
                </div>
              </div>
            </div>

            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent, rgba(147,51,234,0.08))',
              }}
            />
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes popInChat {
            0% { opacity: 0; transform: scale(0.8) translateY(20px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          .floating-ai-button:hover {
            transform: scale(1.08) rotate(4deg);
            box-shadow: 0 0 30px rgba(12,11,9,0.8), 0 0 50px rgba(20,82,112,0.6);
          }
        `}
      </style>
    </div>
  );
};

export { FloatingAiAssistant };
