import { supabase } from "../lib/supabaseClient";

export async function signUpWithEmail(email: string, password: string) {
  return await supabase.auth.signUp({ email, password });
}

export async function signInWithEmail(email: string, password: string) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function resetPassword(email: string) {
  return await supabase.auth.resetPasswordForEmail(email);
}

export async function signInWithGoogle() {
  return await supabase.auth.signInWithOAuth({ provider: "google" });
}
