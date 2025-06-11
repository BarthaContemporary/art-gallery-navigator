
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Download, ExternalLink } from "lucide-react";
import { generateICS, downloadICSFile, generateCalendarUrls } from "@/utils/icalendar-generator";
import type { Appointment } from "@/hooks/use-appointments";

interface AddToCalendarButtonProps {
  appointment: Appointment;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

export function AddToCalendarButton({ appointment, variant = "outline", size = "default" }: AddToCalendarButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const calendarEvent = {
    id: appointment.id,
    title: `Gallery Appointment - ${appointment.client_name}`,
    description: `Gallery appointment with ${appointment.client_name}${appointment.notes ? `\n\nNotes: ${appointment.notes}` : ''}`,
    location: appointment.locations?.name || 'Gallery',
    startDate: new Date(appointment.start_datetime),
    endDate: new Date(appointment.end_datetime),
    organizer: {
      name: 'Gallery Team',
      email: 'bookings@bartha.app'
    },
    attendee: {
      name: appointment.client_name,
      email: appointment.client_email
    }
  };

  const handleDownloadICS = () => {
    const icsContent = generateICS(calendarEvent);
    const filename = `gallery-appointment-${appointment.client_name.replace(/\s+/g, '-').toLowerCase()}.ics`;
    downloadICSFile(icsContent, filename);
    setIsOpen(false);
  };

  const calendarUrls = generateCalendarUrls(calendarEvent);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Calendar className="h-4 w-4" />
          Add to Calendar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h4 className="font-medium text-sm">Add to Calendar</h4>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start gap-2"
              onClick={handleDownloadICS}
            >
              <Download className="h-4 w-4" />
              Download Calendar File (.ics)
            </Button>
            
            <div className="border-t pt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Or open directly:</p>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => window.open(calendarUrls.google, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Google Calendar
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => window.open(calendarUrls.outlook, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Outlook Calendar
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={() => window.open(calendarUrls.yahoo, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                Yahoo Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
