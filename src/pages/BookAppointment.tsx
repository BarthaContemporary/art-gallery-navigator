
import React, { useState } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { Calendar, Clock, MapPin, User, Mail, Phone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useAppointmentSlots, useCreateAppointment } from "@/hooks/use-appointments";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";

export default function BookAppointment() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: locations = [] } = useLocations();
  const { data: slots = [] } = useAppointmentSlots(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined);
  const createAppointment = useCreateAppointment();

  const availableSlots = slots.filter(slot => {
    if (slot.recurrence_type === 'weekly') {
      return selectedDate && slot.day_of_week === selectedDate.getDay();
    }
    return selectedDate && slot.date === format(selectedDate, 'yyyy-MM-dd');
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedSlot || !clientName || !clientEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    const slot = availableSlots.find(s => s.id === selectedSlot);
    if (!slot) {
      toast.error("Selected slot is no longer available");
      return;
    }

    const startDateTime = new Date(selectedDate);
    const [startHour, startMinute] = slot.start_time.split(':');
    startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);

    // Default 15-minute duration
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 15);

    try {
      await createAppointment.mutateAsync({
        appointment_slot_id: slot.id,
        start_datetime: startDateTime.toISOString(),
        end_datetime: endDateTime.toISOString(),
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone || undefined,
        notes: notes || undefined,
        location_id: slot.location_id || undefined,
        status: 'pending',
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedSlot("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setNotes("");
      
      toast.success("Appointment booked successfully! You will receive a confirmation email shortly.");
    } catch (error) {
      console.error('Booking error:', error);
    }
  };

  const minDate = new Date();
  const maxDate = addDays(new Date(), 30); // 30 days advance booking

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Book an Appointment</h1>
          <p className="text-gray-600">Schedule a 15-minute consultation or viewing with our gallery</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Date & Time Selection */}
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
                  onSelect={setSelectedDate}
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
                        onClick={() => setSelectedSlot(slot.id)}
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

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any specific requirements or questions..."
                    rows={3}
                    className="mt-1"
                  />
                </div>

                {selectedDate && selectedSlot && (
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
                          {availableSlots.find(s => s.id === selectedSlot)?.start_time} (15 minutes)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={!selectedDate || !selectedSlot || !clientName || !clientEmail || createAppointment.isPending}
                >
                  {createAppointment.isPending ? 'Booking...' : 'Book Appointment'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
