import React from 'react';
import { ARCHETYPE_LEXICON } from '../data/seedDreams';
import type { DreamEntry } from '../types/dream';

interface ArchetypeLexiconProps {
  dreams: DreamEntry[];
  onSelectDream: (dreamId: string) => void;
}

export const ArchetypeLexicon: React.FC<ArchetypeLexiconProps> = ({
  dreams,
  onSelectDream,
}) => {
  return (
    <section aria-label="Jungian Archetype Lexicon" className="space-y-10">
      <header className="pb-6 border-b border-white/[0.08]">
        <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#D4A359]">
          Analytical Reference
        </p>
        <h1 className="mt-2 font-serif text-4xl lg:text-5xl font-medium tracking-tight text-[#F3EFE8] text-balance">
          Lexicon of Jungian Archetypes
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#B9B3A8]">
          Recurring structural motifs of the collective unconscious, cross-referenced
          against the entries currently held in your personal archive.
        </p>
      </header>

      <div className="divide-y divide-white/[0.08] border-b border-white/[0.08]">
        {ARCHETYPE_LEXICON.map((entry, index) => {
          const keyword = entry.name
            .replace('The ', '')
            .split(' ')[0]
            .toLowerCase();
          const matchingDreams = dreams.filter((d) =>
            d.interpretation.archetypes.some((a) =>
              a.archetype.toLowerCase().includes(keyword)
            )
          );

          return (
            <div
              key={entry.name}
              className="py-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >
              <div className="lg:col-span-4">
                <span className="text-xs font-mono tabular-nums text-[#8C929D]">
                  0{index + 1}.
                </span>
                <h2 className="mt-1 font-serif text-2xl font-medium text-[#EAE6DF]">
                  {entry.name}
                </h2>
                <p className="mt-1 text-xs font-mono text-[#D4A359]">
                  {entry.latinOrRoot}
                </p>
              </div>

              <div className="lg:col-span-5">
                <p className="text-[15px] leading-[1.75] text-[#C9C3B8]">
                  {entry.description}
                </p>
              </div>

              <div className="lg:col-span-3">
                <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#8C929D] mb-2">
                  Present in Archive
                </p>
                {matchingDreams.length === 0 ? (
                  <p className="text-xs text-[#6B717D]">No recorded motifs yet</p>
                ) : (
                  <div className="flex flex-col items-start gap-1.5">
                    {matchingDreams.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => onSelectDream(d.id)}
                        className="text-left text-xs text-[#EAE6DF] hover:text-[#D4A359] underline decoration-white/20 underline-offset-4 transition-colors cursor-pointer"
                      >
                        {d.accessionCode} · {d.interpretation.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
