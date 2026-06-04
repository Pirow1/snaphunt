import { supabase } from './supabase';

const STORAGE_KEY = 'potch_user_profile_id';

export interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  emoji: string;
}

// All profile access goes through SECURITY DEFINER RPCs (migration 0021). The
// user_profiles table is locked to anon/authenticated, so contact fields never
// leave the database except to the row's owner. Lookups return display fields
// only (email/phone come back null).

export async function findByContact(email: string, phone: string): Promise<UserProfile | null> {
  if (!email && !phone) return null;
  const { data } = await supabase.rpc('find_user_by_contact', {
    p_email: email || null,
    p_phone: phone || null,
  });
  return (data as UserProfile[] | null)?.[0] ?? null;
}

export async function createProfile(p: Omit<UserProfile, 'id'>): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('create_user_profile', {
    p_name: p.name,
    p_emoji: p.emoji,
    p_email: p.email || null,
    p_phone: p.phone || null,
    p_photo_url: p.photo_url || null,
  });
  if (error) throw new Error(error.message);
  const row = (data as UserProfile[] | null)?.[0];
  if (!row) throw new Error('Could not create profile.');
  return row;
}

export async function updateProfile(id: string, patch: Partial<Omit<UserProfile, 'id'>>): Promise<void> {
  const { error } = await supabase.rpc('update_user_profile', {
    p_id: id,
    p_name: patch.name ?? null,
    p_emoji: patch.emoji ?? null,
    p_email: patch.email ?? null,
    p_phone: patch.phone ?? null,
    p_photo_url: patch.photo_url ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function uploadProfilePhoto(file: File, profileId: string): Promise<string> {
  // Writes are scoped to the caller's own uid folder (storage RLS, migration
  // 0021), so the path must be prefixed with the authenticated user id.
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error('Not signed in yet.');
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${uid}/${profileId}.${ext}`;
  const { error } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return publicUrl;
}

export async function fetchById(id: string): Promise<UserProfile | null> {
  const { data } = await supabase.rpc('get_user_profile', { p_id: id });
  return (data as UserProfile[] | null)?.[0] ?? null;
}

export function saveProfileId(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function loadProfileId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
