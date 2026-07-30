import { supabase } from "./supabaseClient";

// Thin wrapper around Supabase Auth (email + password). Kept separate from
// supabaseClient.js so screens import intent ("signIn", "signOut") rather
// than reaching into the raw client directly — same spirit as the rest of
// this app's lib/ files.

export async function signUp({ email, password, name }) {
  // `name` (from Login's sign-up form) is stored as Supabase auth user
  // metadata here for convenience — it's *not* the same field as
  // settings.displayName (see storage.js/Settings.jsx), which the person
  // can also set/change later and is what the rest of the app actually
  // reads from.
  const options = name ? { data: { name } } : undefined;
  const { data, error } = await supabase.auth.signUp({ email, password, options });
  if (error) throw error;

  // Supabase's signUp() does NOT throw for an email that's already
  // registered when "Confirm email" is on (see Authentication -> Providers
  // -> Email in the dashboard) — it returns a 200 with a *fake* user object
  // instead, deliberately, so a stranger probing random addresses can't use
  // the error/no-error split to learn which emails have accounts here. The
  // one reliable tell is `identities` coming back empty (a genuinely new
  // signup always has exactly one identity). Login.jsx was treating this
  // response as a real signup and showing "check your email" for an email
  // that already had an account — no new account was created and nothing
  // was actually sent, so surface the truth here instead of pretending it
  // worked, which is what the person reported hitting.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error("An account already exists for this email — try signing in instead.");
  }
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// App.jsx subscribes once at the top level so every screen can trust
// "logged in or not" without each one polling Supabase itself. Returns the
// unsubscribe function directly (matches the shape useEffect cleanup wants).
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}
