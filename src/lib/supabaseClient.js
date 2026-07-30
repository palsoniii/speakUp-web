import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True once VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (see
// .env.example). App.jsx checks this before rendering the real app so a
// clone of this repo without Supabase set up yet gets a clear setup
// screen instead of a blank crash.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;
