
-- 1. Renomear valor do enum paroquiano → dizimista
ALTER TYPE app_role RENAME VALUE 'paroquiano' TO 'dizimista';

-- 2. Atualizar função handle_new_user para usar 'dizimista'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, nome_completo, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email),
    NEW.email
  );
  
  -- Atribuir role dizimista por padrão
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'dizimista');
  
  RETURN NEW;
END;
$function$;

-- 3. Atualizar get_user_role para ordenar corretamente com 'dizimista'
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'dizimista' THEN 3
      WHEN 'totem' THEN 4
    END
  LIMIT 1
$function$;
