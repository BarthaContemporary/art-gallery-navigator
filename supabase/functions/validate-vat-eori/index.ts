import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vat_number, eori_number, company_number, email, action } = await req.json();

    if (action === 'validate_vat' && vat_number) {
      // Clean VAT number - remove spaces and convert to uppercase
      const cleanVat = vat_number.replace(/\s/g, '').toUpperCase();
      const countryCode = cleanVat.slice(0, 2);
      const vatId = cleanVat.slice(2);

      console.log(`Validating VAT via VATCheckAPI: ${cleanVat}`);

      // Get VATCheckAPI key
      const apiKey = Deno.env.get('VATCHECKAPI_KEY');
      if (!apiKey) {
        console.error('VATCHECKAPI_KEY not configured');
        // Fallback to basic format validation
        const vatPattern = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
        const isValidFormat = vatPattern.test(cleanVat);
        return new Response(
          JSON.stringify({
            valid: isValidFormat,
            format_valid: isValidFormat,
            country_code: countryCode,
            vat_number: vatId,
            note: 'VATCheckAPI not configured. Format validation only.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://api.vatcheckapi.com/v2/check?vat_number=${encodeURIComponent(cleanVat)}`,
          {
            method: 'GET',
            headers: {
              'apikey': apiKey.trim(),
              'Accept': 'application/json',
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        console.log(`VATCheckAPI response status: ${response.status}`);

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`VATCheckAPI error ${response.status}: ${errorBody}`);
          
          // Return format validation on API error
          const vatPattern = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
          return new Response(
            JSON.stringify({
              valid: vatPattern.test(cleanVat),
              format_valid: vatPattern.test(cleanVat),
              country_code: countryCode,
              vat_number: vatId,
              note: `VAT API returned status ${response.status}. Format validation only.`,
              api_error: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        console.log('VATCheckAPI response:', JSON.stringify(data));

        // VATCheckAPI response structure
        const isRegistered = data.registration_info?.is_registered === true;
        const isFormatValid = data.format_valid === true;
        const companyName = data.registration_info?.name || null;
        const companyAddress = data.registration_info?.address || null;

        return new Response(
          JSON.stringify({
            valid: isRegistered || isFormatValid,
            verified: isRegistered,
            format_valid: isFormatValid,
            checksum_valid: data.checksum_valid,
            country_code: data.country_code || countryCode,
            vat_number: data.vat_number || vatId,
            company_name: companyName,
            company_address: companyAddress,
            checked_at: data.registration_info?.checked_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.error('VATCheckAPI request timed out');
        } else {
          console.error('VATCheckAPI error:', err);
        }
        
        // Return format validation on error
        const vatPattern = /^[A-Z]{2}[A-Z0-9]{2,12}$/;
        return new Response(
          JSON.stringify({
            valid: vatPattern.test(cleanVat),
            format_valid: vatPattern.test(cleanVat),
            country_code: countryCode,
            vat_number: vatId,
            note: 'VAT verification service unavailable.',
            api_error: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'validate_eori' && eori_number) {
      const cleanEori = eori_number.replace(/\s/g, '').toUpperCase();
      const countryCode = cleanEori.slice(0, 2);
      const eoriId = cleanEori.slice(2);

      console.log(`Validating EORI: ${countryCode}${eoriId}`);

      const isValidFormat = /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(cleanEori);
      const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'XI'];
      const isEuCountry = euCountries.includes(countryCode);

      if (!isValidFormat) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Invalid EORI format. Expected: 2-letter country code followed by up to 15 alphanumeric characters.',
            country_code: countryCode,
            eori_number: eoriId,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({
          valid: isValidFormat,
          format_valid: true,
          is_eu_country: isEuCountry,
          country_code: countryCode,
          eori_number: eoriId,
          note: 'Format validation only. Full EORI validation requires EU customs database access.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate_email' && email) {
      console.log(`Validating email: ${email}`);

      const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
      if (!hunterApiKey) {
        console.error('HUNTER_API_KEY not configured');
        // Basic format validation fallback
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return new Response(
          JSON.stringify({
            valid: emailRegex.test(email),
            format_valid: emailRegex.test(email),
            email: email,
            note: 'Hunter.io API not configured. Format validation only.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const hunterResponse = await fetch(
          `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterApiKey}`
        );

        if (!hunterResponse.ok) {
          console.error('Hunter.io API error:', hunterResponse.status);
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return new Response(
            JSON.stringify({
              valid: emailRegex.test(email),
              format_valid: true,
              email: email,
              note: 'Hunter.io verification unavailable.',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const hunterData = await hunterResponse.json();
        console.log('Hunter.io response:', JSON.stringify(hunterData));

        const data = hunterData.data;
        const isValid = data.result === 'deliverable' || data.result === 'risky';
        
        return new Response(
          JSON.stringify({
            valid: isValid,
            verified: true,
            email: email,
            result: data.result,
            score: data.score,
            disposable: data.disposable,
            webmail: data.webmail,
            mx_records: data.mx_records,
            smtp_server: data.smtp_server,
            smtp_check: data.smtp_check,
            accept_all: data.accept_all,
            block: data.block,
            sources: data.sources,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        console.error('Hunter.io API error:', err);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return new Response(
          JSON.stringify({
            valid: emailRegex.test(email),
            format_valid: true,
            email: email,
            note: 'Hunter.io verification failed.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'validate_company' && company_number) {
      const cleanNumber = company_number.replace(/\s/g, '').toUpperCase();
      
      console.log(`Validating UK Company Number: ${cleanNumber}`);

      // UK Company number format: 8 characters (letters/numbers)
      // Can also be 6-8 digits for older companies
      const ukCompanyPattern = /^([A-Z]{2}[0-9]{6}|[0-9]{6,8}|[A-Z][0-9]{7}|[A-Z]{2}[0-9]{5}[A-Z])$/;
      if (!ukCompanyPattern.test(cleanNumber)) {
        return new Response(
          JSON.stringify({
            valid: false,
            error: 'Invalid UK company number format. Expected: 8 alphanumeric characters (e.g., 12345678, SC123456, OC123456).',
            company_number: cleanNumber,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate against Companies House API
      const apiKey = Deno.env.get('COMPANIES_HOUSE_API_KEY');
      if (!apiKey) {
        console.error('COMPANIES_HOUSE_API_KEY not configured');
        return new Response(
          JSON.stringify({
            valid: true,
            format_valid: true,
            company_number: cleanNumber,
            note: 'Format validated. Companies House API not configured for full verification.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Clean and validate API key format
      const trimmedKey = apiKey.trim();
      
      // Log API key details for debugging
      console.log(`API key length: ${trimmedKey.length}`);
      console.log(`API key format check: contains spaces=${trimmedKey.includes(' ')}, contains newlines=${trimmedKey.includes('\n')}`);
      
      // Companies House API keys are typically UUID format (36 chars) or alphanumeric
      if (trimmedKey.length < 10) {
        console.error('API key appears too short');
        return new Response(
          JSON.stringify({
            valid: true,
            format_valid: true,
            company_number: cleanNumber,
            note: 'Format validated. API key configuration issue.',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Build auth header - Companies House uses HTTP Basic Auth with API key as username and empty password
      const authString = btoa(trimmedKey + ':');
      console.log(`Making request to Companies House for company: ${cleanNumber}`);

      try {
        // Add timeout using AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const chResponse = await fetch(`https://api.company-information.service.gov.uk/company/${cleanNumber}`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Accept': 'application/json',
            'User-Agent': 'BarthaContemporary-CRM/1.0',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        console.log(`Companies House API response status: ${chResponse.status}`);
        
        // Log all response headers for debugging
        const responseHeaders: Record<string, string> = {};
        chResponse.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        console.log(`Response headers: ${JSON.stringify(responseHeaders)}`);

        if (chResponse.status === 404) {
          return new Response(
            JSON.stringify({
              valid: false,
              error: 'Company not found in Companies House register.',
              company_number: cleanNumber,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Handle authentication errors specifically
        if (chResponse.status === 401) {
          const errorBody = await chResponse.text();
          console.error(`Companies House 401 Unauthorized. Response body: ${errorBody}`);
          
          // Try to parse error message
          let errorMessage = 'Authentication failed';
          try {
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.error || errorJson.message || errorMessage;
          } catch {
            errorMessage = errorBody || errorMessage;
          }
          
          return new Response(
            JSON.stringify({
              valid: true,
              format_valid: true,
              company_number: cleanNumber,
              note: `Format validated. Companies House API authentication issue: ${errorMessage}`,
              api_error: true,
              error_code: 401,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Handle rate limiting
        if (chResponse.status === 429) {
          console.error('Companies House API rate limited');
          return new Response(
            JSON.stringify({
              valid: true,
              format_valid: true,
              company_number: cleanNumber,
              note: 'Format validated. API rate limit reached - please try again later.',
              api_error: true,
              error_code: 429,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!chResponse.ok) {
          const errorBody = await chResponse.text();
          console.error(`Companies House API error ${chResponse.status}: ${errorBody}`);
          return new Response(
            JSON.stringify({
              valid: true,
              format_valid: true,
              company_number: cleanNumber,
              note: `Format validated. Companies House API returned status ${chResponse.status}.`,
              api_error: true,
              error_code: chResponse.status,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const companyData = await chResponse.json();
        console.log('Companies House response:', JSON.stringify(companyData));

        return new Response(
          JSON.stringify({
            valid: true,
            verified: true,
            company_number: cleanNumber,
            company_name: companyData.company_name,
            company_status: companyData.company_status,
            company_type: companyData.type,
            date_of_creation: companyData.date_of_creation,
            registered_office_address: companyData.registered_office_address,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          console.error('Companies House API request timed out');
          return new Response(
            JSON.stringify({
              valid: true,
              format_valid: true,
              company_number: cleanNumber,
              note: 'Format validated. Companies House API request timed out.',
              api_error: true,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.error('Companies House API error:', err);
        return new Response(
          JSON.stringify({
            valid: true,
            format_valid: true,
            company_number: cleanNumber,
            note: 'Format validated. Companies House verification failed.',
            api_error: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "validate_vat", "validate_eori", or "validate_company"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in validate-vat-eori:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
