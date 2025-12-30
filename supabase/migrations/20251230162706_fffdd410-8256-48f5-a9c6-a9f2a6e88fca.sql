-- Fix search_path for the trigger function
CREATE OR REPLACE FUNCTION public.update_title_function_map_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;