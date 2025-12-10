import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CRMContact } from "@/types/crm";

interface MergeParams {
  masterId: string;
  duplicateIds: string[];
}

export function useMergeContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ masterId, duplicateIds }: MergeParams) => {
      // Fetch all contacts to merge
      const { data: contacts, error: fetchError } = await supabase
        .from("crm_contacts")
        .select("*")
        .in("id", [masterId, ...duplicateIds]);

      if (fetchError) throw fetchError;
      if (!contacts || contacts.length === 0) throw new Error("Contacts not found");

      const master = contacts.find((c) => c.id === masterId);
      if (!master) throw new Error("Master contact not found");

      const duplicates = contacts.filter((c) => c.id !== masterId);

      // Merge data - fill empty fields from duplicates
      const mergedData: Partial<CRMContact> = {};
      const fieldsToMerge = [
        "phone", "secondary_phone", "secondary_email",
        "address_line1", "address_line2", "city", "state", "postal_code", "country",
        "instagram_handle", "linkedin_handle", "whatsapp_number", "line_id", "wechat_id",
        "job_title", "notes", "source"
      ] as const;

      for (const field of fieldsToMerge) {
        if (!master[field]) {
          for (const dup of duplicates) {
            if (dup[field]) {
              (mergedData as any)[field] = dup[field];
              break;
            }
          }
        }
      }

      // Merge tags
      const allTags = new Set<string>(master.tags || []);
      for (const dup of duplicates) {
        if (dup.tags) {
          for (const tag of dup.tags) {
            allTags.add(tag);
          }
        }
      }
      if (allTags.size > 0) {
        mergedData.tags = Array.from(allTags);
      }

      // Merge interested artists
      const allArtists = new Set<string>(master.interested_artists || []);
      for (const dup of duplicates) {
        if (dup.interested_artists) {
          for (const artist of dup.interested_artists) {
            allArtists.add(artist);
          }
        }
      }
      if (allArtists.size > 0) {
        mergedData.interested_artists = Array.from(allArtists);
      }

      // Update master with merged data
      if (Object.keys(mergedData).length > 0) {
        const { error: updateError } = await supabase
          .from("crm_contacts")
          .update(mergedData)
          .eq("id", masterId);

        if (updateError) throw updateError;
      }

      // Update list memberships to point to master
      const { error: listError } = await supabase
        .from("crm_list_members")
        .update({ contact_id: masterId })
        .in("contact_id", duplicateIds);

      if (listError) throw listError;

      // Delete duplicates
      const { error: deleteError } = await supabase
        .from("crm_contacts")
        .delete()
        .in("id", duplicateIds);

      if (deleteError) throw deleteError;

      return { merged: duplicateIds.length };
    },
    onSuccess: (data) => {
      toast.success(`Merged ${data.merged} duplicate(s)`);
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-duplicate-contacts"] });
    },
    onError: (error) => {
      toast.error(`Failed to merge: ${error.message}`);
    },
  });
}

export function useBulkMergeAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("bulk_merge_duplicate_contacts" as any);
      
      if (error) throw error;
      return data?.[0] || { groups_processed: 0, contacts_deleted: 0 };
    },
    onSuccess: (data) => {
      toast.success(`Merged ${data.groups_processed} groups, removed ${data.contacts_deleted} duplicates`);
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["crm-duplicate-contacts"] });
    },
    onError: (error) => {
      toast.error(`Failed to bulk merge: ${error.message}`);
    },
  });
}
