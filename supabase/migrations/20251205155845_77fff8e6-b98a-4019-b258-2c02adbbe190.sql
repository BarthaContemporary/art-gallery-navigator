-- Add unique constraint on user_id for crm_integration_config (needed for upsert)
ALTER TABLE public.crm_integration_config 
ADD CONSTRAINT crm_integration_config_user_id_unique UNIQUE (user_id);