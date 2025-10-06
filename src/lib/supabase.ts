import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eymxpphofhhfeuvaqfad.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MxUJ_jmjdv0lMaLHGk3fMg_MBQ0mI70'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)