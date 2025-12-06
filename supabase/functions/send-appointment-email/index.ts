import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AppointmentEmailRequest {
  appointmentId: string;
  emailType: 'confirmation' | 'cancellation' | 'reminder' | 'admin_notification' | 'test';
  testEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // =========================================================================
    // SECURITY: Verify caller is authenticated and has admin role
    // =========================================================================
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      console.error('No authorization token provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No token provided' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Invalid token or user not found:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid token' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Check if user has gallery_admin role using has_role function
    const { data: isAdmin, error: roleError } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'gallery_admin'
    });
    
    if (roleError) {
      console.error('Error checking admin role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    if (!isAdmin) {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log(`Admin user ${user.id} authorized to send emails`);
    // =========================================================================
    
    const { appointmentId, emailType, testEmail }: AppointmentEmailRequest = await req.json();

    console.log(`Sending ${emailType} email for appointment ${appointmentId}`);

    // Handle test email
    if (emailType === 'test') {
      const emailResponse = await resend.emails.send({
        from: "Gallery Bookings <bookings@bartha.app>",
        to: [testEmail || 'admin@example.com'],
        subject: 'Test Email - Gallery Booking System',
        html: `
          <h1>Test Email</h1>
          <p>This is a test email from your Gallery booking system.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        `,
      });

      console.log("Test email sent successfully:", emailResponse);

      return new Response(
        JSON.stringify({ success: true, emailResponse }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Fetch appointment details with related data
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types(name, color),
        locations(name, address),
        appointment_slots(start_time, end_time)
      `)
      .eq('id', appointmentId)
      .single();

    if (error || !appointment) {
      console.error('Error fetching appointment:', error);
      throw new Error('Appointment not found');
    }

    const appointmentDate = new Date(appointment.start_datetime);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Generate ICS calendar file
    const generateICS = (appointment: any) => {
      const formatDate = (date: Date): string => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const escapeText = (text: string): string => {
        return text
          .replace(/\\/g, '\\\\')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,')
          .replace(/\n/g, '\\n');
      };

      const startDate = new Date(appointment.start_datetime);
      const endDate = new Date(appointment.end_datetime);
      const location = appointment.locations?.name || 'Gallery';
      const description = `Gallery appointment with ${appointment.client_name}${appointment.notes ? `\\n\\nNotes: ${appointment.notes}` : ''}`;

      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Gallery Booking System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${appointment.id}@gallery-booking-system`,
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `DTSTAMP:${formatDate(new Date())}`,
        `SUMMARY:${escapeText(`Gallery Appointment - ${appointment.client_name}`)}`,
        `DESCRIPTION:${escapeText(description)}`,
        `LOCATION:${escapeText(location)}`,
        `ORGANIZER;CN=Gallery Team:mailto:bookings@bartha.app`,
        `ATTENDEE;CN=${escapeText(appointment.client_name)};RSVP=TRUE:mailto:${appointment.client_email}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        'END:VEVENT',
        'END:VCALENDAR'
      ];

      return lines.join('\r\n');
    };

    let emailContent, subject, recipients, attachments = undefined;

    switch (emailType) {
      case 'confirmation':
        subject = 'Appointment Booking Confirmation';
        recipients = [appointment.client_email];
        
        // Generate calendar file for confirmation emails
        const icsContent = generateICS(appointment);
        const icsFilename = `gallery-appointment-${appointment.client_name.replace(/\s+/g, '-').toLowerCase()}.ics`;
        
        attachments = [{
          filename: icsFilename,
          content: Buffer.from(icsContent).toString('base64'),
          type: 'text/calendar',
          disposition: 'attachment'
        }];

        emailContent = `
          <h1>Appointment Confirmed!</h1>
          <p>Dear ${appointment.client_name},</p>
          <p>Your appointment has been successfully booked. Here are the details:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Appointment Details</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.appointment_types ? `<p><strong>Type:</strong> ${appointment.appointment_types.name}</p>` : ''}
            ${appointment.locations ? `<p><strong>Location:</strong> ${appointment.locations.name}</p>` : ''}
            ${appointment.locations?.address ? `<p><strong>Address:</strong> ${appointment.locations.address}</p>` : ''}
            <p><strong>Status:</strong> ${appointment.status}</p>
          </div>
          
          ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4>📅 Add to Your Calendar</h4>
            <p>We've attached a calendar file (.ics) to this email. Simply click on the attachment to add this appointment to your Apple Calendar, Google Calendar, or any other calendar app.</p>
          </div>
          
          <p>If you need to make any changes or have questions, please contact us.</p>
          <p>We look forward to seeing you!</p>
          
          <p>Best regards,<br>Gallery Team</p>
        `;
        break;

      case 'admin_notification':
        // Get admin email from booking settings or use default
        const { data: settings } = await supabase
          .from('booking_settings')
          .select('notification_email')
          .limit(1)
          .single();
        
        const adminEmail = settings?.notification_email || 'admin@example.com';
        subject = 'New Appointment Booking';
        recipients = [adminEmail];
        emailContent = `
          <h1>New Appointment Booking</h1>
          <p>A new appointment has been booked:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Client Information</h3>
            <p><strong>Name:</strong> ${appointment.client_name}</p>
            <p><strong>Email:</strong> ${appointment.client_email}</p>
            ${appointment.client_phone ? `<p><strong>Phone:</strong> ${appointment.client_phone}</p>` : ''}
            
            <h3>Appointment Details</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.appointment_types ? `<p><strong>Type:</strong> ${appointment.appointment_types.name}</p>` : ''}
            ${appointment.locations ? `<p><strong>Location:</strong> ${appointment.locations.name}</p>` : ''}
            <p><strong>Status:</strong> ${appointment.status}</p>
          </div>
          
          ${appointment.notes ? `<p><strong>Client Notes:</strong> ${appointment.notes}</p>` : ''}
          
          <p>Please review and confirm this appointment in the admin panel.</p>
        `;
        break;

      case 'reminder':
        subject = 'Appointment Reminder - Tomorrow';
        recipients = [appointment.client_email];
        emailContent = `
          <h1>Appointment Reminder</h1>
          <p>Dear ${appointment.client_name},</p>
          <p>This is a friendly reminder about your upcoming appointment:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Tomorrow's Appointment</h3>
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${formattedTime}</p>
            ${appointment.appointment_types ? `<p><strong>Type:</strong> ${appointment.appointment_types.name}</p>` : ''}
            ${appointment.locations ? `<p><strong>Location:</strong> ${appointment.locations.name}</p>` : ''}
            ${appointment.locations?.address ? `<p><strong>Address:</strong> ${appointment.locations.address}</p>` : ''}
          </div>
          
          <p>We look forward to seeing you tomorrow!</p>
          <p>If you need to reschedule or cancel, please contact us as soon as possible.</p>
          
          <p>Best regards,<br>Gallery Team</p>
        `;
        break;

      case 'cancellation':
        subject = 'Appointment Cancellation';
        recipients = [appointment.client_email];
        emailContent = `
          <h1>Appointment Cancelled</h1>
          <p>Dear ${appointment.client_name},</p>
          <p>Your appointment scheduled for ${formattedDate} at ${formattedTime} has been cancelled.</p>
          
          <p>If you would like to reschedule, please feel free to book a new appointment or contact us directly.</p>
          
          <p>Thank you for your understanding.</p>
          <p>Best regards,<br>Gallery Team</p>
        `;
        break;

      default:
        throw new Error('Invalid email type');
    }

    const emailOptions: any = {
      from: "Gallery Bookings <bookings@bartha.app>",
      to: recipients,
      subject: subject,
      html: emailContent,
    };

    // Add attachments if they exist
    if (attachments) {
      emailOptions.attachments = attachments;
    }

    const emailResponse = await resend.emails.send(emailOptions);

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
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
