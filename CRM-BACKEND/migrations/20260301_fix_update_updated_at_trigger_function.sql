CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF to_jsonb(NEW) ? 'updatedAt' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updatedAt', CURRENT_TIMESTAMP));
  ELSIF to_jsonb(NEW) ? 'updated_at' THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('updated_at', CURRENT_TIMESTAMP));
  END IF;

  RETURN NEW;
END;
$function$;
