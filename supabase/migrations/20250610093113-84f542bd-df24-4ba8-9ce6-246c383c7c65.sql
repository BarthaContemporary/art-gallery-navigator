
-- Create enum types for appointment system
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE appointment_recurrence AS ENUM ('none', 'weekly', 'daily');

-- Create appointment types table
CREATE TABLE public.appointment_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create appointment slots table (admin-defined availability)
CREATE TABLE public.appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  date DATE,
  recurrence_type appointment_recurrence DEFAULT 'none',
  recurrence_end_date DATE,
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc. for recurring slots
  location_id UUID REFERENCES public.locations(id),
  appointment_type_id UUID REFERENCES public.appointment_types(id),
  is_available BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create appointments table (actual bookings)
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_slot_id UUID REFERENCES public.appointment_slots(id),
  client_id UUID REFERENCES public.clients(id),
  appointment_type_id UUID REFERENCES public.appointment_types(id),
  start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  status appointment_status DEFAULT 'pending',
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  notes TEXT,
  admin_notes TEXT,
  location_id UUID REFERENCES public.locations(id),
  confirmed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create booking settings table
CREATE TABLE public.booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_booking_days INTEGER DEFAULT 30,
  buffer_time_minutes INTEGER DEFAULT 15,
  auto_confirm BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '17:00',
  working_days INTEGER[] DEFAULT '{1,2,3,4,5}', -- Monday to Friday
  notification_email TEXT,
  booking_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default appointment types
INSERT INTO public.appointment_types (name, description, duration_minutes, color) VALUES
('Consultation', 'General consultation meeting', 60, '#3B82F6'),
('Artwork Viewing', 'Private artwork viewing session', 90, '#10B981'),
('Collection Review', 'Review of art collection', 120, '#8B5CF6');

-- Insert default booking settings
INSERT INTO public.booking_settings (advance_booking_days, buffer_time_minutes, auto_confirm) VALUES (30, 15, false);

-- Enable RLS on all tables
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointment_types
CREATE POLICY "Anyone can view appointment types" ON public.appointment_types FOR SELECT USING (true);
CREATE POLICY "Only admins can manage appointment types" ON public.appointment_types FOR ALL USING (public.has_role(auth.uid(), 'gallery_admin'));

-- RLS Policies for appointment_slots
CREATE POLICY "Anyone can view available appointment slots" ON public.appointment_slots FOR SELECT USING (is_available = true);
CREATE POLICY "Only admins can manage appointment slots" ON public.appointment_slots FOR ALL USING (public.has_role(auth.uid(), 'gallery_admin'));

-- RLS Policies for appointments
CREATE POLICY "Admins can view all appointments" ON public.appointments FOR SELECT USING (public.has_role(auth.uid(), 'gallery_admin'));
CREATE POLICY "Anyone can create appointments" ON public.appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Only admins can update appointments" ON public.appointments FOR UPDATE USING (public.has_role(auth.uid(), 'gallery_admin'));
CREATE POLICY "Only admins can delete appointments" ON public.appointments FOR DELETE USING (public.has_role(auth.uid(), 'gallery_admin'));

-- RLS Policies for booking_settings
CREATE POLICY "Anyone can view booking settings" ON public.booking_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can manage booking settings" ON public.booking_settings FOR ALL USING (public.has_role(auth.uid(), 'gallery_admin'));

-- Create indexes for performance
CREATE INDEX idx_appointment_slots_date ON public.appointment_slots(date);
CREATE INDEX idx_appointment_slots_recurrence ON public.appointment_slots(recurrence_type, day_of_week);
CREATE INDEX idx_appointments_datetime ON public.appointments(start_datetime, end_datetime);
CREATE INDEX idx_appointments_status ON public.appointments(status);
