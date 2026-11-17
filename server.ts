import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please ensure an API key is attached in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): {
  status: number;
  message: string;
  needsPaidKey: boolean;
} {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return {
      status: 403,
      message:
        'API key permission denied or invalid. Please check or select a valid Gemini API key in Settings > Secrets.',
      needsPaidKey: true,
    };
  }

  if (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  ) {
    return {
      status: 429,
      message:
        'Rate limit or quota reached for this model. Selecting a billing-enabled API key in Settings > Secrets increases quota and enables Pro image and deep reasoning models.',
      needsPaidKey: true,
    };
  }

  if (lower.includes('404') || lower.includes('not_found')) {
    return {
      status: 404,
      message: `Requested model was unavailable: ${rawMessage}`,
      needsPaidKey: false,
    };
  }

  return {
    status: 500,
    message: rawMessage || 'An unexpected Gemini API error occurred.',
    needsPaidKey: false,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', hasKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // 1. Transcribe spoken dream audio using gemini-3.5-transcribe
  app.post('/api/dreams/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };

      if (!audioBase64 || !mimeType) {
        return res
          .status(400)
          .json({ error: 'Both audioBase64 and mimeType are required.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this spoken dream recording faithfully and clearly. Preserve the speaker’s exact imagery, sensory details, emotions, and natural pacing without adding commentary.',
            },
          ],
        },
      });

      const transcript = (response.text ?? '').trim();
      if (!transcript) {
        return res.status(422).json({
          error:
            'No speech could be transcribed from the recording. Try speaking closer to the microphone or typing your dream below.',
        });
      }

      return res.json({ transcript });
    } catch (err) {
      console.error('Transcription error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({
        error: formatted.message,
        needsPaidKey: formatted.needsPaidKey,
      });
    }
  });

  // 2. Structured Jungian psychological interpretation & surrealist art prompt
  app.post('/api/dreams/interpret', async (req, res) => {
    try {
      const { transcript, depth } = req.body as {
        transcript?: string;
        depth?: 'standard' | 'deep';
      };

      if (!transcript || transcript.trim().length < 8) {
        return res.status(400).json({
          error: 'Please provide a dream narrative of at least a few words.',
        });
      }

      const model =
        depth === 'deep' ? 'gemini-4-carbon' : 'gemini-4-hydrogen';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model,
        contents: `Analyze this waking dream transcript and produce a structured Jungian psychological interpretation along with a fine-art surrealist image prompt representing its core emotional theme.\n\nDream transcript:\n"""\n${transcript.trim()}\n"""`,
        config: {
          systemInstruction:
            'You are a master Jungian analytical psychologist and surrealist art curator. Interpret dreams with depth, warmth, intellectual rigor, and poetic clarity. Avoid fortune-telling or superstition; ground every insight in recognized Jungian archetypes (such as The Shadow, Anima/Animus, The Self, The Wise Old Man/Woman, The Threshold Guardian, The Trickster, Persona, or Individuation), emotional resonance, and personal symbolism. For the surrealistPrompt, craft a museum-grade fine-art oil painting description inspired by Remedios Varo, Giorgio de Chirico, or Leonora Carrington that captures the dream’s core emotional theme visually without any text, letters, or watermarks.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description:
                  'A literary, evocative 2 to 5 word title for the dream monograph.',
              },
              emotionalTheme: {
                type: Type.STRING,
                description:
                  'One concise, resonant sentence describing the core emotional undercurrent of the dream.',
              },
              moodTone: {
                type: Type.STRING,
                description:
                  'A two-word emotional atmosphere label, e.g. "Liminal Awe" or "Quiet Grief".',
              },
              surrealistPrompt: {
                type: Type.STRING,
                description:
                  'A rich fine-art surrealist oil painting prompt representing the core emotional theme and key symbols of the dream, specifying lighting, texture, composition, and strictly no text or words.',
              },
              archetypalFramework: {
                type: Type.STRING,
                description:
                  'The psychological framework applied, e.g. "Jungian Analytical Psychology".',
              },
              coreSynthesis: {
                type: Type.STRING,
                description:
                  'A cohesive, two-paragraph psychological synthesis interpreting the dream narrative as a whole.',
              },
              archetypes: {
                type: Type.ARRAY,
                description: '2 to 4 recognized psychological archetypes active in the dream.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    archetype: {
                      type: Type.STRING,
                      description: 'Name of the recognized archetype, e.g. "The Shadow".',
                    },
                    manifestation: {
                      type: Type.STRING,
                      description: 'How this archetype specifically appeared in the dream.',
                    },
                    meaning: {
                      type: Type.STRING,
                      description: 'Its psychological significance in the dreamer’s psyche.',
                    },
                  },
                  required: ['archetype', 'manifestation', 'meaning'],
                },
              },
              symbols: {
                type: Type.ARRAY,
                description: '3 to 5 key dream symbols extracted from the transcript.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    symbol: {
                      type: Type.STRING,
                      description: 'The concrete symbol or motif, e.g. "Flooded Staircase".',
                    },
                    emotionalCharge: {
                      type: Type.STRING,
                      description: 'Brief 1 to 3 word emotional tone associated with this symbol.',
                    },
                    interpretation: {
                      type: Type.STRING,
                      description: 'Concise Jungian reading of this symbol.',
                    },
                  },
                  required: ['symbol', 'emotionalCharge', 'interpretation'],
                },
              },
              reflectionPrompts: {
                type: Type.ARRAY,
                description: '3 gentle, open-ended questions for waking contemplation.',
                items: {
                  type: Type.STRING,
                },
              },
            },
            required: [
              'title',
              'emotionalTheme',
              'moodTone',
              'surrealistPrompt',
              'archetypalFramework',
              'coreSynthesis',
              'archetypes',
              'symbols',
              'reflectionPrompts',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '{}').trim();
      const interpretation = JSON.parse(rawJson);

      return res.json({ interpretation, modelUsed: model });
    } catch (err) {
      console.error('Interpretation error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({
        error: formatted.message,
        needsPaidKey: formatted.needsPaidKey,
      });
    }
  });

  // 3. Generate surrealist artwork using gemini-3-pro-image-preview with 1K / 2K / 4K support
  app.post('/api/dreams/visualize', async (req, res) => {
    try {
      const { prompt, imageSize, aspectRatio } = req.body as {
        prompt?: string;
        imageSize?: '1K' | '2K' | '4K';
        aspectRatio?: '4:3' | '16:9' | '1:1';
      };

      if (!prompt || !prompt.trim()) {
        return res
          .status(400)
          .json({ error: 'A visual prompt is required to generate artwork.' });
      }

      const validSize =
        imageSize === '2K' || imageSize === '4K' ? imageSize : '1K';
      const validRatio =
        aspectRatio === '16:9' || aspectRatio === '1:1' ? aspectRatio : '4:3';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [
            {
              text: `${prompt.trim()} Fine art oil on linen canvas, museum gallery lighting, rich depth, no text, no signatures, no borders.`,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: validRatio,
            imageSize: validSize,
          },
        },
      });

      let imageDataUrl: string | null = null;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
          break;
        }
      }

      if (!imageDataUrl) {
        return res.status(502).json({
          error:
            'The image model did not return visual image data. Please try regenerating.',
        });
      }

      return res.json({
        imageDataUrl,
        imageSize: validSize,
        aspectRatio: validRatio,
        modelUsed: 'gemini-3-pro-image-preview',
      });
    } catch (err) {
      console.error('Image generation error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({
        error: formatted.message,
        needsPaidKey: formatted.needsPaidKey,
      });
    }
  });

  // 4. Multi-turn symbol dialogue chatbot with full conversation history & system instruction
  app.post('/api/dreams/chat', async (req, res) => {
    try {
      const { dreamContext, messages, userMessage, modelTier } = req.body as {
        dreamContext?: {
          title: string;
          transcript: string;
          emotionalTheme: string;
          coreSynthesis: string;
          archetypes: Array<{
            archetype: string;
            manifestation: string;
            meaning: string;
          }>;
          symbols: Array<{
            symbol: string;
            emotionalCharge: string;
            interpretation: string;
          }>;
        };
        messages?: Array<{ role: 'user' | 'model'; text: string }>;
        userMessage?: string;
        modelTier?: 'hydrogen' | 'argon' | 'carbon' | 'flash-lite';
      };

      if (!userMessage || !userMessage.trim()) {
        return res.status(400).json({ error: 'A message is required.' });
      }

      const modelMap: Record<string, string> = {
        hydrogen: 'gemini-4-hydrogen',
        argon: 'gemini-4-argon',
        carbon: 'gemini-4-carbon',
        'flash-lite': 'gemini-3.1-flash-lite',
      };
      const selectedModel =
        modelMap[modelTier ?? 'hydrogen'] ?? 'gemini-4-hydrogen';

      const contextSummary = dreamContext
        ? [
            `Dream Title: ${dreamContext.title}`,
            `Core Emotional Theme: ${dreamContext.emotionalTheme}`,
            `Transcript: """${dreamContext.transcript}"""`,
            `Synthesis: ${dreamContext.coreSynthesis}`,
            `Archetypes: ${dreamContext.archetypes
              .map((a) => `${a.archetype} (${a.manifestation}): ${a.meaning}`)
              .join(' | ')}`,
            `Symbols: ${dreamContext.symbols
              .map(
                (s) =>
                  `${s.symbol} [${s.emotionalCharge}]: ${s.interpretation}`
              )
              .join(' | ')}`,
          ].join('\n')
        : 'No specific dream context provided.';

      const systemInstruction = `You are a thoughtful, scholarly Jungian dream analyst and symbolic interlocutor inside Oniros, a personal dream monograph. Your role is to help the dreamer explore specific symbols, emotional resonances, and archetypal motifs from their dream through reflective dialogue.

Guidelines:
- Ground every response in the dreamer's actual dream transcript, symbols, and emotional theme provided below.
- Speak with calm, literary clarity—empathetic, insightful, and non-dogmatic. Offer possibilities ("This motif often invites...", "Notice how...") rather than rigid pronouncements.
- Encourage the dreamer to connect symbols back to their personal associations and waking inner life.
- Keep responses focused, well-structured, and around 120–240 words unless the user asks for an exhaustive breakdown.

Active Dream Dossier:
${contextSummary}`;

      const history = (messages ?? []).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const ai = getAiClient();
      const chat = ai.chats.create({
        model: selectedModel,
        config: {
          systemInstruction,
        },
        history,
      });

      const response = await chat.sendMessage({
        message: userMessage.trim(),
      });

      const reply = (response.text ?? '').trim();
      if (!reply) {
        return res
          .status(502)
          .json({ error: 'The model returned an empty reply.' });
      }

      return res.json({ reply, modelUsed: selectedModel });
    } catch (err) {
      console.error('Chat error:', err);
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({
        error: formatted.message,
        needsPaidKey: formatted.needsPaidKey,
      });
    }
  });

  const distIndex = path.resolve(__dirname, 'dist', 'index.html');
  const useDevVite =
    process.env.NODE_ENV === 'development' || !fs.existsSync(distIndex);

  if (useDevVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Oniros server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
