import { THEME_PRESETS } from '@/features/onboarding/data/constants';
import { cn } from '@/shared/lib/utils';

type ThemePickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export function ThemePicker({ value, onChange }: ThemePickerProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">Theme Color</span>
        <span className="text-xs text-gray-400">Matches storefront</span>
      </div>
      <div className="flex flex-wrap gap-2" role="listbox" aria-label="Theme color presets">
        {THEME_PRESETS.map((preset) => {
          const selected = value.toLowerCase() === preset.color.toLowerCase();
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={preset.label}
              onClick={() => onChange(preset.color)}
              className={cn(
                'h-9 w-9 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2',
                selected ? 'border-gray-900' : 'border-white shadow',
              )}
              style={{ backgroundColor: preset.color }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="theme-color" className="text-xs font-medium text-gray-600">
          Custom
        </label>
        <input
          id="theme-color"
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-gray-200 bg-white"
        />
        <span className="font-mono text-xs text-gray-500">{value}</span>
      </div>
    </div>
  );
}
