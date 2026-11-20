import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Open Settings > Secrets in AI Studio to attach an API key.',
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

function formatApiError(err: unknown): { status: number; error: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      error:
        'Quota or billing limit reached for this model. Attach a billing-enabled key in Settings > Secrets to use paid media models.',
    };
  }
  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid')) {
    return {
      status: 403,
      error:
        'API key invalid or lacks permission for this model. Check your key in Settings > Secrets.',
    };
  }
  return { status: 500, error: raw || 'Unexpected Gemini API error.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'solstice-drive' });
  });

  // 1. Low-Latency Co-Pilot (gemini-3.1-flash-lite)
  app.post('/api/ai/copilot', async (req, res) => {
    try {
      const { prompt, telemetry } = req.body as {
        prompt?: string;
        telemetry?: {
          speedKmh?: number;
          topSpeedKmh?: number;
          driftScore?: number;
          lightingPreset?: string;
          handlingPreset?: string;
        };
      };

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a message for the coastal co-pilot.' });
        return;
      }

      const ai = getAiClient();
      const contextLine = telemetry
        ? `Live car state: ${Math.round(telemetry.speedKmh ?? 0)} KM/H, Top Speed ${Math.round(
            telemetry.topSpeedKmh ?? 0,
          )} KM/H, Drift Score ${Math.round(telemetry.driftScore ?? 0)}, Lighting: ${
            telemetry.lightingPreset ?? 'golden-sunset'
          }, Handling: ${telemetry.handlingPreset ?? 'grand-tourer'}.`
        : '';

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `${contextLine}\nDriver asks: ${prompt.trim()}`,
        config: {
          systemInstruction:
            'You are the crisp, charismatic Sunset Coast Driving Co-Pilot & Tuning Engineer inside Solstice Drive, a 3D coastal city driving prototype. Respond concisely in 2-3 punchy sentences with practical driving, drift, lighting, or scenic route advice.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });

      res.json({
        reply: response.text ?? 'Clear roads ahead—keep the tires warm along Ocean Blvd.',
        model: 'gemini-3.1-flash-lite',
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  // 2. Music Generation (lyria-3-clip-preview | lyria-3-pro-preview)
  app.post('/api/ai/music', async (req, res) => {
    try {
      const { prompt, mode, imageBase64, imageMimeType } = req.body as {
        prompt?: string;
        mode?: 'clip' | 'pro';
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Please describe the soundtrack mood or tempo.' });
        return;
      }

      const ai = getAiClient();
      const model = mode === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

      const contents =
        imageBase64 && imageMimeType
          ? {
              parts: [
                { text: prompt.trim() },
                { inlineData: { data: imageBase64, mimeType: imageMimeType } },
              ],
            }
          : prompt.trim();

      const response = await ai.models.generateContentStream({
        model,
        contents,
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({ error: 'No audio stream was returned by Lyria.' });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics: lyrics.trim(),
        model,
        prompt: prompt.trim(),
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  // 3. High-Quality Image Generation + Aspect Ratio Control
  // Supports gemini-3-pro-image-preview (1K/2K/4K) and gemini-nano-banana-2.1
  const ALLOWED_RATIOS = new Set(['1:1', '2:3', '3:2', '3:4', '4:3', '9:16', '16:9', '21:9']);
  const ALLOWED_SIZES = new Set(['1K', '2K', '4K']);

  app.post('/api/ai/image', async (req, res) => {
    try {
      const { prompt, model, aspectRatio, imageSize } = req.body as {
        prompt?: string;
        model?: 'gemini-3-pro-image-preview' | 'gemini-nano-banana-2.1';
        aspectRatio?: string;
        imageSize?: string;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Please provide an image prompt.' });
        return;
      }

      const safeModel =
        model === 'gemini-nano-banana-2.1'
          ? 'gemini-nano-banana-2.1'
          : 'gemini-3-pro-image-preview';
      const safeRatio = aspectRatio && ALLOWED_RATIOS.has(aspectRatio) ? aspectRatio : '16:9';
      const safeSize = imageSize && ALLOWED_SIZES.has(imageSize) ? imageSize : '1K';

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: safeModel,
        contents: {
          parts: [{ text: prompt.trim() }],
        },
        config: {
          imageConfig: {
            aspectRatio: safeRatio,
            imageSize: safeSize,
          },
        },
      });

      let imageUrl = '';
      let caption = '';
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({ error: 'No image data was returned by the model.' });
        return;
      }

      res.json({
        imageUrl,
        caption: caption.trim(),
        model: safeModel,
        aspectRatio: safeRatio,
        imageSize: safeSize,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  // 4. Animate Photo into Video (gemini-omni-1.2-flash via Interactions API)
  app.post('/api/ai/video', async (req, res) => {
    try {
      const { imageBase64, mimeType, prompt, aspectRatio } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        prompt?: string;
        aspectRatio?: '16:9' | '9:16';
      };

      if (!imageBase64 || !mimeType) {
        res.status(400).json({ error: 'Please upload a photo or capture the 3D viewport first.' });
        return;
      }

      const safeRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
      const motionPrompt =
        prompt && prompt.trim()
          ? prompt.trim()
          : 'Smooth golden-hour cinematic tracking shot as palm trees sway and sunset light shimmers across the coastal avenue.';

      const ai = getAiClient();
      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: [
            {
              type: 'image',
              mime_type: mimeType,
              data: imageBase64,
            },
            {
              type: 'text',
              text: motionPrompt,
            },
          ],
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: safeRatio,
            duration: '6s',
            resolution: '720p',
          },
        } as never,
        { timeout: 300000 },
      );

      const videoPart = interaction.output_video;
      if (!videoPart || (!videoPart.data && !videoPart.uri)) {
        res.status(502).json({ error: 'No video output was returned by gemini-omni-1.2-flash.' });
        return;
      }

      const videoMime = videoPart.mime_type || 'video/mp4';
      const videoUrl = videoPart.data
        ? `data:${videoMime};base64,${videoPart.data}`
        : String(videoPart.uri);

      res.json({
        videoUrl,
        aspectRatio: safeRatio,
        prompt: motionPrompt,
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.error });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Solstice Drive server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
