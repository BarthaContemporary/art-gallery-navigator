
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { CollectionWebsite, UpdateCollectionWebsitePayload } from '@/types/collection-website';

const editWebsiteSchema = z.object({
  name: z.string().transform(val => val.trim() === "" ? null : val.trim()).nullable().optional(),
  password: z.string().optional(),
  show_prices: z.boolean(),
  is_active: z.boolean(),
});

type EditWebsiteFormValues = z.infer<typeof editWebsiteSchema>;

interface EditCollectionWebsiteFormProps {
  website: CollectionWebsite;
  onSubmit: (data: UpdateCollectionWebsitePayload) => void;
  isPending: boolean;
  onCancel: () => void;
}

export function EditCollectionWebsiteForm({ website, onSubmit, isPending, onCancel }: EditCollectionWebsiteFormProps) {
  const form = useForm<EditWebsiteFormValues>({
    resolver: zodResolver(editWebsiteSchema),
    defaultValues: {
      name: website.name || '',
      password: '', // Always start empty for password, user must re-type to change
      show_prices: website.show_prices,
      is_active: website.is_active,
    },
  });

  const handleSubmit = (values: EditWebsiteFormValues) => {
    const payload: UpdateCollectionWebsitePayload = {
      id: website.id,
      collection_id: website.collection_id,
      name: values.name,
      show_prices: values.show_prices,
      is_active: values.is_active,
    };

    if (form.formState.dirtyFields.password) {
      payload.password = values.password === '' ? null : values.password;
    }
    // If password was not touched (not in dirtyFields), it remains undefined in payload, so hook won't update it.

    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website Name</FormLabel>
              <FormControl>
                <Input placeholder="Optional website name" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormDescription>If left empty, the website slug will be used as its display name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password (optional)</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder="Leave blank to keep current or no password" 
                  autoComplete="new-password"
                  spellCheck="false"
                  autoCapitalize="off"
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Enter a new password to set or change it. Enter an empty string and submit (if field was touched) to remove password protection.
                If you don't want to change the password, leave this field untouched.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="show_prices"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Show Prices</FormLabel>
                <FormDescription>
                  Display artwork prices on the public website.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Website Active</FormLabel>
                <FormDescription>
                  Make this website publicly accessible via its link.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
