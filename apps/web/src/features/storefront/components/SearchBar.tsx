import { Search } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search products…',
}: SearchBarProps) {
  return (
    <label className="relative block">
      <span className="sr-only">Search products</span>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-10"
        autoComplete="off"
      />
    </label>
  );
}
