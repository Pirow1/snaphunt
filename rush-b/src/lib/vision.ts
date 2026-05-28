// Pillar 1 — on-device CLIP image embeddings via @huggingface/transformers.
//
// Strategy (spec §9.2):
//   1. Try WebGPU + q8-quantized model (~200-1200ms / encode, ~87MB download).
//   2. On failure, fall back to WASM (slower but universal).
//
// Spec departure: spec says dtype 'q4' / ~85MB, but Xenova/clip-vit-base-patch16
// on HF only ships fp32/fp16/quantized. dtype 'q8' maps to vision_model_quantized.onnx
// (87MB int8) — matches the spec's intended size, just under a different name.
//
// The model + processor are cached at module scope; initVision() is
// idempotent and safe to call concurrently.

import {
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
  type PreTrainedModel,
  type Processor,
  type Tensor,
} from '@huggingface/transformers';

// Keep models off the local FS cache (we're a browser PWA, not a Node app)
// and use the browser's HTTP cache for ONNX assets.
env.allowLocalModels = false;
env.useBrowserCache = true;

// ORT WASM multithreading needs SharedArrayBuffer, which needs COOP/COEP
// headers. We set those in vite.config.ts (credentialless) but Playwright
// headless / older browsers still trip on threading init. Pin to a single
// worker so the WASM fallback runs reliably everywhere; ~1-2s per encode
// on CPU, which is good enough for the borderline-only cloud-escalation
// path. WebGPU isn't affected — it doesn't use the WASM backend.
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

type ProgressInfo =
  | { status: 'initiate'; file?: string; name?: string }
  | { status: 'download'; file?: string; name?: string }
  | { status: 'progress'; file?: string; name?: string; progress?: number; loaded?: number; total?: number }
  | { status: 'done'; file?: string; name?: string }
  | { status: 'ready'; name?: string; task?: string };

export type VisionDevice = 'webgpu' | 'wasm';

const MODEL_ID = 'Xenova/clip-vit-base-patch16';

let processor: Processor | null = null;
let model: PreTrainedModel | null = null;
let device: VisionDevice | null = null;
let loadPromise: Promise<VisionDevice> | null = null;

export function getActiveDevice(): VisionDevice | null {
  return device;
}

export function isVisionReady(): boolean {
  return !!model && !!processor;
}

export async function initVision(onProgress?: (pct: number) => void): Promise<VisionDevice> {
  if (model && processor && device) return device;
  if (loadPromise) return loadPromise;

  const onCb = (info: unknown) => {
    const i = info as ProgressInfo;
    if (i?.status === 'progress' && onProgress) {
      onProgress(Math.round(i.progress ?? 0));
    }
  };

  loadPromise = (async (): Promise<VisionDevice> => {
    try {
      processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: onCb });
      model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'webgpu',
        progress_callback: onCb,
      });
      device = 'webgpu';
      onProgress?.(100);
      return 'webgpu';
    } catch (err) {
      console.warn('[vision] WebGPU init failed, falling back to WASM', err);
      // fp32 on WASM is the most-supported path. Larger (~345MB) but reliable.
      // q8 + WASM hangs on session-create in some headless / older browsers.
      processor = await AutoProcessor.from_pretrained(MODEL_ID, { progress_callback: onCb });
      console.log('[vision] WASM: starting session create with fp32…');
      model = await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: onCb,
      });
      console.log('[vision] WASM: session created');
      device = 'wasm';
      onProgress?.(100);
      return 'wasm';
    }
  })();

  return loadPromise;
}

/**
 * Encodes an image into an L2-normalized 512-dim float embedding.
 * Throws if initVision() has not completed.
 */
export async function encodeImage(input: Blob | string): Promise<Float32Array> {
  if (!model || !processor) {
    throw new Error('Vision not initialized. Call initVision() first.');
  }
  const image = await RawImage.read(input);
  const inputs = await processor(image);
  const out = (await model(inputs)) as { image_embeds: Tensor };
  const raw = out.image_embeds.data as Float32Array;
  return normalize(raw);
}

function normalize(v: Float32Array): Float32Array {
  let mag = 0;
  for (let i = 0; i < v.length; i++) mag += v[i]! * v[i]!;
  mag = Math.sqrt(mag);
  if (mag === 0) return v;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! / mag;
  return out;
}
