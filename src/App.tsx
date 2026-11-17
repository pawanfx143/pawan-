import React, { useEffect, useState } from 'react';
import { Mic, BookOpen, Menu, X } from 'lucide-react';
import type { DreamEntry } from './types/dream';
import {
  deleteDreamById,
  loadDreams,
  saveDream,
} from './utils/dreamStorage';
import { VoiceRecorderStudio } from './components/VoiceRecorderStudio';
import { DreamMonograph } from './components/DreamMonograph';
import { ArchetypeLexicon } from './components/ArchetypeLexicon';

type ActiveView = 'journal' | 'record' | 'archetypes';

export default function App() {
  const [dreams, setDreams] = useState<DreamEntry[]>([]);
  const [activeDreamId, setActiveDreamId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('journal');
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileArchiveOpen, setIsMobileArchiveOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadDreams().then((loaded) => {
      if (!mounted) return;
      setDreams(loaded);
      if (loaded.length > 0) {
        setActiveDreamId(loaded[0].id);
      }
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeDream =
    dreams.find((d) => d.id === activeDreamId) ?? dreams[0] ?? null;

  const handleDreamCreated = async (newDream: DreamEntry) => {
    setDreams((prev) => [newDream, ...prev]);
    setActiveDreamId(newDream.id);
    setActiveView('journal');
    await saveDream(newDream);
  };

  const handleUpdateDream = async (updated: DreamEntry) => {
    setDreams((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    await saveDream(updated);
  };

  const handleDeleteDream = async (id: string) => {
    setDreams((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      if (activeDreamId === id) {
        setActiveDreamId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
    await deleteDreamById(id);
  };

  const handleSelectDream = (id: string) => {
    setActiveDreamId(id);
    setActiveView('journal');
    setIsMobileArchiveOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0D0F13] text-[#EAE6DF] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0D0F13]/95 backdrop-blur-sm border-b border-white/[0.08]">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-10 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('journal')}
            className="font-serif text-2xl font-medium tracking-tight text-[#F3EFE8] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Oniros
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveView('journal')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                activeView === 'journal'
                  ? 'text-[#F3EFE8] border-b border-[#D4A359]'
                  : 'text-[#9499A3] hover:text-[#EAE6DF]'
              }`}
            >
              Journal
            </button>
            <button
              type="button"
              onClick={() => setActiveView('record')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                activeView === 'record'
                  ? 'text-[#F3EFE8] border-b border-[#D4A359]'
                  : 'text-[#9499A3] hover:text-[#EAE6DF]'
              }`}
            >
              Voice Capture
            </button>
            <button
              type="button"
              onClick={() => setActiveView('archetypes')}
              className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                activeView === 'archetypes'
                  ? 'text-[#F3EFE8] border-b border-[#D4A359]'
                  : 'text-[#9499A3] hover:text-[#EAE6DF]'
              }`}
            >
              Archetypes
            </button>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileArchiveOpen((prev) => !prev)}
              aria-label="Toggle dream archive"
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/[0.1] text-[#EAE6DF] cursor-pointer"
            >
              {isMobileArchiveOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('record')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4A359] text-[#0D0F13] hover:bg-[#DFB26E] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-3.5 h-3.5" />
              Record Dream
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-5 lg:px-10 py-8 lg:py-10">
        {isLoading ? (
          <div className="py-24 text-center text-sm font-mono text-[#9499A3]">
            Opening dream archive...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Sidebar: Dream Archive Index */}
            <aside
              aria-label="Dream Archive"
              className={`${
                isMobileArchiveOpen ? 'block' : 'hidden'
              } lg:block lg:col-span-3 lg:sticky lg:top-24 space-y-5`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h2 className="text-xs font-mono uppercase tracking-[0.16em] text-[#9499A3]">
                  Dream Archive
                </h2>
                <span className="text-xs font-mono tabular-nums text-[#7F8590]">
                  {dreams.length} entries
                </span>
              </div>

              {/* Mobile view tabs when drawer is open */}
              <div className="flex lg:hidden items-center gap-2 pb-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('journal');
                    setIsMobileArchiveOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    activeView === 'journal'
                      ? 'border-[#D4A359] text-[#EAE6DF]'
                      : 'border-white/10 text-[#9499A3]'
                  }`}
                >
                  Journal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('archetypes');
                    setIsMobileArchiveOpen(false);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border ${
                    activeView === 'archetypes'
                      ? 'border-[#D4A359] text-[#EAE6DF]'
                      : 'border-white/10 text-[#9499A3]'
                  }`}
                >
                  Archetypes
                </button>
              </div>

              <div className="space-y-2">
                {dreams.map((item) => {
                  const isActive =
                    activeView === 'journal' && activeDream?.id === item.id;
                  const shortDate = new Date(
                    item.recordedAt
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectDream(item.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors flex items-start gap-3.5 cursor-pointer ${
                        isActive
                          ? 'bg-[#161A22] border-[#D4A359]/45'
                          : 'bg-transparent border-white/[0.06] hover:bg-[#13161C] hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="w-14 h-12 rounded-md overflow-hidden bg-[#171A21] shrink-0 border border-white/[0.06]">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#5F6570]">
                            <BookOpen className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8C929D]">
                          <span className="text-[#D4A359]">
                            {item.accessionCode}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{shortDate}</span>
                        </div>
                        <p className="mt-0.5 font-serif text-base font-medium text-[#EAE6DF] truncate">
                          {item.interpretation.title}
                        </p>
                        <p className="text-xs text-[#8C929D] truncate">
                          {item.interpretation.moodTone}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Primary Canvas */}
            <main className="lg:col-span-9 min-w-0">
              {activeView === 'record' ? (
                <VoiceRecorderStudio
                  nextAccessionNumber={dreams.length + 1}
                  onDreamCreated={handleDreamCreated}
                  onCancel={() => setActiveView('journal')}
                />
              ) : activeView === 'archetypes' ? (
                <ArchetypeLexicon
                  dreams={dreams}
                  onSelectDream={handleSelectDream}
                />
              ) : activeDream ? (
                <DreamMonograph
                  dream={activeDream}
                  onUpdateDream={handleUpdateDream}
                  onDeleteDream={handleDeleteDream}
                />
              ) : (
                <VoiceRecorderStudio
                  nextAccessionNumber={1}
                  onDreamCreated={handleDreamCreated}
                />
              )}
            </main>
          </div>
        )}
      </div>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-white/[0.07] py-6 mt-12">
        <div className="max-w-[1440px] mx-auto px-5 lg:px-10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#7F8590]">
          <span className="font-serif text-sm text-[#9499A3]">
            Oniros — Personal Dream Monograph
          </span>
          <span>Entries stored locally in your browser archive</span>
        </div>
      </footer>
    </div>
  );
}
