import React, { useEffect, useState } from "react";
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
  const [londonTime, setLondonTime] = useState("");

  useEffect(() => {
    const updateLondonTime = () => {
      const now = new Date();
      const londonTimeString = now.toLocaleTimeString("en-GB", {
        timeZone: "Europe/London",
        hour12: true,
        hour: "numeric",
        minute: "2-digit"
      });
      setLondonTime(londonTimeString);
    };

    // Update immediately
    updateLondonTime();

    // Update every second
    const interval = setInterval(updateLondonTime, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check if CSS is already loaded
    const existingCSS = document.querySelector('link[href="https://calendar.google.com/calendar/scheduling-button-script.css"]');
    if (!existingCSS) {
      const link = document.createElement('link');
      link.href = 'https://calendar.google.com/calendar/scheduling-button-script.css';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://calendar.google.com/calendar/scheduling-button-script.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://calendar.google.com/calendar/scheduling-button-script.js';
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => {
        initializeCalendarButton();
      };
    } else {
      // Script already exists, just initialize
      initializeCalendarButton();
    }
    function initializeCalendarButton() {
      const targetElement = document.getElementById('google-calendar-target');
      if (window.calendar && targetElement) {
        // Clear any existing content
        targetElement.innerHTML = '';
        window.calendar.schedulingButton.load({
          url: 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ1VBfIFXwKkPot_gxCvnJxBTw2FcN6zvzax5HycsH9IH2oRdMdcb56hlWKTdsBy4QuHtLiXNHTK?gv=true',
          color: '#039BE5',
          label: 'Book an appointment',
          target: targetElement
        });
      }
    }
  }, []);
  return <div className="container mx-auto p-6 space-y-6">

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Schedule a call in the next panel, or use the chat button at the bottom. </p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Current time in London</p>
                  <p className="text-sm text-muted-foreground">{londonTime}</p>
                  
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">Gallery +44 20 7985 0015</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">niklas@barthacontemporary.com</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Book an Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Book a Google Meeting (like Zoom) for one to one assistance or general conversation</p>
            
            

            {/* Google Calendar Button Container */}
            <div className="pt-4">
              <div id="google-calendar-target"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      
    </div>;
}