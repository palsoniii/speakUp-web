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

// Sends a password-reset email containing a link back to this same app
// (redirectTo: the current origin). Supabase's client picks the recovery
// token up from the URL automatically on load and fires a
// PASSWORD_RECOVERY event via onAuthStateChange below — App.jsx listens for
// that to show the "set a new password" screen rather than dropping the
// visitor straight into the signed-in app on a temporary recovery session.
//
// Deliberately does NOT throw (or distinguish) for an email with no
// account — same "don't let the response shape reveal who has an account
// here" reasoning as the identities check in signUp above. Supabase itself
// already behaves this way (success either way), so this is just naming
// that on purpose rather than it being an accident.
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

// Called from the "set a new password" screen once someone has landed back
// here via the reset-link's recovery session. Supabase requires an active
// session to call this — the recovery link itself is what provides one.
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
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
// Passes the event name through (not just the session) so App.jsx can tell
// a PASSWORD_RECOVERY session — created automatically when someone lands
// back here via a reset-password email link — apart from a normal sign-in,
// and show the "set a new password" screen instead of the signed-in app.
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
  return () => subscription.unsubscribe();
}
