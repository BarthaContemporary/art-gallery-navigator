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
    const { vat_number, eori_number, action } = await req.json();

    if (action === 'validate_vat' && vat_number) {
      // Extract country code and VAT number
      const countryCode = vat_number.slice(0, 2).toUpperCase();
      const vatId = vat_number.slice(2).replace(/\s/g, '');

      console.log(`Validating VAT: ${countryCode}${vatId}`);

      // Use EU VIES SOAP API for VAT validation
      const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
        <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
          <soapenv:Header/>
          <soapenv:Body>
            <urn:checkVat>
              <urn:countryCode>${countryCode}</urn:countryCode>
              <urn:vatNumber>${vatId}</urn:vatNumber>
            </urn:checkVat>
          </soapenv:Body>
        </soapenv:Envelope>`;

      const response = await fetch('https://ec.europa.eu/taxation_customs/vies/services/checkVatService', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '',
        },
        body: soapEnvelope,
      });

      const responseText = await response.text();
      console.log('VIES response:', responseText);

      // Parse SOAP response
      const validMatch = responseText.match(/<valid>(\w+)<\/valid>/);
      const nameMatch = responseText.match(/<name>([^<]*)<\/name>/);
      const addressMatch = responseText.match(/<address>([^<]*)<\/address>/);

      const isValid = validMatch?.[1]?.toLowerCase() === 'true';
      const companyName = nameMatch?.[1] || null;
      const companyAddress = addressMatch?.[1] || null;

      return new Response(
        JSON.stringify({
          valid: isValid,
          country_code: countryCode,
          vat_number: vatId,
          company_name: companyName,
          company_address: companyAddress,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate_eori' && eori_number) {
      // EORI validation is more complex and requires specific country APIs
      // For now, we validate the format and provide basic checks
      const cleanEori = eori_number.replace(/\s/g, '').toUpperCase();
      const countryCode = cleanEori.slice(0, 2);
      const eoriId = cleanEori.slice(2);

      console.log(`Validating EORI: ${countryCode}${eoriId}`);

      // Basic format validation
      // EORI format: 2-letter country code + up to 15 alphanumeric characters
      const isValidFormat = /^[A-Z]{2}[A-Z0-9]{1,15}$/.test(cleanEori);

      // EU member state codes
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

      // For real validation, the EU EORI validation service could be called
      // https://ec.europa.eu/taxation_customs/dds2/eos/validation/services/validation
      // For now, we just validate format
      
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

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "validate_vat" or "validate_eori"' }),
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
