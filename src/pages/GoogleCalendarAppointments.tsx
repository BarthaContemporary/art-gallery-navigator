import React, { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";

declare global {
  interface Window {
    calendar?: {
      schedulingButton: {
        load: (config: {
          url: string;
          color: string;
          label: string;
          target: Element | null;
        }) => void;
      };
    };
  }
}

export default function GoogleCalendarAppointments() {
  useEffect(() => {
    // Load Google Calendar scheduling button CSS
    const link = document.createElement('link');
    link.href = 'https://calendar.google.com/calendar/scheduling-button-script.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Load Google Calendar scheduling button script
    const script = document.createElement('script');
    script.src = 'https://calendar.google.com/calendar/scheduling-button-script.js';
    script.async = true;
    document.head.appendChild(script);

    // Initialize the calendar button when the script loads
    script.onload = () => {
      const targetElement = document.getElementById('google-calendar-target');
      if (window.calendar && targetElement) {
        window.calendar.schedulingButton.load({
          url: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1VBfIFXwKkPot_gxCvnJxBTw2FcN6zvzax5HycsH9IH2oRdMdcb56hlWKTdsBy4QuHtLiXNHTK?gv=true',
          color: '#039BE5',
          label: 'Book an appointment',
          target: targetElement,
        });
      }
    };

    // Cleanup function
    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
          <p className="text-muted-foreground">Schedule your gallery visits and consultations</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Book an Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Schedule a personalized consultation or gallery visit. Choose from available time slots
              that work best for your schedule.
            </p>
            
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">What to expect:</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Personalized art consultation</li>
                <li>• Private gallery viewing</li>
                <li>• Discussion of collection interests</li>
                <li>• Expert guidance and recommendations</li>
              </ul>
            </div>

            {/* Google Calendar Button Container */}
            <div className="pt-4">
              <div id="google-calendar-target"></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Prefer to schedule by phone or have questions? We're here to help.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Gallery Hours</p>
                  <p className="text-sm text-muted-foreground">Monday - Friday: 9:00 AM - 6:00 PM</p>
                  <p className="text-sm text-muted-foreground">Saturday: 10:00 AM - 4:00 PM</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">Call us for immediate assistance</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">Send us your questions anytime</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment Policies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">Cancellation Policy</h4>
              <p className="text-sm text-muted-foreground">
                Please provide at least 24 hours notice for cancellations to allow others 
                to book the time slot.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Preparation</h4>
              <p className="text-sm text-muted-foreground">
                Come prepared with any specific questions or interests you'd like to discuss 
                during your visit.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}