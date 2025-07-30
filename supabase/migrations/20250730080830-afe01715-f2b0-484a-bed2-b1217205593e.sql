-- Update Rudolf de Crignis to Estate of Rudolf de Crignis
UPDATE public.artists 
SET full_name = 'Estate of Rudolf de Crignis',
    updated_at = NOW()
WHERE full_name = 'Rudolf de Crignis';

-- Update James Howell to Estate of James Howell  
UPDATE public.artists 
SET full_name = 'Estate of James Howell',
    updated_at = NOW()
WHERE full_name = 'James Howell';