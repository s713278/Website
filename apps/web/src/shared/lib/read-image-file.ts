const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

/** Read an image File as a data URL (shared by onboarding upload UIs). */
export function readImageFileAsDataUrl(
  file: File | undefined,
  options?: { maxBytes?: number },
): Promise<string | null> {
  if (!file || !file.type.startsWith('image/')) return Promise.resolve(null);
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  if (file.size > maxBytes) return Promise.resolve(null);

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '') || null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
