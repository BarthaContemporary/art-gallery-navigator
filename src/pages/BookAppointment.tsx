
import React, { useState } from "react";
import { format, addDays } from "date-fns";
import { useAppointmentSlots, useCreateAppointment } from "@/hooks/use-appointments";
import { useLocations } from "@/hooks/use-locations";
import { toast } from "sonner";
import { DateTimeSelection } from "@/components/appointments/DateTimeSelection";
import { ClientInformationForm } from "@/components/appointments/ClientInformationForm";
import { AppointmentSummary } from "@/components/appointments/AppointmentSummary";
import { BookingSuccessView } from "@/components/appointments/BookingSuccessView";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { supabase } from "@/integrations/supabase/client";
import { validateAppointmentForm } from "@/utils/appointment-validation";

export default function BookAppointment() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const { data: locations = [] } = useLocations();
  const { data: slots = [] } = useAppointmentSlots(selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined);
  const createAppointment = useCreateAppointment();

  // Set default location to Ledbury Mews when locations are loaded
  React.useEffect(() => {
    if (locations.length > 0 && !selectedLocation) {
      const ledburyMews = locations.find(loc => 
        loc.name.toLowerCase().includes('ledbury mews') || 
        loc.name.toLowerCase().includes('ledbury')
      );
      if (ledburyMews) {
        setSelectedLocation(ledburyMews.id);
      } else {
        setSelectedLocation(locations[0].id);
      }
    }
  }, [locations, selectedLocation]);

  const availableSlots = slots.filter(slot => {
    if (slot.recurrence_type === 'weekly') {
      return selectedDate && slot.day_of_week === selectedDate.getDay();
    }
    return selectedDate && slot.date === format(selectedDate, 'yyyy-MM-dd');
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate || !selectedSlot || !clientName || !clientEmail || !selectedLocation) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!captchaToken) {
      toast.error("Please complete the security verification");
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

    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + 15);

    // Validate and sanitize all form inputs
    const validationResult = validateAppointmentForm({
      clientName,
      clientEmail,
      clientPhone,
      notes,
      locationId: selectedLocation,
      slotId: selectedSlot,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    });

    if (!validationResult.success) {
      const failedResult = validationResult as { success: false; errors: string[] };
      failedResult.errors.forEach(error => toast.error(error));
      return;
    }
    
    const validatedData = validationResult.data;

    // Verify CAPTCHA token server-side
    try {
      const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-turnstile', {
        body: { token: captchaToken }
      });

      if (verifyError || !verifyResult?.success) {
        toast.error("Security verification failed. Please try again.");
        setCaptchaToken(null);
        return;
      }
    } catch {
      toast.error("Security verification failed. Please try again.");
      setCaptchaToken(null);
      return;
    }

    // Use validated and sanitized data
    const appointmentData = {
      appointment_slot_id: validatedData.appointment_slot_id,
      start_datetime: validatedData.start_datetime,
      end_datetime: validatedData.end_datetime,
      client_name: validatedData.client_name,
      client_email: validatedData.client_email,
      client_phone: validatedData.client_phone || undefined,
      notes: validatedData.notes || undefined,
      location_id: validatedData.location_id,
      status: 'pending' as const,
    };

    try {
      const result = await createAppointment.mutateAsync(appointmentData);
      
      setBookedAppointment({
        ...result,
        location: locations.find(l => l.id === selectedLocation)
      });

      // Reset form
      setSelectedDate(undefined);
      setSelectedSlot("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setNotes("");
      setCaptchaToken(null);
      
      toast.success("Appointment booked successfully! You will receive a confirmation email shortly.");
    } catch (error) {
      console.error('Booking error:', error);
    }
  };

  const minDate = new Date();
  const maxDate = addDays(new Date(), 30);
  const selectedLocationData = locations.find(l => l.id === selectedLocation);
  const selectedSlotData = availableSlots.find(s => s.id === selectedSlot);

  const isFormValid = selectedDate && selectedSlot && clientName && clientEmail && selectedLocation && captchaToken;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {bookedAppointment ? (
          <BookingSuccessView
            appointment={bookedAppointment}
            onBookAnother={() => setBookedAppointment(null)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <DateTimeSelection
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              selectedSlot={selectedSlot}
              onSlotSelect={setSelectedSlot}
              availableSlots={availableSlots}
              minDate={minDate}
              maxDate={maxDate}
            />

            <div className="space-y-4">
              <ClientInformationForm
                clientName={clientName}
                onClientNameChange={setClientName}
                clientEmail={clientEmail}
                onClientEmailChange={setClientEmail}
                clientPhone={clientPhone}
                onClientPhoneChange={setClientPhone}
                selectedLocation={selectedLocation}
                onLocationChange={setSelectedLocation}
                notes={notes}
                onNotesChange={setNotes}
                locations={locations}
                onSubmit={handleSubmit}
                isSubmitting={createAppointment.isPending}
                isFormValid={!!isFormValid}
                onCaptchaVerify={setCaptchaToken}
                captchaVerified={!!captchaToken}
              />

              {selectedDate && selectedSlotData && selectedLocationData && (
                <AppointmentSummary
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlotData}
                  selectedLocation={selectedLocationData}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
