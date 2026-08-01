/**
 * Shared Supabase client factory for Edge Functions.
 * Validates required environment variables before creating clients.
 * Compatible with both Lovable Cloud and external Supabase instances.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EnvVars {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceRoleKey: string
}

/**
 * Reads and validates required Supabase environment variables.
 * Throws a descriptive error if any are missing.
 */
export function getEnvVars(): EnvVars {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const missing: string[] = []
  if (!supabaseUrl) missing.push('SUPABASE_URL')
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Set them via: supabase secrets set ${missing.map(k => `${k}=<value>`).join(' ')}`
    )
  }

  return {
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
  }
}

/**
 * Creates a Supabase admin client (service_role) with env validation.
 */
export function createAdminClient(): SupabaseClient {
  const env = getEnvVars()
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey)
}

/**
 * Creates a Supabase client using the anon key with the caller's auth header.
 */
export function createUserClient(authHeader: string): SupabaseClient {
  const env = getEnvVars()
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}

/**
 * Standard CORS headers for Edge Functions.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, ' +
    'x-supabase-client-platform, x-supabase-client-platform-version, ' +
    'x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/**
 * Helper to return a JSON error response.
 */
export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Helper to return a JSON success response.
 */
export function jsonOk(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
