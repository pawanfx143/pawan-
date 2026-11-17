export type ImageResolution = '1K' | '2K' | '4K';

export type ImageAspectRatio = '4:3' | '16:9' | '1:1';

export type ChatModelTier = 'hydrogen' | 'argon' | 'carbon' | 'flash-lite';

export type InterpretationDepth = 'standard' | 'deep';

export interface ArchetypeAnalysis {
  archetype: string;
  manifestation: string;
  meaning: string;
}

export interface DreamSymbol {
  symbol: string;
  emotionalCharge: string;
  interpretation: string;
}

export interface DreamInterpretation {
  title: string;
  emotionalTheme: string;
  moodTone: string;
  surrealistPrompt: string;
  archetypalFramework: string;
  coreSynthesis: string;
  archetypes: ArchetypeAnalysis[];
  symbols: DreamSymbol[];
  reflectionPrompts: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelTier?: ChatModelTier;
}

export interface DreamEntry {
  id: string;
  accessionCode: string;
  recordedAt: string;
  transcript: string;
  audioDataUrl?: string;
  audioDurationSeconds?: number;
  imageUrl?: string;
  imageResolution: ImageResolution;
  imageAspectRatio: ImageAspectRatio;
  interpretationDepth: InterpretationDepth;
  interpretation: DreamInterpretation;
  chatHistory: ChatMessage[];
  isCuratedSeed?: boolean;
}
