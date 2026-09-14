import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || 'https://pihcrrtnvucadjlsmrii.supabase.co';
const rawKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VlgWzbCFybmDCogmjfKUDw_I6KOPymx';

export const supabaseUrl = rawUrl.replace(/["']/g, '').trim();
export const supabaseKey = rawKey.replace(/["']/g, '').trim();

export const supabase = createClient(supabaseUrl, supabaseKey);