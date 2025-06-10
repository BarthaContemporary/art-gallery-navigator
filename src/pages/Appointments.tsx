
import React, { useState } from "react";
import { Calendar, Clock, Users, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppointmentCalendar } from "@/components/appointments/AppointmentCalendar";
import { AvailabilityManager } from "@/components/appointments/AvailabilityManager";
import { AppointmentsList } from "@/components/appointments/AppointmentsList";
import { BookingSettings } from "@/components/appointments/BookingSettings";

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Appointment Management</h1>
          <p className="text-muted-foreground">
            Manage your availability and client appointments
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <AppointmentCalendar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Manage Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <AvailabilityManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>All Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <AppointmentsList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Booking Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <BookingSettings />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
