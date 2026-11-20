import React, { useState } from 'react';
import type {
  CameraMode,
  CarTelemetry,
  HandlingPresetId,
  LightingPresetId,
  StudioAudioTrack,
  StudioImageResult,
  StudioVideoResult,
  WorldSettings,
} from '../types';
import { LIGHTING_PRESETS } from '../game/lightingRig';

interface CreativeStudioDrawerProps {
  open: boolean;
  onClose: () => void;
  settings: WorldSettings;
  onUpdateSettings: (next: WorldSettings) => void;
  cameraMode: CameraMode;
  onSetCameraMode: (mode: CameraMode) => void;
  telemetry: CarTelemetry;
  onCapture3DSnapshot: () => string;
}

type StudioTab = 'tune' | 'copilot' | 'music' | 'image' | 'video';

const ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9'] as const;
const IMAGE_SIZES = ['1K', '2K', '4K'] as const;

export const CreativeStudioDrawer: React.FC<CreativeStudioDrawerProps> = ({
  open,
  onClose,
  settings,
  onUpdateSettings,
  cameraMode,
  onSetCameraMode,
  telemetry,
  onCapture3DSnapshot,
}) => {
  const [tab, setTab] = useState<StudioTab>('tune');

  // Low-Latency Co-Pilot state (gemini-3.1-flash-lite)
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotReply, setCopilotReply] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState('');

  // Lyria Music state
  const [musicPrompt, setMusicPrompt] = useState(
    'Warm sunset synthwave coastal cruising track, 104 BPM, lush analog pads, mellow electric guitar',
  );
  const [musicMode, setMusicMode] = useState<'clip' | 'pro'>('clip');
  const [musicUseSnapshot, setMusicUseSnapshot] = useState(false);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState('');
  const [musicTrack, setMusicTrack] = useState<StudioAudioTrack | null>(null);

  // Create & Edit Image state (gemini-nano-banana-2.1 & gemini-3-pro-image-preview)
  const [imageMode, setImageMode] = useState<'create' | 'edit'>('create');
  const [imagePrompt, setImagePrompt] = useState(
    'Editorial golden-hour automotive photograph of a vermilion GT sports coupe parked at a palm-lined coastal city intersection, reflective asphalt, dramatic sunset clouds',
  );
  const [imageModel, setImageModel] = useState<'gemini-3-pro-image-preview' | 'gemini-nano-banana-2.1'>(
    'gemini-nano-banana-2.1',
  );
  const [imageRatio, setImageRatio] = useState<string>('16:9');
  const [imageSize, setImageSize] = useState<string>('2K');
  const [editSourcePreview, setEditSourcePreview] = useState<string>('');
  const [editSourceBase64, setEditSourceBase64] = useState<string>('');
  const [editSourceMime, setEditSourceMime] = useState<string>('image/png');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [imageResult, setImageResult] = useState<StudioImageResult | null>(null);

  // Text-to-Video & Animate Image-to-Video state (gemini-omni-1.2-flash)
  const [videoMode, setVideoMode] = useState<'text' | 'animate'>('text');
  const [videoSourcePreview, setVideoSourcePreview] = useState<string>('');
  const [videoSourceBase64, setVideoSourceBase64] = useState<string>('');
  const [videoSourceMime, setVideoSourceMime] = useState<string>('image/png');
  const [videoPrompt, setVideoPrompt] = useState(
    'Smooth low tracking shot rolling past the sunset coastal intersection as palm trees sway in the ocean breeze and reflections glide across the asphalt.',
  );
  const [videoAspect, setVideoAspect] = useState<'16:9' | '9:16'>('16:9');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [videoResult, setVideoResult] = useState<StudioVideoResult | null>(null);

  if (!open) return null;

  const applyLightingPreset = (presetId: LightingPresetId) => {
    const p = LIGHTING_PRESETS[presetId];
    onUpdateSettings({
      ...settings,
      lightingPreset: presetId,
      sunElevation: p.sunElevation,
      fogDensity: p.fogDensity,
    });
  };

  const applyHandlingPreset = (handlingPreset: HandlingPresetId) => {
    onUpdateSettings({ ...settings, handlingPreset });
  };

  const handleCopilotSubmit = async (customPrompt?: string) => {
    const text = (customPrompt ?? copilotPrompt).trim();
    if (!text) {
      setCopilotError('Enter a question for the coastal co-pilot.');
      return;
    }
    setCopilotError('');
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          telemetry: {
            speedKmh: telemetry.speedKmh,
            topSpeedKmh: telemetry.topSpeedKmh,
            driftScore: telemetry.driftScore,
            lightingPreset: settings.lightingPreset,
            handlingPreset: settings.handlingPreset,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Co-pilot request failed.');
      setCopilotReply(data.reply);
      if (!customPrompt) setCopilotPrompt('');
    } catch (err) {
      setCopilotError(err instanceof Error ? err.message : 'Unable to reach co-pilot.');
    } finally {
      setCopilotLoading(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim()) {
      setMusicError('Describe the soundtrack mood or tempo.');
      return;
    }
    setMusicError('');
    setMusicLoading(true);
    try {
      let imageBase64: string | undefined;
      let imageMimeType: string | undefined;
      if (musicUseSnapshot) {
        const snap = onCapture3DSnapshot();
        const commaIdx = snap.indexOf(',');
        if (commaIdx > 0) {
          imageBase64 = snap.slice(commaIdx + 1);
          imageMimeType = 'image/png';
        }
      }
      const res = await fetch('/api/ai/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt.trim(),
          mode: musicMode,
          imageBase64,
          imageMimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music generation failed.');
      setMusicTrack(data);
    } catch (err) {
      setMusicError(err instanceof Error ? err.message : 'Music generation failed.');
    } finally {
      setMusicLoading(false);
    }
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx > 0) {
        setEditSourcePreview(dataUrl);
        setEditSourceBase64(dataUrl.slice(commaIdx + 1));
        setEditSourceMime(file.type || 'image/png');
        setImageError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSnap3DForImageEdit = () => {
    const dataUrl = onCapture3DSnapshot();
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      setEditSourcePreview(dataUrl);
      setEditSourceBase64(dataUrl.slice(commaIdx + 1));
      setEditSourceMime('image/png');
      setImageError('');
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      setImageError('Please enter a prompt or edit instruction.');
      return;
    }
    if (imageMode === 'edit' && !editSourceBase64) {
      setImageError('Upload a photo or click "Snap 3D View" to edit.');
      return;
    }
    setImageError('');
    setImageLoading(true);
    try {
      const res = await fetch('/api/ai/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imagePrompt.trim(),
          model: imageModel,
          aspectRatio: imageRatio,
          imageSize,
          sourceImageBase64: imageMode === 'edit' ? editSourceBase64 : undefined,
          sourceMimeType: imageMode === 'edit' ? editSourceMime : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed.');
      setImageResult(data);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setImageLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx > 0) {
        setVideoSourcePreview(dataUrl);
        setVideoSourceBase64(dataUrl.slice(commaIdx + 1));
        setVideoSourceMime(file.type || 'image/png');
        setVideoError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSnap3DForVideo = () => {
    const dataUrl = onCapture3DSnapshot();
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx > 0) {
      setVideoSourcePreview(dataUrl);
      setVideoSourceBase64(dataUrl.slice(commaIdx + 1));
      setVideoSourceMime('image/png');
      setVideoError('');
    }
  };

  const handleAnimateVideo = async () => {
    if (videoMode === 'animate' && !videoSourceBase64) {
      setVideoError('Upload a photo or click "Snap 3D View" first.');
      return;
    }
    if (videoMode === 'text' && !videoPrompt.trim()) {
      setVideoError('Enter a text prompt describing the video scene.');
      return;
    }
    setVideoError('');
    setVideoLoading(true);
    try {
      const res = await fetch('/api/ai/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: videoMode === 'animate' ? videoSourceBase64 : undefined,
          mimeType: videoMode === 'animate' ? videoSourceMime : undefined,
          prompt: videoPrompt.trim(),
          aspectRatio: videoAspect,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed.');
      setVideoResult(data);
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setVideoLoading(false);
    }
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(860px,95vw)] bg-[#19111f]/95 border border-[#ffb978]/45 shadow-[0_20px_56px_rgba(8,4,12,0.82)] text-[#fff4e8] pointer-events-auto"
      role="region"
      aria-label="Solstice Creative Studio & Live Tuner"
    >
      {/* Dock Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[#ffb978]/25 bg-[#22172a]">
        <div className="flex flex-wrap items-center gap-1" role="tablist">
          {(
            [
              ['tune', 'World & Physics'],
              ['copilot', 'Co-Pilot'],
              ['music', 'Music'],
              ['image', 'Image Studio'],
              ['video', 'Video Studio'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-mono-hud uppercase tracking-wider cursor-pointer transition-colors ${
                tab === id
                  ? 'bg-[#e85a32] text-[#fff8f0] font-bold'
                  : 'text-[#f3cfb2] hover:bg-[#31223b]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse studio dock"
          className="px-2.5 py-1 text-xs font-mono-hud uppercase tracking-wider text-[#ffb978] hover:text-[#fff6ec] border border-[#ffb978]/30 cursor-pointer"
        >
          Hide [T]
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-4 max-h-[46vh] overflow-y-auto">
        {tab === 'tune' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Lighting & Atmosphere Controls */}
            <div className="space-y-3">
              <div className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                Lighting &amp; Atmosphere
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['golden-sunset', 'Golden Sunset'],
                    ['twilight-dusk', 'Twilight Dusk'],
                    ['coastal-afternoon', 'Coastal Noon'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyLightingPreset(id)}
                    className={`py-2 px-2 text-[11px] font-mono-hud uppercase border cursor-pointer transition-colors ${
                      settings.lightingPreset === id
                        ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                        : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3] hover:bg-[#33233d]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="block">
                <div className="flex justify-between text-xs font-mono-hud text-[#f2d6be] mb-1">
                  <span>Sun Elevation</span>
                  <span>{settings.sunElevation.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={32}
                  step={0.5}
                  value={settings.sunElevation}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, sunElevation: Number(e.target.value) })
                  }
                  className="w-full solstice-slider"
                />
              </label>

              <label className="block">
                <div className="flex justify-between text-xs font-mono-hud text-[#f2d6be] mb-1">
                  <span>Road Reflective Sheen</span>
                  <span>{Math.round(settings.roadWetness * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.roadWetness}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, roadWetness: Number(e.target.value) })
                  }
                  className="w-full solstice-slider"
                />
              </label>

              <label className="block">
                <div className="flex justify-between text-xs font-mono-hud text-[#f2d6be] mb-1">
                  <span>Atmospheric Haze</span>
                  <span>{(settings.fogDensity * 1000).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.0012}
                  max={0.008}
                  step={0.0004}
                  value={settings.fogDensity}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, fogDensity: Number(e.target.value) })
                  }
                  className="w-full solstice-slider"
                />
              </label>
            </div>

            {/* Vehicle Physics & Camera Rig */}
            <div className="space-y-3">
              <div className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                Car Handling &amp; Camera Rig
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['grand-tourer', 'Grand Tourer'],
                    ['drift-spec', 'Drift Spec'],
                    ['track-grip', 'Track Grip'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyHandlingPreset(id)}
                    className={`py-2 px-2 text-[11px] font-mono-hud uppercase border cursor-pointer transition-colors ${
                      settings.handlingPreset === id
                        ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                        : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3] hover:bg-[#33233d]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <div className="text-xs font-mono-hud text-[#f2d6be] mb-1.5">Camera View [C]</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['chase', 'Chase Cam'],
                      ['hood', 'Hood Cam'],
                      ['orbit', 'Sunset Orbit'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSetCameraMode(id)}
                      className={`py-2 px-2 text-[11px] font-mono-hud uppercase border cursor-pointer transition-colors ${
                        cameraMode === id
                          ? 'bg-[#3c2b47] border-[#ffb978] text-[#fff8f0]'
                          : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3] hover:bg-[#33233d]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-[#e5c8b0]/85 leading-relaxed pt-1">
                Iterate directly on sunset elevation, coastal fog, asphalt specular sheen, and lateral
                drift grip while watching the live 3D intersection respond immediately behind this dock.
              </p>
            </div>
          </div>
        )}

        {tab === 'copilot' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                Low-Latency Coastal Co-Pilot · gemini-3.1-flash-lite
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Give me a clean drift tip for the main intersection.',
                  'Best lighting & road sheen setup for golden hour?',
                  'Rate my current driving telemetry.',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={copilotLoading}
                    onClick={() => void handleCopilotSubmit(q)}
                    className="px-2.5 py-1 text-[11px] bg-[#2a1d33] hover:bg-[#382745] border border-[#ffb978]/25 text-[#f7dcc4] cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCopilotSubmit();
              }}
              className="flex gap-2"
            >
              <label htmlFor="copilot-input" className="sr-only">
                Ask coastal co-pilot
              </label>
              <input
                id="copilot-input"
                type="text"
                value={copilotPrompt}
                onChange={(e) => setCopilotPrompt(e.target.value)}
                placeholder="Ask for drift tips, lighting tweaks, or coastal route ideas..."
                className="flex-1 px-3 py-2 bg-[#120c17] border border-[#ffb978]/35 text-sm text-[#fff6ec] placeholder:text-[#bfa395]"
              />
              <button
                type="submit"
                disabled={copilotLoading}
                className="px-4 py-2 bg-[#e85a32] hover:bg-[#f26b42] disabled:opacity-50 text-xs font-mono-hud font-bold uppercase tracking-wider text-[#fff8f0] cursor-pointer"
              >
                {copilotLoading ? 'Thinking...' : 'Ask'}
              </button>
            </form>

            {copilotError && (
              <div className="p-2.5 bg-[#3c1920] border border-[#ff7c6b]/50 text-xs text-[#ffd2cc]">
                {copilotError}
              </div>
            )}

            {copilotReply && (
              <div className="p-3 bg-[#24182d] border border-[#ffb978]/30 text-sm text-[#fff3e6] leading-relaxed">
                {copilotReply}
              </div>
            )}
          </div>
        )}

        {tab === 'music' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                Sunset Drive Radio Generator · Lyria 3
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMusicMode('clip')}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    musicMode === 'clip'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  30s Clip (lyria-3-clip-preview)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicMode('pro')}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    musicMode === 'pro'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  Full Track (lyria-3-pro-preview)
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="music-prompt" className="sr-only">
                Music prompt
              </label>
              <input
                id="music-prompt"
                type="text"
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#120c17] border border-[#ffb978]/35 text-sm text-[#fff6ec]"
              />
              <button
                type="button"
                disabled={musicLoading}
                onClick={() => void handleGenerateMusic()}
                className="px-4 py-2 bg-[#e85a32] hover:bg-[#f26b42] disabled:opacity-50 text-xs font-mono-hud font-bold uppercase tracking-wider text-[#fff8f0] cursor-pointer"
              >
                {musicLoading ? 'Composing...' : 'Generate Track'}
              </button>
            </div>

            <label className="inline-flex items-center gap-2 text-xs text-[#f2d6be] cursor-pointer">
              <input
                type="checkbox"
                checked={musicUseSnapshot}
                onChange={(e) => setMusicUseSnapshot(e.target.checked)}
                className="accent-[#e85a32]"
              />
              <span>Inspire music from current live 3D sunset viewport frame</span>
            </label>

            {musicError && (
              <div className="p-2.5 bg-[#3c1920] border border-[#ff7c6b]/50 text-xs text-[#ffd2cc]">
                {musicError}
              </div>
            )}

            {musicTrack && (
              <div className="p-3 bg-[#24182d] border border-[#ffb978]/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono-hud text-[#ffb978]">
                  <span>READY · {musicTrack.model}</span>
                </div>
                <audio controls src={musicTrack.audioDataUrl} className="w-full h-9" />
                {musicTrack.lyrics && (
                  <p className="text-xs text-[#f2d6be]/85 whitespace-pre-wrap max-h-24 overflow-y-auto">
                    {musicTrack.lyrics}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'image' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                  Create &amp; Edit Studio
                </span>
                <button
                  type="button"
                  onClick={() => setImageMode('create')}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    imageMode === 'create'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  Create New
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageMode('edit');
                    setImageModel('gemini-nano-banana-2.1');
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    imageMode === 'edit'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  Edit Photo
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-mono-hud text-[#f2d6be]">
                  <span>Model</span>
                  <select
                    value={imageModel}
                    onChange={(e) =>
                      setImageModel(
                        e.target.value as 'gemini-3-pro-image-preview' | 'gemini-nano-banana-2.1',
                      )
                    }
                    className="bg-[#120c17] border border-[#ffb978]/35 px-2 py-1 text-xs text-[#fff6ec]"
                  >
                    <option value="gemini-nano-banana-2.1">gemini-nano-banana-2.1</option>
                    <option value="gemini-3-pro-image-preview">gemini-3-pro-image-preview</option>
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-mono-hud text-[#f2d6be]">
                  <span>Size</span>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value)}
                    className="bg-[#120c17] border border-[#ffb978]/35 px-2 py-1 text-xs text-[#fff6ec]"
                  >
                    {IMAGE_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-1.5 text-xs font-mono-hud text-[#f2d6be]">
                  <span>Ratio</span>
                  <select
                    value={imageRatio}
                    onChange={(e) => setImageRatio(e.target.value)}
                    className="bg-[#120c17] border border-[#ffb978]/35 px-2 py-1 text-xs text-[#fff6ec]"
                  >
                    {ASPECT_RATIOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {imageMode === 'edit' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-3 py-1.5 bg-[#2a1d33] hover:bg-[#382745] border border-[#ffb978]/35 text-xs font-mono-hud uppercase tracking-wider text-[#fff2e3] cursor-pointer">
                  Upload Photo to Edit
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSnap3DForImageEdit}
                  className="px-3 py-1.5 bg-[#2a1d33] hover:bg-[#382745] border border-[#ffb978]/35 text-xs font-mono-hud uppercase tracking-wider text-[#ffb978] cursor-pointer"
                >
                  Snap 3D View
                </button>
                {editSourcePreview && (
                  <img
                    src={editSourcePreview}
                    alt="Source photo to edit"
                    className="h-10 w-auto border border-[#ffb978]/40 object-cover"
                  />
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="studio-image-prompt" className="sr-only">
                Studio image prompt
              </label>
              <input
                id="studio-image-prompt"
                type="text"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                placeholder={
                  imageMode === 'edit'
                    ? 'Describe edits: e.g. Add neon rain reflections and a dramatic purple sunset sky...'
                    : 'Describe the image to create...'
                }
                className="flex-1 px-3 py-2 bg-[#120c17] border border-[#ffb978]/35 text-sm text-[#fff6ec]"
              />
              <button
                type="button"
                disabled={imageLoading}
                onClick={() => void handleGenerateImage()}
                className="px-4 py-2 bg-[#e85a32] hover:bg-[#f26b42] disabled:opacity-50 text-xs font-mono-hud font-bold uppercase tracking-wider text-[#fff8f0] cursor-pointer"
              >
                {imageLoading
                  ? 'Rendering...'
                  : imageMode === 'edit'
                    ? 'Edit Image'
                    : 'Create Image'}
              </button>
            </div>

            {imageError && (
              <div className="p-2.5 bg-[#3c1920] border border-[#ff7c6b]/50 text-xs text-[#ffd2cc]">
                {imageError}
              </div>
            )}

            {imageResult && (
              <div className="p-3 bg-[#24182d] border border-[#ffb978]/30 flex flex-col sm:flex-row gap-3 items-start">
                <img
                  src={imageResult.imageUrl}
                  alt="Generated studio render"
                  className="max-h-44 w-auto border border-[#ffb978]/30 object-contain"
                />
                <div className="space-y-1.5 text-xs font-mono-hud text-[#f2d6be]">
                  <div>MODEL: {imageResult.model}</div>
                  <div>
                    OUTPUT: {imageResult.imageSize} · {imageResult.aspectRatio}
                  </div>
                  <a
                    href={imageResult.imageUrl}
                    download={`solstice-${imageResult.imageSize}-${imageResult.aspectRatio.replace(':', 'x')}.png`}
                    className="inline-block mt-2 px-3 py-1.5 bg-[#e85a32] text-[#fff8f0] uppercase tracking-wider"
                  >
                    Download PNG
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'video' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-hud text-[11px] uppercase tracking-[0.16em] text-[#ffb978]">
                  Video Studio · gemini-omni-1.2-flash
                </span>
                <button
                  type="button"
                  onClick={() => setVideoMode('text')}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    videoMode === 'text'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  Text to Video
                </button>
                <button
                  type="button"
                  onClick={() => setVideoMode('animate')}
                  className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                    videoMode === 'animate'
                      ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                      : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                  }`}
                >
                  Animate Photo
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {(['16:9', '9:16'] as const).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setVideoAspect(ar)}
                    className={`px-2.5 py-1 text-[11px] font-mono-hud uppercase border cursor-pointer ${
                      videoAspect === ar
                        ? 'bg-[#e85a32] border-[#ffd6a8] text-[#fff8f0]'
                        : 'bg-[#261a2e] border-[#ffb978]/25 text-[#f0cfb3]'
                    }`}
                  >
                    {ar === '16:9' ? '16:9 Landscape' : '9:16 Portrait'}
                  </button>
                ))}
              </div>
            </div>

            {videoMode === 'animate' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-3 py-1.5 bg-[#2a1d33] hover:bg-[#382745] border border-[#ffb978]/35 text-xs font-mono-hud uppercase tracking-wider text-[#fff2e3] cursor-pointer">
                  Upload Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSnap3DForVideo}
                  className="px-3 py-1.5 bg-[#2a1d33] hover:bg-[#382745] border border-[#ffb978]/35 text-xs font-mono-hud uppercase tracking-wider text-[#ffb978] cursor-pointer"
                >
                  Snap 3D View
                </button>

                {videoSourcePreview && (
                  <img
                    src={videoSourcePreview}
                    alt="Selected source photo"
                    className="h-10 w-auto border border-[#ffb978]/40 object-cover"
                  />
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="video-motion-prompt" className="sr-only">
                Video generation prompt
              </label>
              <input
                id="video-motion-prompt"
                type="text"
                value={videoPrompt}
                onChange={(e) => setVideoPrompt(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#120c17] border border-[#ffb978]/35 text-sm text-[#fff6ec]"
              />
              <button
                type="button"
                disabled={videoLoading}
                onClick={() => void handleAnimateVideo()}
                className="px-4 py-2 bg-[#e85a32] hover:bg-[#f26b42] disabled:opacity-50 text-xs font-mono-hud font-bold uppercase tracking-wider text-[#fff8f0] cursor-pointer"
              >
                {videoLoading
                  ? 'Generating...'
                  : videoMode === 'text'
                    ? 'Generate Video'
                    : 'Animate Photo'}
              </button>
            </div>

            {videoError && (
              <div className="p-2.5 bg-[#3c1920] border border-[#ff7c6b]/50 text-xs text-[#ffd2cc]">
                {videoError}
              </div>
            )}

            {videoResult && (
              <div className="p-3 bg-[#24182d] border border-[#ffb978]/30 space-y-2">
                <div className="font-mono-hud text-xs text-[#ffb978]">
                  VIDEO READY · {videoResult.aspectRatio}
                </div>
                <video
                  controls
                  autoPlay
                  loop
                  src={videoResult.videoUrl}
                  className="max-h-48 w-auto border border-[#ffb978]/30"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
