import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Edit, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Appointment } from "@/hooks/use-appointments";
import { UpdateAppointmentDialog } from "./UpdateAppointmentDialog";
import { AddToCalendarButton } from "./AddToCalendarButton";

interface AppointmentsListProps {
  appointments: Appointment[];
  onUpdate: (appointment: Appointment) => void;
  onDelete: (id: string) => void;
}

export const AppointmentsList: React.FC<AppointmentsListProps> = ({
  appointments,
  onUpdate,
  onDelete,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appointments</CardTitle>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p>No appointments scheduled.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <AppointmentCard appointment={appointment} onUpdate={onUpdate} onDelete={onDelete} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

const AppointmentCard = ({ appointment, onUpdate, onDelete }: { appointment: Appointment; onUpdate: (appointment: Appointment) => void, onDelete: (id: string) => void }) => {
  const [open, setOpen] = useState(false);

  const handleUpdate = (updatedAppointment: Appointment) => {
    onUpdate(updatedAppointment);
    setOpen(false);
  };

  return (
    <Card className={`transition-all duration-200 ${appointment.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="font-semibold">{appointment.client_name}</div>
            <div className="text-sm text-muted-foreground">
              {appointment.client_email}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="font-semibold">
              {format(new Date(appointment.start_datetime), "MMM d, yyyy")}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(appointment.start_datetime), "h:mm a")}
            </div>
          </div>

          <div>
            {appointment.appointment_types ? (
              <Badge
                className="gap-1"
                style={{ backgroundColor: appointment.appointment_types?.color }}
              >
                {appointment.appointment_types?.name}
              </Badge>
            ) : (
              <Badge variant="outline">No Type</Badge>
            )}
          </div>

          <div>
            {appointment.locations ? (
              <Badge variant="secondary">{appointment.locations?.name}</Badge>
            ) : (
              <Badge variant="outline">No Location</Badge>
            )}
          </div>

          <div>
            <Badge
              variant="default"
              className="capitalize"
            >
              {appointment.status}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <AddToCalendarButton 
              appointment={appointment} 
              variant="ghost" 
              size="sm" 
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setOpen(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Update
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(appointment.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {appointment.notes && (
          <div className="mt-4 text-sm text-muted-foreground">
            Notes: {appointment.notes}
          </div>
        )}
      </CardContent>
      <UpdateAppointmentDialog
        open={open}
        setOpen={setOpen}
        appointment={appointment}
        onUpdate={handleUpdate}
      />
    </Card>
  );
};
