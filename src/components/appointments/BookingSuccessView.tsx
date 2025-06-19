
import React from "react";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AddToCalendarButton } from "@/components/appointments/AddToCalendarButton";
import type { Appointment } from "@/hooks/use-appointments";

interface BookingSuccessViewProps {
  appointment: Appointment & { location?: { name: string } };
  onBookAnother: () => void;
}

export function BookingSuccessView({
  appointment,
  onBookAnother,
}: BookingSuccessViewProps) {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-6 text-center space-y-6">
        <div className="text-green-600">
          <Calendar className="h-16 w-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900">Appointment Confirmed!</h2>
          <p className="text-gray-600 mt-2">
            Your appointment has been successfully booked for {format(new Date(appointment.start_datetime), 'MMMM d, yyyy')} at {format(new Date(appointment.start_datetime), 'h:mm a')}.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">📅 Add to Your Calendar</h3>
          <p className="text-blue-700 text-sm mb-4">
            Don't forget your appointment! Add it to your calendar now.
          </p>
          <div className="flex justify-center">
            <AddToCalendarButton appointment={appointment} />
          </div>
        </div>

        <div className="text-sm text-gray-600">
          <p>You will receive a confirmation email shortly with calendar file attached.</p>
        </div>

        <Button 
          onClick={onBookAnother}
          variant="outline"
        >
          Book Another Appointment
        </Button>
      </CardContent>
    </Card>
  );
}
