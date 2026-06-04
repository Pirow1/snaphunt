-- M1 security hardening: close the user_profiles PII leak shipped in 0018.
--
-- 0018 created `USING (true)` SELECT/INSERT/UPDATE policies on user_profiles, so
-- anyone holding the public anon key could dump or overwrite every player's
-- name/email/phone. It also gave the public profile-photos bucket an
-- unrestricted upload policy (arbitrary writes / avatar squatting).
--
-- New model:
--   * user_profiles is locked (RLS on, NO permissive policies -> deny-by-default).
--     All access goes through SECURITY DEFINER RPCs.
--   * Contact fields (email/phone) are returned ONLY to the row's owner; the
--     returning-player lookup returns display fields only, never contact info.
--   * Writes require ownership (owner_uid = auth.uid()), with two escape hatches:
--     a null owner (legacy rows) and contact-knowledge claim (the returning
--     player typed an email/phone that matches the row). The latter is the
--     honest security boundary for a no-login party game: knowing the contact
--     lets you claim the profile. Documented as a residual tradeoff.
--   * Profile photos stay public-READ (avatars are low-sensitivity) but WRITES
--     are scoped to the caller's own uid folder.

-- ---------------------------------------------------------------------------
-- 1. Ownership column
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS owner_uid UUID;

-- ---------------------------------------------------------------------------
-- 2. Drop the permissive policies. RLS stays ENABLED -> table is now
--    deny-by-default for anon/authenticated. SECURITY DEFINER RPCs (which run
--    as the function owner) are unaffected and become the only access path.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read user_profiles"   ON public.user_profiles;
DROP POLICY IF EXISTS "Public insert user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public update user_profiles" ON public.user_profiles;

-- ---------------------------------------------------------------------------
-- 3. Display getter — contact fields only to the owner.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_profile(UUID);
CREATE FUNCTION public.get_user_profile(p_id UUID)
RETURNS TABLE(id UUID, name TEXT, email TEXT, phone TEXT, photo_url TEXT, emoji TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT up.id, up.name,
         CASE WHEN up.owner_uid = auth.uid() THEN up.email ELSE NULL END,
         CASE WHEN up.owner_uid = auth.uid() THEN up.phone ELSE NULL END,
         up.photo_url, up.emoji
  FROM public.user_profiles up
  WHERE up.id = p_id;
$$;

-- ---------------------------------------------------------------------------
-- 4. Returning-player lookup — display fields ONLY, never contact info.
--    (Return type changes, so drop the 0018 version first.)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.find_user_by_contact(TEXT, TEXT);
CREATE FUNCTION public.find_user_by_contact(p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, name TEXT, email TEXT, phone TEXT, photo_url TEXT, emoji TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT up.id, up.name, NULL::TEXT, NULL::TEXT, up.photo_url, up.emoji
  FROM public.user_profiles up
  WHERE (p_email IS NOT NULL AND p_email <> '' AND lower(up.email) = lower(p_email))
     OR (p_phone IS NOT NULL AND p_phone <> '' AND up.phone = p_phone)
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 5. Create — row is owned by the caller.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_user_profile(TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.create_user_profile(
  p_name TEXT, p_emoji TEXT, p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_photo_url TEXT DEFAULT NULL
) RETURNS TABLE(id UUID, name TEXT, email TEXT, phone TEXT, photo_url TEXT, emoji TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_row public.user_profiles%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  IF length(coalesce(p_name,'')) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'name must be 1-24 chars' USING ERRCODE = 'P0004';
  END IF;
  INSERT INTO public.user_profiles (name, emoji, email, phone, photo_url, owner_uid)
  VALUES (p_name, coalesce(nullif(p_emoji,''),'🎮'), nullif(p_email,''), nullif(p_phone,''), nullif(p_photo_url,''), v_uid)
  RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.id, v_row.name, v_row.email, v_row.phone, v_row.photo_url, v_row.emoji;
END; $$;

-- ---------------------------------------------------------------------------
-- 6. Update — owner, legacy null-owner, or contact-knowledge claim. Adopts
--    ownership on success. NULL/empty params leave existing values untouched.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_user_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.update_user_profile(
  p_id UUID, p_name TEXT DEFAULT NULL, p_emoji TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL, p_photo_url TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_row public.user_profiles%rowtype; v_allowed BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_row FROM public.user_profiles WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002'; END IF;
  v_allowed := v_row.owner_uid IS NULL
            OR v_row.owner_uid = v_uid
            OR (p_email IS NOT NULL AND p_email <> '' AND lower(v_row.email) = lower(p_email))
            OR (p_phone IS NOT NULL AND p_phone <> '' AND v_row.phone = p_phone);
  IF NOT v_allowed THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = 'P0005'; END IF;
  UPDATE public.user_profiles SET
    name      = coalesce(nullif(p_name,''), name),
    emoji     = coalesce(nullif(p_emoji,''), emoji),
    email     = CASE WHEN p_email     IS NOT NULL AND p_email     <> '' THEN p_email     ELSE email     END,
    phone     = CASE WHEN p_phone     IS NOT NULL AND p_phone     <> '' THEN p_phone     ELSE phone     END,
    photo_url = CASE WHEN p_photo_url IS NOT NULL AND p_photo_url <> '' THEN p_photo_url ELSE photo_url END,
    owner_uid = v_uid
  WHERE id = p_id;
END; $$;

-- ---------------------------------------------------------------------------
-- 7. Grants — these ARE intentional RPC endpoints (called from the client).
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.get_user_profile(UUID)                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_user_by_contact(TEXT,TEXT)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_user_profile(TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_profile(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_user_profile(UUID)                       TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.find_user_by_contact(TEXT,TEXT)              TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_user_profile(TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_user_profile(UUID,TEXT,TEXT,TEXT,TEXT,TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Storage: keep public READ of avatars, scope WRITES to the caller's folder.
--    Upload path becomes `<auth.uid()>/<profileId>.<ext>`.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public upload profile-photos"  ON storage.objects;
DROP POLICY IF EXISTS "Owner upload profile-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Owner update profile-photos"   ON storage.objects;
DROP POLICY IF EXISTS "Owner delete profile-photos"   ON storage.objects;
CREATE POLICY "Owner upload profile-photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner update profile-photos" ON storage.objects FOR UPDATE
  USING      (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner delete profile-photos" ON storage.objects FOR DELETE
  USING      (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
