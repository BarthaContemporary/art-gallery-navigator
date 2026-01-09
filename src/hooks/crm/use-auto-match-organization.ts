import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  getMatchableDomain, 
  websiteMatchesDomain, 
  orgEmailMatchesDomain 
} from "@/lib/email-domain-utils";
import { CRMOrganization } from "@/types/crm";

interface MatchResult {
  matched: boolean;
  organization?: CRMOrganization;
  linked?: boolean;
}

/**
 * Find an organization that matches the given email domain
 */
export async function findOrganizationByEmailDomain(email: string): Promise<CRMOrganization | null> {
  const domain = getMatchableDomain(email);
  if (!domain) return null;

  // Fetch all organizations
  const { data: organizations, error } = await supabase
    .from('crm_organizations')
    .select('*');

  if (error || !organizations) return null;

  // Find a matching organization by website or email domain
  for (const org of organizations) {
    // Check website match
    if (websiteMatchesDomain(org.website, domain)) {
      return org as CRMOrganization;
    }
    // Check organization email match
    if (orgEmailMatchesDomain(org.email, domain)) {
      return org as CRMOrganization;
    }
  }

  return null;
}

/**
 * Hook to automatically match and link a contact to an organization based on email domain
 */
export function useAutoMatchOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, email }: { contactId: string; email: string }): Promise<MatchResult> => {
      const organization = await findOrganizationByEmailDomain(email);
      
      if (!organization) {
        return { matched: false };
      }

      // Check if already linked
      const { data: existing } = await supabase
        .from('crm_contact_organizations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (existing) {
        return { matched: true, organization, linked: false };
      }

      // Link the contact to the organization
      const { error } = await supabase
        .from('crm_contact_organizations')
        .insert({
          contact_id: contactId,
          organization_id: organization.id,
          is_primary: true,
        });

      if (error) {
        console.error('Failed to auto-link organization:', error);
        return { matched: true, organization, linked: false };
      }

      return { matched: true, organization, linked: true };
    },
    onSuccess: (result, variables) => {
      if (result.linked) {
        queryClient.invalidateQueries({ queryKey: ['crm-contact-organizations', variables.contactId] });
        if (result.organization) {
          queryClient.invalidateQueries({ queryKey: ['crm-organization-contacts', result.organization.id] });
        }
      }
    },
  });
}
