import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Loader2,
  AlertCircle,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import type {
  ChatMessage,
  ChatModelTier,
  DreamEntry,
} from '../types/dream';

interface SymbolChatPanelProps {
  dream: DreamEntry;
  pendingPrompt: string | null;
  onPendingPromptConsumed: () => void;
  onUpdateChatHistory: (dreamId: string, history: ChatMessage[]) => void;
}

const MODEL_OPTIONS: Array<{
  id: ChatModelTier;
  label: string;
  hint: string;
}> = [
  {
    id: 'hydrogen',
    label: 'Hydrogen',
    hint: 'Balanced Jungian dialogue',
  },
  {
    id: 'argon',
    label: 'Argon',
    hint: 'Complex symbolic synthesis',
  },
  {
    id: 'carbon',
    label: 'Carbon',
    hint: 'Deep analytical reasoning',
  },
  {
    id: 'flash-lite',
    label: 'Flash Lite',
    hint: 'Instant symbol lookup',
  },
];

function renderFormattedText(text: string): React.ReactNode {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p
        key={pIdx}
        className={`${pIdx > 0 ? 'mt-3' : ''} text-[14px] leading-[1.68] text-[#DDD8CF]`}
      >
        {lines.map((line, lIdx) => {
          const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
          return (
            <React.Fragment key={lIdx}>
              {lIdx > 0 && <br />}
              {parts.map((part, idx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return (
                    <strong key={idx} className="font-semibold text-[#F4F0E8]">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                  return (
                    <em key={idx} className="italic text-[#E9DFC9]">
                      {part.slice(1, -1)}
                    </em>
                  );
                }
                return <React.Fragment key={idx}>{part}</React.Fragment>;
              })}
            </React.Fragment>
          );
        })}
      </p>
    );
  });
}

export const SymbolChatPanel: React.FC<SymbolChatPanelProps> = ({
  dream,
  pendingPrompt,
  onPendingPromptConsumed,
  onUpdateChatHistory,
}) => {
  const [input, setInput] = useState('');
  const [modelTier, setModelTier] = useState<ChatModelTier>('hydrogen');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const history = dream.chatHistory ?? [];

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [history.length, dream.id]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
      modelTier,
    };

    const nextHistoryWithUser = [...history, userMsg];
    onUpdateChatHistory(dream.id, nextHistoryWithUser);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/dreams/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dreamContext: {
            title: dream.interpretation.title,
            transcript: dream.transcript,
            emotionalTheme: dream.interpretation.emotionalTheme,
            coreSynthesis: dream.interpretation.coreSynthesis,
            archetypes: dream.interpretation.archetypes,
            symbols: dream.interpretation.symbols,
          },
          messages: history.map((m) => ({ role: m.role, text: m.text })),
          userMessage: trimmed,
          modelTier,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to receive dialogue reply.');
      }

      const modelMsg: ChatMessage = {
        id: `msg-${Date.now()}-m`,
        role: 'model',
        text: data.reply,
        timestamp: new Date().toISOString(),
        modelTier,
      };

      onUpdateChatHistory(dream.id, [...nextHistoryWithUser, modelMsg]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to complete symbol dialogue right now.'
      );
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (pendingPrompt) {
      void sendMessage(pendingPrompt);
      onPendingPromptConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const activeModelMeta =
    MODEL_OPTIONS.find((m) => m.id === modelTier) ?? MODEL_OPTIONS[0];

  return (
    <section
      aria-label="Symbol Dialogue"
      className="bg-[#13161C] border border-white/[0.08] rounded-xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#D4A359]">
            Analytical Interlocutor
          </p>
          <h3 className="mt-1 font-serif text-2xl font-medium text-[#EAE6DF]">
            Symbol Dialogue
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Chat model tier"
            className="inline-flex items-center p-1 bg-[#0D0F13] border border-white/[0.08] rounded-lg"
          >
            {MODEL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.hint}
                onClick={() => setModelTier(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  modelTier === opt.id
                    ? 'bg-[#232833] text-[#EAE6DF]'
                    : 'text-[#8C929D] hover:text-[#EAE6DF]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => onUpdateChatHistory(dream.id, [])}
              title="Clear dialogue thread"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#8C929D] hover:text-[#EAE6DF] border border-white/[0.07] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Symbol Prompt Strip */}
      {dream.interpretation.symbols.length > 0 && (
        <div className="px-6 py-3 border-b border-white/[0.06] bg-[#101318] flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#7F8590] whitespace-nowrap shrink-0 mr-1">
            Ask about:
          </span>
          {dream.interpretation.symbols.map((sym) => (
            <button
              key={sym.symbol}
              type="button"
              disabled={isSending}
              onClick={() =>
                sendMessage(
                  `What deeper personal or Jungian significance might "${sym.symbol}" carry in the context of this dream?`
                )
              }
              className="px-3 py-1.5 text-xs font-medium text-[#D5CFC4] hover:text-[#EAE6DF] bg-[#181C24] hover:bg-[#202530] border border-white/[0.08] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
            >
              {sym.symbol}
            </button>
          ))}
        </div>
      )}

      {/* Scrollable Message Thread */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-[280px] max-h-[460px] overflow-y-auto px-6 py-5 space-y-5"
      >
        {history.length === 0 ? (
          <div className="py-8 text-center max-w-md mx-auto">
            <MessageSquare className="w-6 h-6 text-[#D4A359]/70 mx-auto mb-3" />
            <p className="font-serif text-xl text-[#EAE6DF]">
              Inquire into any symbol or figure
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#9499A3]">
              Ask why an object appeared, explore an emotional shift, or select
              a symbol above to begin a multi-turn Jungian dialogue grounded in{' '}
              <span className="text-[#EAE6DF]">
                {dream.interpretation.title}
              </span>
              .
            </p>
          </div>
        ) : (
          history.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5 text-[11px] font-mono text-[#7F8590]">
                <span>{msg.role === 'user' ? 'You' : 'Jungian Analyst'}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div
                className={`max-w-[88%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#202530] text-[#EAE6DF] border border-white/[0.09]'
                    : 'bg-[#0D0F13] text-[#DDD8CF] border border-white/[0.07]'
                }`}
              >
                {renderFormattedText(msg.text)}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-2.5 text-xs font-mono text-[#9499A3] py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D4A359]" />
            <span>
              Reflecting via {activeModelMeta.label} ({activeModelMeta.hint})...
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mx-6 mb-3 flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-[#231617] border border-[#9A3E43]/45 text-xs text-[#F2D5D6]"
        >
          <AlertCircle className="w-4 h-4 text-[#E07A7F] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage(input);
        }}
        className="p-4 border-t border-white/[0.07] bg-[#101318] flex items-end gap-3"
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          placeholder={`Ask about a symbol in "${dream.interpretation.title}"...`}
          className="flex-1 bg-[#0D0F13] border border-white/[0.09] focus:border-[#D4A359]/60 focus:outline-none rounded-lg px-3.5 py-2.5 text-sm text-[#EAE6DF] placeholder:text-[#5F6570] resize-none transition-colors"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          aria-label="Send message"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4A359] text-[#0D0F13] font-semibold text-sm hover:bg-[#DFB26E] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer h-[44px]"
        >
          <Send className="w-4 h-4" />
          Ask
        </button>
      </form>
    </section>
  );
};
