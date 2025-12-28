import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMContactOrganization, CRMOrganization, CRMContact } from "@/types/crm";
import { toast } from "sonner";

// Get all organizations for a contact
export function useContactOrganizations(contactId?: string) {
  return useQuery({
    queryKey: ['crm-contact-organizations', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('crm_contact_organizations')
        .select(`
          *,
          organization:crm_organizations(*)
        `)
        .eq('contact_id', contactId)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return data as (CRMContactOrganization & { organization: CRMOrganization })[];
    },
    enabled: !!contactId,
  });
}

// Get all contacts for an organization
export function useOrganizationContacts(organizationId?: string) {
  return useQuery({
    queryKey: ['crm-organization-contacts', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('crm_contact_organizations')
        .select(`
          *,
          contact:crm_contacts(*)
        `)
        .eq('organization_id', organizationId)
        .order('is_primary', { ascending: false });
      
      if (error) throw error;
      return data as (CRMContactOrganization & { contact: CRMContact })[];
    },
    enabled: !!organizationId,
  });
}

// Add a contact to an organization
export function useAddContactOrganization() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      contact_id: string; 
      organization_id: string; 
      role?: string;
      is_primary?: boolean;
    }) => {
      const { error } = await supabase
        .from('crm_contact_organizations')
        .insert({
          contact_id: data.contact_id,
          organization_id: data.organization_id,
          role: data.role,
          is_primary: data.is_primary || false,
        });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contact-organizations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-organization-contacts', variables.organization_id] });
      toast.success("Organization linked");
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error("This organization is already linked");
      } else {
        toast.error("Failed to link organization");
      }
    },
  });
}

// Update contact-organization relationship
export function useUpdateContactOrganization() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      id: string;
      contact_id: string;
      organization_id: string;
      role?: string;
      is_primary?: boolean;
    }) => {
      const { error } = await supabase
        .from('crm_contact_organizations')
        .update({
          role: data.role,
          is_primary: data.is_primary,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contact-organizations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-organization-contacts', variables.organization_id] });
    },
    onError: () => {
      toast.error("Failed to update");
    },
  });
}

// Remove contact from organization
export function useRemoveContactOrganization() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      id: string;
      contact_id: string;
      organization_id: string;
    }) => {
      const { error } = await supabase
        .from('crm_contact_organizations')
        .delete()
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contact-organizations', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-organization-contacts', variables.organization_id] });
      toast.success("Organization removed");
    },
    onError: () => {
      toast.error("Failed to remove organization");
    },
  });
}
