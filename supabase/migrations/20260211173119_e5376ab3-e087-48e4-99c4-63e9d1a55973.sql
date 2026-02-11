
-- Add unique constraint for upsert to work
ALTER TABLE public.custom_fields
ADD CONSTRAINT custom_fields_account_entity_field_user_unique
UNIQUE (account_id, entity_type, entity_id, field_name, user_id);
