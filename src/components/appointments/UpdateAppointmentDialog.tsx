
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Appointment, useUpdateAppointment } from "@/hooks/use-appointments";
import { useLocations } from "@/hooks/use-locations";
import { format } from "date-fns";
import { toast } from "sonner";

interface UpdateAppointmentDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  appointment: Appointment;
  onUpdate: (appointment: Appointment) => void;
}

export function UpdateAppointmentDialog({ 
  open, 
  setOpen, 
  appointment, 
  onUpdate 
}: UpdateAppointmentDialogProps) {
  const [clientName, setClientName] = useState(appointment.client_name);
  const [clientEmail, setClientEmail] = useState(appointment.client_email);
  const [clientPhone, setClientPhone] = useState(appointment.client_phone || "");
  const [notes, setNotes] = useState(appointment.notes || "");
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'cancelled' | 'completed'>(appointment.status);

  const { data: locations = [] } = useLocations();
  const updateAppointment = useUpdateAppointment();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const updatedData = {
        ...appointment,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone || null,
        notes: notes || null,
        status: status,
      };

      await updateAppointment.mutateAsync(updatedData);
      onUpdate(updatedData);
      toast.success("Appointment updated successfully");
    } catch (error) {
      console.error("Error updating appointment:", error);
      toast.error("Failed to update appointment");
    }
  };

  const handleStatusChange = (value: string) => {
    setStatus(value as 'pending' | 'confirmed' | 'cancelled' | 'completed');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Appointment</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="datetime">Date & Time</Label>
            <Input
              id="datetime"
              value={format(new Date(appointment.start_datetime), "MMM d, yyyy 'at' h:mm a")}
              disabled
              className="bg-gray-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_name">Client Name</Label>
            <Input
              id="client_name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_email">Client Email</Label>
            <Input
              id="client_email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_phone">Client Phone</Label>
            <Input
              id="client_phone"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateAppointment.isPending}>
              {updateAppointment.isPending ? "Updating..." : "Update"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
