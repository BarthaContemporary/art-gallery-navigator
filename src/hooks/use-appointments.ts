
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Appointment {
  id: string;
  appointment_slot_id?: string;
  client_id?: string;
  appointment_type_id?: string;
  start_datetime: string;
  end_datetime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  client_name: string;
  client_email: string;
  client_phone?: string;
  notes?: string;
  admin_notes?: string;
  location_id?: string;
  confirmed_by?: string;
  created_at: string;
  updated_at: string;
  appointment_types?: {
    name: string;
    color: string;
  };
  locations?: {
    name: string;
  };
}

export interface AppointmentSlot {
  id: string;
  start_time: string;
  end_time: string;
  date?: string;
  recurrence_type: 'none' | 'weekly' | 'daily';
  recurrence_end_date?: string;
  day_of_week?: number;
  location_id?: string;
  appointment_type_id?: string;
  is_available: boolean;
  created_by?: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  color: string;
  is_active: boolean;
}

export function useAppointments(date?: string) {
  return useQuery({
    queryKey: ['appointments', date],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          appointment_types(name, color),
          locations(name)
        `)
        .order('start_datetime', { ascending: true });

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        
        query = query
          .gte('start_datetime', startOfDay.toISOString())
          .lte('start_datetime', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Appointment[];
    },
  });
}

export function useAppointmentTypes() {
  return useQuery({
    queryKey: ['appointment-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as AppointmentType[];
    },
  });
}

export function useAppointmentSlots(date?: string) {
  return useQuery({
    queryKey: ['appointment-slots', date],
    queryFn: async () => {
      let query = supabase
        .from('appointment_slots')
        .select('*')
        .eq('is_available', true);

      if (date) {
        const dayOfWeek = new Date(date).getDay();
        query = query.or(`date.eq.${date},and(recurrence_type.eq.weekly,day_of_week.eq.${dayOfWeek})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AppointmentSlot[];
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select()
        .single();
      if (error) throw error;
      
      // Trigger email notifications
      try {
        // Send confirmation email to client
        await supabase.functions.invoke('send-appointment-email', {
          body: {
            appointmentId: data.id,
            emailType: 'confirmation'
          }
        });

        // Send admin notification
        await supabase.functions.invoke('send-appointment-email', {
          body: {
            appointmentId: data.id,
            emailType: 'admin_notification'
          }
        });
      } catch (emailError) {
        console.error('Error sending appointment emails:', emailError);
        // Don't fail the appointment creation if emails fail
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment booked successfully');
    },
    onError: (error) => {
      toast.error('Failed to book appointment: ' + error.message);
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Appointment> & { id: string }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      
      // Send email notification if status changed to cancelled
      if (updates.status === 'cancelled') {
        try {
          await supabase.functions.invoke('send-appointment-email', {
            body: {
              appointmentId: id,
              emailType: 'cancellation'
            }
          });
        } catch (emailError) {
          console.error('Error sending cancellation email:', emailError);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update appointment: ' + error.message);
    },
  });
}

export function useCreateAppointmentSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slot: Omit<AppointmentSlot, 'id'>) => {
      const { data, error } = await supabase
        .from('appointment_slots')
        .insert(slot)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-slots'] });
      toast.success('Availability slot created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create slot: ' + error.message);
    },
  });
}
