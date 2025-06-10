
import React from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User } from "lucide-react";
import { useAppointments } from "@/hooks/use-appointments";

interface AppointmentCalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
}

export function AppointmentCalendar({ selectedDate, onDateChange }: AppointmentCalendarProps) {
  const { data: appointments = [], isLoading } = useAppointments(format(selectedDate, 'yyyy-MM-dd'));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateChange(date)}
          className="rounded-md border"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          Appointments for {format(selectedDate, 'MMMM d, yyyy')}
        </h3>
        
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No appointments scheduled for this date
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <Card key={appointment.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {appointment.client_name}
                    </CardTitle>
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(appointment.status)} text-white border-0`}
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(appointment.start_datetime), 'h:mm a')} - 
                      {format(new Date(appointment.end_datetime), 'h:mm a')}
                    </div>
                    {appointment.appointment_types && (
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: appointment.appointment_types.color }}
                        />
                        {appointment.appointment_types.name}
                      </div>
                    )}
                    {appointment.locations && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {appointment.locations.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {appointment.client_email}
                    </div>
                    {appointment.notes && (
                      <p className="text-xs bg-muted p-2 rounded">
                        {appointment.notes}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
