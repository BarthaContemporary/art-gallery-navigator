
import React from "react";
import { format } from "date-fns";
import { Calendar, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AppointmentSlot } from "@/hooks/use-appointments";
import type { Location } from "@/hooks/use-locations";

interface AppointmentSummaryProps {
  selectedDate: Date;
  selectedSlot: AppointmentSlot;
  selectedLocation: Location;
}

export function AppointmentSummary({
  selectedDate,
  selectedSlot,
  selectedLocation,
}: AppointmentSummaryProps) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="pt-4">
        <h4 className="font-medium mb-2">Appointment Summary</h4>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(selectedDate, 'MMMM d, yyyy')}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {selectedSlot.start_time} (15 minutes)
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {selectedLocation.name}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
