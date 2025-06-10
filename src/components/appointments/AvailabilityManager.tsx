
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useAppointmentTypes, useCreateAppointmentSlot } from "@/hooks/use-appointments";
import { useLocation } from "@/hooks/use-locations";

export function AvailabilityManager() {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'weekly' | 'daily'>('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedType, setSelectedType] = useState("");

  const { data: appointmentTypes = [] } = useAppointmentTypes();
  const { data: locations = [] } = useLocation();
  const createSlot = useCreateAppointmentSlot();

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startTime || !endTime) return;

    if (recurrenceType === 'none' && !selectedDate) return;
    if (recurrenceType === 'weekly' && selectedDays.length === 0) return;

    if (recurrenceType === 'weekly') {
      // Create slots for each selected day
      selectedDays.forEach(dayOfWeek => {
        createSlot.mutate({
          start_time: startTime,
          end_time: endTime,
          recurrence_type: 'weekly',
          day_of_week: dayOfWeek,
          location_id: selectedLocation || undefined,
          appointment_type_id: selectedType || undefined,
          is_available: true,
        });
      });
    } else {
      createSlot.mutate({
        start_time: startTime,
        end_time: endTime,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        recurrence_type,
        location_id: selectedLocation || undefined,
        appointment_type_id: selectedType || undefined,
        is_available: true,
      });
    }

    // Reset form
    setStartTime("");
    setEndTime("");
    setSelectedDate(undefined);
    setSelectedDays([]);
    setRecurrenceType('none');
    setSelectedLocation("");
    setSelectedType("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Recurrence</Label>
              <Select value={recurrenceType} onValueChange={(value: any) => setRecurrenceType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-time</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {recurrenceType === 'weekly' && (
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {daysOfWeek.map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDays([...selectedDays, day.value]);
                          } else {
                            setSelectedDays(selectedDays.filter(d => d !== day.value));
                          }
                        }}
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recurrenceType === 'none' && (
              <div>
                <Label>Date</Label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border mt-2"
                />
              </div>
            )}

            <div>
              <Label>Location (Optional)</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Appointment Type (Optional)</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={createSlot.isPending}>
              {createSlot.isPending ? 'Creating...' : 'Add Availability'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Quick Add Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Set up your regular weekly availability quickly. You can always modify individual slots later.
          </p>
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Business Hours Template</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Monday - Friday, 9:00 AM - 5:00 PM
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setStartTime("09:00");
                  setEndTime("17:00");
                  setRecurrenceType("weekly");
                  setSelectedDays([1, 2, 3, 4, 5]);
                }}
              >
                Apply Template
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
