import { useId, useRef } from 'react';
import { cn } from '@/shared/lib/utils';

type ImageUploadBoxProps = {
  label: string;
  hint: string;
  aspect: 'square' | 'banner';
  value: string;
  onChange: (dataUrl: string) => void;
  pickLabel: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

export function ImageUploadBox({
  label,
  hint,
  aspect,
  value,
  onChange,
  pickLabel,
}: ImageUploadBoxProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={inputId}>
        {label}
      </label>
      <div
        className={cn(
          'relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50',
          aspect === 'square' ? 'aspect-square max-w-[10rem]' : 'aspect-video w-full',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center p-3 text-center">
            <span className="text-2xl" aria-hidden>
              {aspect === 'square' ? '🖼️' : '🏞️'}
            </span>
            <span className="mt-1 text-xs text-gray-500">{hint}</span>
          </div>
        )}
        {value ? (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
            onClick={() => onChange('')}
          >
            ✕
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
        onClick={() => inputRef.current?.click()}
      >
        {pickLabel}
      </button>
    </div>
  );
}
