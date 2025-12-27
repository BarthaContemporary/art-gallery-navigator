import { z } from 'zod';

// Validation constants
export const APPOINTMENT_LIMITS = {
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  NOTES_MAX_LENGTH: 500,
} as const;

// Phone regex - allows common formats: +1 234-567-8901, (234) 567-8901, 234.567.8901, etc.
const phoneRegex = /^[\d\s\-+().]*$/;

// Comprehensive email regex
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Schema for appointment booking form validation
export const appointmentFormSchema = z.object({
  client_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(APPOINTMENT_LIMITS.NAME_MAX_LENGTH, `Name must be less than ${APPOINTMENT_LIMITS.NAME_MAX_LENGTH} characters`)
    .regex(/^[a-zA-Z\s\-'.]+$/, 'Name can only contain letters, spaces, hyphens, apostrophes, and periods'),
  
  client_email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .max(APPOINTMENT_LIMITS.EMAIL_MAX_LENGTH, `Email must be less than ${APPOINTMENT_LIMITS.EMAIL_MAX_LENGTH} characters`)
    .email('Please enter a valid email address')
    .regex(emailRegex, 'Please enter a valid email address'),
  
  client_phone: z
    .string()
    .trim()
    .max(APPOINTMENT_LIMITS.PHONE_MAX_LENGTH, `Phone must be less than ${APPOINTMENT_LIMITS.PHONE_MAX_LENGTH} characters`)
    .regex(phoneRegex, 'Phone can only contain numbers, spaces, hyphens, plus signs, parentheses, and periods')
    .optional()
    .or(z.literal('')),
  
  notes: z
    .string()
    .trim()
    .max(APPOINTMENT_LIMITS.NOTES_MAX_LENGTH, `Notes must be less than ${APPOINTMENT_LIMITS.NOTES_MAX_LENGTH} characters`)
    .optional()
    .or(z.literal('')),
  
  location_id: z.string().uuid('Invalid location selected'),
  
  appointment_slot_id: z.string().uuid('Invalid slot selected'),
  
  start_datetime: z.string().datetime('Invalid start date/time'),
  
  end_datetime: z.string().datetime('Invalid end date/time'),
});

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

// Sanitize text input by removing potentially harmful characters
export function sanitizeTextInput(input: string, maxLength: number): string {
  if (!input) return '';
  
  return input
    .trim()
    .slice(0, maxLength)
    // Remove control characters except newlines and tabs for notes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Remove potential script injection patterns
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

// Validate and sanitize a complete appointment form submission
export function validateAppointmentForm(data: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
  locationId: string;
  slotId: string;
  startDateTime: string;
  endDateTime: string;
}): { success: true; data: AppointmentFormData } | { success: false; errors: string[] } {
  // First sanitize inputs
  const sanitizedData = {
    client_name: sanitizeTextInput(data.clientName, APPOINTMENT_LIMITS.NAME_MAX_LENGTH),
    client_email: sanitizeTextInput(data.clientEmail, APPOINTMENT_LIMITS.EMAIL_MAX_LENGTH).toLowerCase(),
    client_phone: sanitizeTextInput(data.clientPhone, APPOINTMENT_LIMITS.PHONE_MAX_LENGTH),
    notes: sanitizeTextInput(data.notes, APPOINTMENT_LIMITS.NOTES_MAX_LENGTH),
    location_id: data.locationId,
    appointment_slot_id: data.slotId,
    start_datetime: data.startDateTime,
    end_datetime: data.endDateTime,
  };

  // Then validate with zod
  const result = appointmentFormSchema.safeParse(sanitizedData);

  if (!result.success) {
    const errors = result.error.errors.map(e => e.message);
    return { success: false, errors };
  }

  return { success: true, data: result.data };
}
