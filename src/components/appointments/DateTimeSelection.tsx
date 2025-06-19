
import React from "react";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import type { AppointmentSlot } from "@/hooks/use-appointments";

interface DateTimeSelectionProps {
  selectedDate: Date | undefined;
  onDateSelect: (date: Date | undefined) => void;
  selectedSlot: string;
  onSlotSelect: (slotId: string) => void;
  availableSlots: AppointmentSlot[];
  minDate: Date;
  maxDate: Date;
}

export function DateTimeSelection({
  selectedDate,
  onDateSelect,
  selectedSlot,
  onSlotSelect,
  availableSlots,
  minDate,
  maxDate,
}: DateTimeSelectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Select Date & Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label>Select Date</Label>
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={onDateSelect}
            disabled={(date) => date < minDate || date > maxDate}
            className="rounded-md border mt-2"
          />
        </div>

        {selectedDate && availableSlots.length > 0 && (
          <div>
            <Label>Available Times (15 minutes each)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {availableSlots.map((slot) => (
                <Button
                  key={slot.id}
                  variant={selectedSlot === slot.id ? "default" : "outline"}
                  onClick={() => onSlotSelect(slot.id)}
                  className="justify-start"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {slot.start_time}
                </Button>
              ))}
            </div>
          </div>
        )}

        {selectedDate && availableSlots.length === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            No available slots for this date. Please select another date.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
