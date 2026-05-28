// Cosine similarity + JSONB (de)serialization for CLIP embeddings.
//
// Both vectors are assumed to be L2-normalized (vision.ts.normalize ensures
// this on output), so cosine(a,b) reduces to dot(a,b).

export function cosine(a: Float32Array, b: number[] | Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: length mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * (b[i] as number);
  return dot;
}

/** Vector magnitude — handy for asserting normalization. */
export function magnitude(v: Float32Array | number[]): number {
  let m = 0;
  for (let i = 0; i < v.length; i++) m += (v[i] as number) * (v[i] as number);
  return Math.sqrt(m);
}

export function serializeEmbedding(v: Float32Array): number[] {
  return Array.from(v);
}

export function deserializeEmbedding(arr: number[]): Float32Array {
  return Float32Array.from(arr);
}
