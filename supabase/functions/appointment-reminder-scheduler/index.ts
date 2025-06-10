
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("Running appointment reminder scheduler...");

    // Get appointments that are 24 hours away and haven't been reminded yet
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, client_email, start_datetime, status')
      .gte('start_datetime', tomorrowStart.toISOString())
      .lte('start_datetime', tomorrowEnd.toISOString())
      .in('status', ['confirmed', 'pending'])
      .is('reminder_sent', null); // Assuming we add this column

    if (error) {
      console.error('Error fetching appointments:', error);
      throw error;
    }

    console.log(`Found ${appointments?.length || 0} appointments to remind`);

    if (appointments && appointments.length > 0) {
      // Send reminder emails for each appointment
      for (const appointment of appointments) {
        try {
          // Call the email function
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-appointment-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              appointmentId: appointment.id,
              emailType: 'reminder'
            }),
          });

          if (emailResponse.ok) {
            // Mark reminder as sent (we'll need to add this column)
            await supabase
              .from('appointments')
              .update({ reminder_sent: new Date().toISOString() })
              .eq('id', appointment.id);
            
            console.log(`Reminder sent for appointment ${appointment.id}`);
          } else {
            console.error(`Failed to send reminder for appointment ${appointment.id}`);
          }
        } catch (emailError) {
          console.error(`Error sending reminder for appointment ${appointment.id}:`, emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reminders_sent: appointments?.length || 0 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in reminder scheduler:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
