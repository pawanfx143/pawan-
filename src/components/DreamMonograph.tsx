import React, { useEffect, useState } from 'react';
import {
  Maximize2,
  X,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import type {
  ChatMessage,
  DreamEntry,
  ImageResolution,
} from '../types/dream';
import { SymbolChatPanel } from './SymbolChatPanel';

interface DreamMonographProps {
  dream: DreamEntry;
  onUpdateDream: (updated: DreamEntry) => void;
  onDeleteDream: (id: string) => void;
}

export const DreamMonograph: React.FC<DreamMonographProps> = ({
  dream,
  onUpdateDream,
  onDeleteDream,
}) => {
  const [selectedSize, setSelectedSize] = useState<ImageResolution>(
    dream.imageResolution
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(
    null
  );

  useEffect(() => {
    setSelectedSize(dream.imageResolution);
    setImageError(null);
    setImgLoadFailed(false);
  }, [dream.id, dream.imageResolution, dream.imageUrl]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLightboxOpen]);

  const handleRegenerateArtwork = async (targetSize: ImageResolution) => {
    setIsRegenerating(true);
    setImageError(null);

    try {
      const res = await fetch('/api/dreams/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: dream.interpretation.surrealistPrompt,
          imageSize: targetSize,
          aspectRatio: dream.imageAspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Artwork generation failed.');
      }

      setImgLoadFailed(false);
      onUpdateDream({
        ...dream,
        imageUrl: data.imageDataUrl,
        imageResolution: targetSize,
      });
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Unable to regenerate artwork.'
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadArtwork = () => {
    if (!dream.imageUrl) return;
    const link = document.createElement('a');
    link.href = dream.imageUrl;
    const slug = dream.interpretation.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.download = `${slug || 'dream-plate'}-${dream.imageResolution}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExploreSymbol = (symbolName: string) => {
    setPendingChatPrompt(
      `Let's examine the symbol "${symbolName}" in this dream. How does it connect to the emotional theme and what waking associations should I consider?`
    );
    const chatEl = document.getElementById('symbol-dialogue-anchor');
    chatEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const formattedDate = new Date(dream.recordedAt).toLocaleDateString(
    undefined,
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }
  );
  const formattedTime = new Date(dream.recordedAt).toLocaleTimeString(
    undefined,
    {
      hour: '2-digit',
      minute: '2-digit',
    }
  );

  const aspectClass =
    dream.imageAspectRatio === '16:9'
      ? 'aspect-video'
      : dream.imageAspectRatio === '1:1'
        ? 'aspect-square max-w-2xl'
        : 'aspect-[4/3]';

  const synthesisParagraphs = dream.interpretation.coreSynthesis
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);

  return (
    <article className="space-y-10">
      {/* Archival Header — Clean Unboxed Metadata */}
      <header className="pb-6 border-b border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[#9499A3]">
            <span className="text-[#D4A359]">{dream.accessionCode}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formattedDate}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formattedTime}</span>
            <span aria-hidden="true">·</span>
            <span>{dream.interpretation.moodTone}</span>
          </div>

          {!dream.isCuratedSeed && (
            <button
              type="button"
              onClick={() => onDeleteDream(dream.id)}
              className="inline-flex items-center gap-1.5 text-xs text-[#8C929D] hover:text-[#E07A7F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Entry
            </button>
          )}
        </div>

        <h1 className="mt-3 font-serif text-4xl lg:text-5xl font-medium tracking-tight text-[#F3EFE8] text-balance">
          {dream.interpretation.title}
        </h1>

        <p className="mt-3 max-w-3xl font-serif italic text-xl lg:text-2xl leading-snug text-[#C9C3B8]">
          {dream.interpretation.emotionalTheme}
        </p>
      </header>

      {/* Primary Surrealist Visual Plate */}
      <section aria-label="Surrealist Dream Plate" className="space-y-4">
        <div
          className={`relative w-full ${aspectClass} bg-[#14171D] border border-white/[0.09] rounded-xl overflow-hidden group`}
        >
          {dream.imageUrl && !imgLoadFailed ? (
            <>
              <img
                src={dream.imageUrl}
                alt={`Surrealist painting representing ${dream.interpretation.title}`}
                referrerPolicy="no-referrer"
                onError={() => setImgLoadFailed(true)}
                onClick={() => setIsLightboxOpen(true)}
                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                aria-label="Inspect artwork fullscreen"
                className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D0F13]/80 backdrop-blur-sm border border-white/15 text-xs font-medium text-[#EAE6DF] hover:bg-[#0D0F13] transition-colors cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Inspect
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#171B24] via-[#12151C] to-[#0D0F13]">
              <p className="font-serif italic text-2xl text-[#C9C3B8] max-w-md">
                {dream.interpretation.title}
              </p>
              <p className="mt-2 text-xs font-mono text-[#7F8590] max-w-md">
                Surrealist plate not yet rendered or unavailable. Choose 1K, 2K,
                or 4K below to paint this dream with Gemini Pro Image.
              </p>
            </div>
          )}

          {isRegenerating && (
            <div className="absolute inset-0 bg-[#0D0F13]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#D4A359]" />
              <p className="text-sm font-medium text-[#EAE6DF]">
                Painting surrealist plate at {selectedSize}...
              </p>
            </div>
          )}
        </div>

        {/* Plate Caption & 1K / 2K / 4K Affordance */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <p className="text-xs font-serif italic text-[#8C929D]">
            Plate {dream.accessionCode} — Surrealist distillation of core
            emotional theme ({dream.imageResolution}, {dream.imageAspectRatio})
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Plate image resolution"
              className="inline-flex items-center p-1 bg-[#14171D] border border-white/[0.08] rounded-lg"
            >
              {(['1K', '2K', '4K'] as ImageResolution[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  disabled={isRegenerating}
                  onClick={() => setSelectedSize(size)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedSize === size
                      ? 'bg-[#D4A359] text-[#0D0F13] font-medium'
                      : 'text-[#9499A3] hover:text-[#EAE6DF]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={isRegenerating}
              onClick={() => handleRegenerateArtwork(selectedSize)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs font-medium text-[#EAE6DF] hover:bg-[#1A1E27] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`}
              />
              {dream.imageUrl ? `Render ${selectedSize}` : `Paint ${selectedSize}`}
            </button>

            {dream.imageUrl && !imgLoadFailed && (
              <button
                type="button"
                onClick={handleDownloadArtwork}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.1] text-xs font-medium text-[#C8C3B9] hover:text-[#EAE6DF] hover:bg-[#1A1E27] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Save Image
              </button>
            )}
          </div>
        </div>

        {imageError && (
          <div
            role="alert"
            className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[#231617] border border-[#9A3E43]/45 text-xs text-[#F2D5D6]"
          >
            <AlertCircle className="w-4 h-4 text-[#E07A7F] shrink-0 mt-0.5" />
            <p className="leading-relaxed">{imageError}</p>
          </div>
        )}
      </section>

      {/* Spoken Transcript & Optional Voice Recording Playback */}
      <section
        aria-label="Dream Transcript"
        className="border-t border-b border-white/[0.08] py-6"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-[#9499A3]">
            Recorded Waking Transcript
          </h2>
          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs text-[#9499A3] hover:text-[#EAE6DF] transition-colors cursor-pointer"
          >
            {showTranscript ? (
              <>
                Collapse <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Expand <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {showTranscript && (
          <div className="mt-4 space-y-4">
            <p className="max-w-prose text-[15px] leading-[1.75] text-[#C9C3B8]">
              “{dream.transcript}”
            </p>
            {dream.audioDataUrl && (
              <audio
                controls
                src={dream.audioDataUrl}
                className="h-9 w-full max-w-md opacity-90"
              />
            )}
          </div>
        )}
      </section>

      {/* Structured Psychological Interpretation (Below Image) */}
      <section
        aria-label="Structured Psychological Interpretation"
        className="space-y-12"
      >
        {/* 01. Core Jungian Synthesis */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
            <h2 className="font-serif text-3xl font-medium text-[#F3EFE8]">
              Psychological Interpretation
            </h2>
            <span className="text-xs font-mono text-[#9499A3]">
              {dream.interpretation.archetypalFramework}
            </span>
          </div>

          <div className="max-w-prose space-y-4">
            {synthesisParagraphs.map((paragraph, idx) => (
              <p
                key={idx}
                className={`text-[15px] leading-[1.8] text-[#D8D3CA] ${
                  idx === 0
                    ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-medium first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:text-[#D4A359] first-letter:leading-none'
                    : ''
                }`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* 02. Active Archetypes */}
        <div className="pt-8 border-t border-white/[0.08]">
          <h3 className="font-serif text-2xl font-medium text-[#F3EFE8] mb-6">
            Recognized Archetypes
          </h3>

          <div className="divide-y divide-white/[0.07] border-t border-b border-white/[0.07]">
            {dream.interpretation.archetypes.map((item, idx) => (
              <div
                key={item.archetype}
                className="py-5 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8"
              >
                <div className="md:col-span-4">
                  <span className="text-xs font-mono tabular-nums text-[#8C929D]">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <h4 className="mt-1 font-serif text-xl font-medium text-[#EAE6DF]">
                    {item.archetype}
                  </h4>
                </div>
                <div className="md:col-span-4">
                  <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#8C929D] mb-1">
                    Manifestation
                  </p>
                  <p className="text-sm leading-relaxed text-[#C9C3B8]">
                    {item.manifestation}
                  </p>
                </div>
                <div className="md:col-span-4">
                  <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#8C929D] mb-1">
                    Psychological Meaning
                  </p>
                  <p className="text-sm leading-relaxed text-[#DDD8CF]">
                    {item.meaning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 03. Key Dream Symbols (Interactive Dialogue Anchors) */}
        <div className="pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-6">
            <h3 className="font-serif text-2xl font-medium text-[#F3EFE8]">
              Symbolic Inventory
            </h3>
            <span className="text-xs text-[#9499A3]">
              Select any symbol to ask follow-up questions below
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {dream.interpretation.symbols.map((sym) => (
              <div
                key={sym.symbol}
                className="bg-[#14171D] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-mono text-[#D4A359]">
                    {sym.emotionalCharge}
                  </p>
                  <h4 className="mt-1.5 font-serif text-xl font-medium text-[#EAE6DF]">
                    {sym.symbol}
                  </h4>
                  <p className="mt-2.5 text-sm leading-relaxed text-[#B9B3A8]">
                    {sym.interpretation}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleExploreSymbol(sym.symbol)}
                  className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[#EAE6DF] hover:text-[#D4A359] transition-colors self-start cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Explore in dialogue
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 04. Waking Reflection Prompts */}
        {dream.interpretation.reflectionPrompts?.length > 0 && (
          <div className="pt-8 border-t border-white/[0.08]">
            <h3 className="font-serif text-2xl font-medium text-[#F3EFE8] mb-5">
              Waking Contemplation
            </h3>
            <ol className="space-y-4 max-w-prose">
              {dream.interpretation.reflectionPrompts.map((prompt, idx) => (
                <li key={idx} className="flex items-baseline gap-4">
                  <span className="text-xs font-mono tabular-nums text-[#D4A359] shrink-0">
                    0{idx + 1}.
                  </span>
                  <p className="text-[15px] leading-relaxed text-[#D8D3CA]">
                    {prompt}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      {/* Multi-Turn Symbol Dialogue Chatbot */}
      <div id="symbol-dialogue-anchor" className="pt-6 border-t border-white/[0.08]">
        <SymbolChatPanel
          dream={dream}
          pendingPrompt={pendingChatPrompt}
          onPendingPromptConsumed={() => setPendingChatPrompt(null)}
          onUpdateChatHistory={(dreamId: string, history: ChatMessage[]) => {
            if (dreamId === dream.id) {
              onUpdateDream({ ...dream, chatHistory: history });
            }
          }}
        />
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && dream.imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={dream.interpretation.title}
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-[#07080B]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 lg:p-12"
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Close fullscreen view"
            className="absolute top-6 right-6 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#171A21] border border-white/15 text-xs font-medium text-[#EAE6DF] hover:bg-[#222732] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            Close
          </button>

          <img
            src={dream.imageUrl}
            alt={dream.interpretation.title}
            referrerPolicy="no-referrer"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full rounded-lg border border-white/10 object-contain"
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="mt-4 text-center max-w-2xl"
          >
            <p className="font-serif text-xl text-[#F3EFE8]">
              {dream.interpretation.title}
            </p>
            <p className="mt-1 text-xs font-mono text-[#9499A3]">
              {dream.accessionCode} · {dream.imageResolution} ·{' '}
              {dream.interpretation.moodTone}
            </p>
          </div>
        </div>
      )}
    </article>
  );
};
