import { supabase } from '../supabase/client';
import type { Profile } from '../supabase/client';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
}

export async function hasRole(roles: string[]) {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  return roles.includes(profile.role);
}

export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: Profile['role'],
  phone?: string
) {
  // Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('User creation failed');

  // Create profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert([{
      id: authData.user.id,
      email,
      full_name: fullName,
      role,
      phone,
      is_active: true
    }]);

  if (profileError) throw profileError;

  return authData.user;
}

export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deactivateUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: false })
    .eq('id', userId);

  if (error) throw error;
}

export async function activateUser(userId: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: true })
    .eq('id', userId);

  if (error) throw error;
}
