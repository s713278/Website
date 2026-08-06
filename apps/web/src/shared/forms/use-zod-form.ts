import type { FieldValues, UseFormProps } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';

export function useZodForm<TSchema extends ZodType<FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<TSchema['_input']>, 'resolver'>,
) {
  return useForm<TSchema['_input']>({
    ...options,
    resolver: zodResolver(schema),
  });
}
