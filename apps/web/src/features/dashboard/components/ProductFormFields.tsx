import type { UseFormReturn } from 'react-hook-form';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import type { ProductFormValues } from '@/features/dashboard/schemas/product-schema';

type Props = {
  form: UseFormReturn<ProductFormValues>;
};

export function ProductFormFields({ form }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="product-name">Name</Label>
        <Input id="product-name" {...form.register('name')} />
        {form.formState.errors.name ? (
          <p className="text-xs font-semibold text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-category">Category</Label>
        <Input id="product-category" {...form.register('category')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-sku">SKU</Label>
        <Input id="product-sku" {...form.register('sku')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-price">Price (₹)</Label>
        <Input id="product-price" type="number" {...form.register('price')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="product-stock">Stock</Label>
        <Input id="product-stock" type="number" {...form.register('stock')} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="product-status">Status</Label>
        <select
          id="product-status"
          className="flex h-11 w-full rounded-xl border border-input bg-white px-3 text-sm"
          {...form.register('status')}
        >
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>
    </div>
  );
}
