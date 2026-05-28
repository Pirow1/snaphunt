import imageCompression from 'browser-image-compression';

// Compress a photo to ≤ 0.5MB JPEG at ≤ 1024px on the long edge. Output is a
// Blob (the lib returns a File subclass, both work for upload + RawImage).
export async function compressedPhoto(input: File | Blob): Promise<File> {
  const asFile =
    input instanceof File
      ? input
      : new File([input], 'photo.jpg', { type: input.type || 'image/jpeg' });
  return await imageCompression(asFile, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1024,
    fileType: 'image/jpeg',
    useWebWorker: true,
    initialQuality: 0.85,
  });
}
