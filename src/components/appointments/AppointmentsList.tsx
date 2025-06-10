
import React, { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, MapPin, User, Phone, Mail, MessageSquare, Check, X, Calendar } from "lucide-react";
import { useAppointments, useUpdateAppointment } from "@/hooks/use-appointments";

export function AppointmentsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: appointments = [], isLoading } = useAppointments();
  const updateAppointment = useUpdateAppointment();

  const filteredAppointments = appointments.filter(appointment => {
    const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;
    const matchesSearch = searchTerm === "" || 
      appointment.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      appointment.client_email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    updateAppointment.mutate({
      id: appointmentId,
      status: newStatus as any,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search by client name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {searchTerm || statusFilter !== "all" 
              ? "No appointments match your filters"
              : "No appointments scheduled yet"
            }
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <Card key={appointment.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{appointment.client_name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${getStatusColor(appointment.status)} text-white border-0`}
                    >
                      {appointment.status}
                    </Badge>
                    {appointment.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(appointment.id, 'confirmed')}
                          className="h-8 w-8 p-0"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStatusChange(appointment.id, 'cancelled')}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(appointment.start_datetime), 'MMMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(appointment.start_datetime), 'h:mm a')} - 
                      {format(new Date(appointment.end_datetime), 'h:mm a')}
                    </div>
                    {appointment.appointment_types && (
                      <div className="flex items-center gap-2 text-sm">
                        <div 
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: appointment.appointment_types.color }}
                        />
                        {appointment.appointment_types.name}
                      </div>
                    )}
                    {appointment.locations && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {appointment.locations.name}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {appointment.client_email}
                    </div>
                    {appointment.client_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {appointment.client_phone}
                      </div>
                    )}
                    {appointment.notes && (
                      <div className="flex items-start gap-2 text-sm">
                        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <p className="bg-muted p-2 rounded text-xs">
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
