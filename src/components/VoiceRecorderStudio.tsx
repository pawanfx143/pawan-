import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  Upload,
  RotateCcw,
  ArrowRight,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import type {
  DreamEntry,
  DreamInterpretation,
  ImageAspectRatio,
  ImageResolution,
  InterpretationDepth,
} from '../types/dream';

interface VoiceRecorderStudioProps {
  nextAccessionNumber: number;
  onDreamCreated: (dream: DreamEntry) => void;
  onCancel?: () => void;
}

type StudioStage =
  | 'ready'
  | 'recording'
  | 'paused'
  | 'transcribing'
  | 'interpreting'
  | 'painting';

function formatTimer(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function blobToBase64(blob: Blob): Promise<{ base64: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
      resolve({ base64, dataUrl: result });
    };
    reader.onerror = () => reject(new Error('Failed to read audio buffer.'));
    reader.readAsDataURL(blob);
  });
}

export const VoiceRecorderStudio: React.FC<VoiceRecorderStudioProps> = ({
  nextAccessionNumber,
  onDreamCreated,
  onCancel,
}) => {
  const [stage, setStage] = useState<StudioStage>('ready');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [audioDataUrl, setAudioDataUrl] = useState<string | undefined>(undefined);
  const [recordedDuration, setRecordedDuration] = useState<number | undefined>(
    undefined
  );
  const [imageSize, setImageSize] = useState<ImageResolution>('1K');
  const [aspectRatio, setAspectRatio] = useState<ImageAspectRatio>('4:3');
  const [depth, setDepth] = useState<InterpretationDepth>('standard');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const stopMediaResources = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopMediaResources();
    };
  }, []);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyserRef.current) return;
      animFrameRef.current = window.requestAnimationFrame(render);
      analyserRef.current.getByteTimeDomainData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Subtle center baseline
      ctx.strokeStyle = 'rgba(234, 230, 223, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Active gold-brass acoustic wave
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#D4A359';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    render();
  };

  const transcribeAudioBlob = async (blob: Blob, durationSecs?: number) => {
    setStage('transcribing');
    setStatusDetail('Transcribing spoken dream recording...');
    setErrorMsg(null);

    try {
      const { base64, dataUrl } = await blobToBase64(blob);
      setAudioDataUrl(dataUrl);
      if (durationSecs !== undefined) {
        setRecordedDuration(durationSecs);
      }

      const mimeType = blob.type ? blob.type.split(';')[0] : 'audio/webm';

      const res = await fetch('/api/dreams/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not transcribe audio.');
      }

      setTranscript((prev) =>
        prev.trim() ? `${prev.trim()}\n\n${data.transcript}` : data.transcript
      );
      setStage('ready');
      setStatusDetail('');
    } catch (err) {
      setStage('ready');
      setStatusDetail('');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Transcription failed. You can also type or edit your dream below.'
      );
    }
  };

  const startRecording = async () => {
    setErrorMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(
        'Microphone recording is not supported in this browser. Upload an audio file or type your dream directly.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalDuration = elapsedRef.current;
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stopMediaResources();
        if (blob.size > 0) {
          void transcribeAudioBlob(blob, finalDuration);
        } else {
          setStage('ready');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      setElapsedSeconds(0);
      elapsedRef.current = 0;
      setStage('recording');

      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);

      drawWaveform();
    } catch (err) {
      stopMediaResources();
      setStage('ready');
      setErrorMsg(
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access or upload an audio clip.'
          : 'Unable to access microphone. You can upload an audio recording or write your dream below.'
      );
    }
  };

  const togglePause = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStage('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      setStage('recording');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      stopMediaResources();
      setStage('ready');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await transcribeAudioBlob(file);
  };

  const handleAnalyzeAndVisualize = async () => {
    const trimmed = transcript.trim();
    if (trimmed.length < 12) {
      setErrorMsg(
        'Speak or write a bit more about your dream (at least a full sentence) before generating an interpretation.'
      );
      return;
    }

    setErrorMsg(null);
    setStage('interpreting');
    setStatusDetail(
      depth === 'deep'
        ? 'Conducting deep Jungian archetypal synthesis...'
        : 'Analyzing symbols and emotional themes...'
    );

    try {
      const interpretRes = await fetch('/api/dreams/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trimmed, depth }),
      });
      const interpretData = await interpretRes.json();
      if (!interpretRes.ok) {
        throw new Error(
          interpretData.error || 'Failed to interpret the dream.'
        );
      }

      const interpretation: DreamInterpretation = interpretData.interpretation;

      // Step 2: Generate surrealist artwork representing the core emotional theme
      setStage('painting');
      setStatusDetail(
        `Painting ${imageSize} surrealist plate with Gemini Pro Image...`
      );

      let generatedImageUrl: string | undefined;
      let paintWarning: string | null = null;

      try {
        const visualRes = await fetch('/api/dreams/visualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: interpretation.surrealistPrompt,
            imageSize,
            aspectRatio,
          }),
        });
        const visualData = await visualRes.json();
        if (!visualRes.ok) {
          paintWarning =
            visualData.error || 'Artwork generation returned an error.';
        } else {
          generatedImageUrl = visualData.imageDataUrl;
        }
      } catch (imgErr) {
        paintWarning =
          imgErr instanceof Error
            ? imgErr.message
            : 'Artwork generation failed.';
      }

      const newDream: DreamEntry = {
        id: `dream-${Date.now()}`,
        accessionCode: `NO. ${String(nextAccessionNumber).padStart(2, '0')}`,
        recordedAt: new Date().toISOString(),
        transcript: trimmed,
        audioDataUrl,
        audioDurationSeconds: recordedDuration,
        imageUrl: generatedImageUrl,
        imageResolution: imageSize,
        imageAspectRatio: aspectRatio,
        interpretationDepth: depth,
        interpretation,
        chatHistory: [],
      };

      onDreamCreated(newDream);
      if (paintWarning) {
        setErrorMsg(
          `Dream archived with psychological interpretation, though artwork generation noted: ${paintWarning}`
        );
      }
      setStage('ready');
      setStatusDetail('');
    } catch (err) {
      setStage('ready');
      setStatusDetail('');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'An error occurred while interpreting your dream.'
      );
    }
  };

  const isBusy =
    stage === 'transcribing' ||
    stage === 'interpreting' ||
    stage === 'painting';
  const isRecordingOrPaused = stage === 'recording' || stage === 'paused';

  return (
    <section
      aria-label="Morning Dream Capture Studio"
      className="bg-[#14171D] border border-white/[0.08] rounded-xl p-6 lg:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-white/[0.07]">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-[#D4A359]">
            Waking Capture Studio
          </p>
          <h2 className="mt-1.5 font-serif text-3xl lg:text-4xl font-medium tracking-tight text-[#EAE6DF] text-balance">
            Speak your dream before it fades
          </h2>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#9499A3] hover:text-[#EAE6DF] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Close
          </button>
        )}
      </div>

      {/* Acoustic Capture Bar */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-5 flex flex-wrap items-center gap-3">
          {!isRecordingOrPaused ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={startRecording}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg bg-[#D4A359] text-[#0D0F13] font-semibold text-sm hover:bg-[#DFB26E] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              Record Voice
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={togglePause}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#1E232D] text-[#EAE6DF] border border-white/15 font-medium text-sm hover:bg-[#262C38] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {stage === 'paused' ? (
                  <>
                    <Play className="w-4 h-4 text-[#D4A359]" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 text-[#D4A359]" />
                    Pause
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#EAE6DF] text-[#0D0F13] font-semibold text-sm hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop & Transcribe
              </button>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={isBusy || isRecordingOrPaused}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-white/[0.1] text-[#C8C3B9] hover:text-[#EAE6DF] hover:border-white/20 disabled:opacity-40 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Upload Audio
          </button>
        </div>

        {/* Live Waveform & Timer */}
        <div className="lg:col-span-7 flex items-center gap-4 bg-[#0E1015] border border-white/[0.06] rounded-lg px-4 py-2.5">
          <div className="shrink-0 flex items-center gap-2.5 min-w-[78px]">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                stage === 'recording'
                  ? 'bg-[#D4A359] animate-pulse'
                  : stage === 'paused'
                    ? 'bg-[#9499A3]'
                    : 'bg-white/15'
              }`}
            />
            <span className="font-mono text-sm tabular-nums text-[#EAE6DF]">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            width={520}
            height={44}
            className="w-full h-11 block"
          />
        </div>
      </div>

      {/* Transcript Editor */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <label
            htmlFor="dream-transcript-input"
            className="text-xs font-medium uppercase tracking-[0.14em] text-[#9499A3]"
          >
            Dream Narrative & Sensory Fragments
          </label>
          {transcript && !isBusy && (
            <button
              type="button"
              onClick={() => {
                setTranscript('');
                setAudioDataUrl(undefined);
                setRecordedDuration(undefined);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#9499A3] hover:text-[#EAE6DF] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Text
            </button>
          )}
        </div>
        <textarea
          id="dream-transcript-input"
          rows={5}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={stage === 'transcribing' || isBusy}
          placeholder="Your spoken dream will appear here after transcription—or begin typing fragments immediately upon waking (settings, figures, objects, shifting weather, emotional tone)..."
          className="w-full bg-[#0D0F13] border border-white/[0.09] focus:border-[#D4A359]/60 focus:outline-none rounded-lg px-4 py-3.5 text-[15px] leading-relaxed text-[#EAE6DF] placeholder:text-[#5F6570] resize-y transition-colors"
        />
      </div>

      {/* Audio Preview if recorded */}
      {audioDataUrl && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-[#0D0F13] border border-white/[0.06] rounded-lg">
          <span className="text-xs font-mono text-[#9499A3]">
            Captured voice note{' '}
            {recordedDuration !== undefined
              ? `· ${formatTimer(recordedDuration)}`
              : ''}
          </span>
          <audio
            controls
            src={audioDataUrl}
            className="h-8 max-w-full opacity-90"
          />
        </div>
      )}

      {/* Configuration Controls: Image Resolution (1K / 2K / 4K), Aspect Ratio, Reasoning Depth */}
      <div className="mt-6 pt-6 border-t border-white/[0.07] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6">
          {/* Mandatory 1K / 2K / 4K Resolution Selector */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-[0.14em] text-[#9499A3] mb-2">
              Surrealist Plate Size
            </span>
            <div
              role="group"
              aria-label="Image resolution"
              className="inline-flex items-center p-1 bg-[#0D0F13] border border-white/[0.08] rounded-lg"
            >
              {(['1K', '2K', '4K'] as ImageResolution[]).map((size) => (
                <button
                  key={size}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setImageSize(size)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    imageSize === size
                      ? 'bg-[#D4A359] text-[#0D0F13] font-medium'
                      : 'text-[#9499A3] hover:text-[#EAE6DF]'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-[0.14em] text-[#9499A3] mb-2">
              Canvas Frame
            </span>
            <div
              role="group"
              aria-label="Image aspect ratio"
              className="inline-flex items-center p-1 bg-[#0D0F13] border border-white/[0.08] rounded-lg"
            >
              {(['4:3', '16:9', '1:1'] as ImageAspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setAspectRatio(ratio)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    aspectRatio === ratio
                      ? 'bg-[#232833] text-[#EAE6DF] font-medium'
                      : 'text-[#9499A3] hover:text-[#EAE6DF]'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Psychological Analysis Model Depth */}
          <div>
            <span className="block text-[11px] font-mono uppercase tracking-[0.14em] text-[#9499A3] mb-2">
              Analysis Depth
            </span>
            <div
              role="group"
              aria-label="Psychological analysis depth"
              className="inline-flex items-center p-1 bg-[#0D0F13] border border-white/[0.08] rounded-lg"
            >
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setDepth('standard')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  depth === 'standard'
                    ? 'bg-[#232833] text-[#EAE6DF]'
                    : 'text-[#9499A3] hover:text-[#EAE6DF]'
                }`}
              >
                Standard · Hydrogen
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setDepth('deep')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  depth === 'deep'
                    ? 'bg-[#232833] text-[#EAE6DF]'
                    : 'text-[#9499A3] hover:text-[#EAE6DF]'
                }`}
              >
                Deep · Carbon
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={isBusy || isRecordingOrPaused || transcript.trim().length < 8}
          onClick={handleAnalyzeAndVisualize}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-[#EAE6DF] text-[#0D0F13] hover:bg-white disabled:opacity-40 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusDetail || 'Processing...'}
            </>
          ) : (
            <>
              Interpret & Paint Dream
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-[#231617] border border-[#9A3E43]/45 text-sm text-[#F2D5D6]"
        >
          <AlertCircle className="w-4 h-4 text-[#E07A7F] shrink-0 mt-0.5" />
          <p className="leading-relaxed">{errorMsg}</p>
        </div>
      )}
    </section>
  );
};
