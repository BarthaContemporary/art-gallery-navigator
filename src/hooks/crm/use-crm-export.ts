import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMContact } from "@/types/crm";
import { toast } from "sonner";

interface ExportOptions {
  sourceType: 'list' | 'campaign' | 'contacts';
  sourceId?: string;
  sourceName?: string;
  contacts: CRMContact[];
  includeFields?: string[];
}

export function useExportToCSV() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceType, sourceId, sourceName, contacts, includeFields }: ExportOptions) => {
      const { data: userData } = await supabase.auth.getUser();

      // Define default fields to export
      const defaultFields = [
        'full_name',
        'email',
        'phone',
        'job_title',
        'contact_type',
        'tags',
        'instagram_handle',
        'linkedin_handle',
        'whatsapp_number',
        'line_id',
        'wechat_id',
        'city',
        'country',
        'notes',
      ];

      const fieldsToExport = includeFields || defaultFields;

      // Create CSV header
      const header = fieldsToExport.join(',');

      // Create CSV rows
      const rows = contacts.map(contact => {
        return fieldsToExport.map(field => {
          const value = contact[field as keyof CRMContact];
          if (value === null || value === undefined) return '';
          if (Array.isArray(value)) return `"${value.join('; ')}"`;
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',');
      });

      const csv = [header, ...rows].join('\n');

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${sourceName || 'contacts'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log export history
      await supabase
        .from('crm_export_history')
        .insert({
          export_type: 'csv',
          source_type: sourceType,
          source_id: sourceId,
          source_name: sourceName,
          record_count: contacts.length,
          exported_by: userData.user?.id,
        });

      return { recordCount: contacts.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-export-history'] });
      toast.success(`Exported ${data.recordCount} contacts to CSV`);
    },
    onError: (error) => {
      toast.error('Failed to export: ' + error.message);
    },
  });
}

export function useExportToGoogleContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceType, sourceId, sourceName, contacts }: ExportOptions) => {
      const { data: userData } = await supabase.auth.getUser();

      // Create Google Contacts compatible CSV
      const header = [
        'Name',
        'Given Name',
        'Family Name',
        'E-mail 1 - Type',
        'E-mail 1 - Value',
        'Phone 1 - Type',
        'Phone 1 - Value',
        'Organization 1 - Name',
        'Organization 1 - Title',
        'Notes',
      ].join(',');

      const rows = contacts.map(contact => {
        const nameParts = contact.full_name.split(' ');
        const firstName = contact.first_name || nameParts[0] || '';
        const lastName = contact.last_name || nameParts.slice(1).join(' ') || '';

        return [
          `"${contact.full_name}"`,
          `"${firstName}"`,
          `"${lastName}"`,
          'Work',
          contact.email || '',
          'Mobile',
          contact.phone || '',
          contact.organization?.name || '',
          contact.job_title || '',
          `"${(contact.notes || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

      const csv = [header, ...rows].join('\n');

      // Create blob and download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `google_contacts_${sourceName || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Log export history
      await supabase
        .from('crm_export_history')
        .insert({
          export_type: 'google_contacts',
          source_type: sourceType,
          source_id: sourceId,
          source_name: sourceName,
          record_count: contacts.length,
          exported_by: userData.user?.id,
        });

      return { recordCount: contacts.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-export-history'] });
      toast.success(`Exported ${data.recordCount} contacts for Google Contacts`);
    },
    onError: (error) => {
      toast.error('Failed to export: ' + error.message);
    },
  });
}

export function useCRMExportHistory(sourceType?: string, sourceId?: string) {
  return useQueryClient().fetchQuery({
    queryKey: ['crm-export-history', sourceType, sourceId],
    queryFn: async () => {
      let query = supabase
        .from('crm_export_history')
        .select('*')
        .order('exported_at', { ascending: false })
        .limit(20);

      if (sourceType) {
        query = query.eq('source_type', sourceType);
      }
      if (sourceId) {
        query = query.eq('source_id', sourceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
