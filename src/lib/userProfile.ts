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

export async function findByContact(email: string, phone: string): Promise<UserProfile | null> {
  if (!email && !phone) return null;
  const { data } = await supabase.rpc('find_user_by_contact', {
    p_email: email || null,
    p_phone: phone || null,
  });
  return (data as UserProfile[] | null)?.[0] ?? null;
}

export async function createProfile(p: Omit<UserProfile, 'id'>): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .insert({ name: p.name, email: p.email || null, phone: p.phone || null, emoji: p.emoji, photo_url: p.photo_url || null })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as UserProfile;
}

export async function updateProfile(id: string, patch: Partial<Omit<UserProfile, 'id'>>): Promise<void> {
  await supabase.from('user_profiles').update(patch).eq('id', id);
}

export async function uploadProfilePhoto(file: File, profileId: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${profileId}.${ext}`;
  const { error } = await supabase.storage.from('profile-photos').upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return publicUrl;
}

export async function fetchById(id: string): Promise<UserProfile | null> {
  const { data } = await supabase.from('user_profiles').select().eq('id', id).single();
  return data as UserProfile | null;
}

export function saveProfileId(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function loadProfileId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
