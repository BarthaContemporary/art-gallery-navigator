// Common personal/free email domains to exclude from organization matching
export const COMMON_EMAIL_DOMAINS = new Set([
  // Gmail
  'gmail.com',
  'googlemail.com',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.de',
  'ymail.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // AOL
  'aol.com',
  // ProtonMail
  'protonmail.com',
  'proton.me',
  'pm.me',
  // Other popular free providers
  'mail.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'web.de',
  'fastmail.com',
  'tutanota.com',
  'yandex.com',
  'qq.com',
  '163.com',
  '126.com',
  // ISP emails
  'btinternet.com',
  'virginmedia.com',
  'sky.com',
  'comcast.net',
  'verizon.net',
  'att.net',
  'sbcglobal.net',
  'charter.net',
  'cox.net',
]);

/**
 * Extract domain from an email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return domain || null;
}

/**
 * Check if an email domain is a common personal/free email provider
 */
export function isCommonEmailDomain(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (!domain) return true; // Treat invalid emails as common (don't match)
  return COMMON_EMAIL_DOMAINS.has(domain);
}

/**
 * Extract the base domain for matching (e.g., "company.com" from "info@company.com")
 */
export function getMatchableDomain(email: string): string | null {
  if (isCommonEmailDomain(email)) return null;
  return extractDomainFromEmail(email);
}

/**
 * Check if a website URL contains the given domain
 */
export function websiteMatchesDomain(website: string | null | undefined, domain: string): boolean {
  if (!website || !domain) return false;
  
  // Normalize the website URL
  let normalizedWebsite = website.toLowerCase().trim();
  
  // Remove protocol
  normalizedWebsite = normalizedWebsite.replace(/^https?:\/\//, '');
  
  // Remove www.
  normalizedWebsite = normalizedWebsite.replace(/^www\./, '');
  
  // Remove trailing slash and paths
  normalizedWebsite = normalizedWebsite.split('/')[0];
  
  // Check if the domain matches
  return normalizedWebsite === domain || normalizedWebsite.endsWith('.' + domain);
}

/**
 * Check if an organization email matches the given domain
 */
export function orgEmailMatchesDomain(orgEmail: string | null | undefined, domain: string): boolean {
  if (!orgEmail || !domain) return false;
  const orgDomain = extractDomainFromEmail(orgEmail);
  return orgDomain === domain;
}
