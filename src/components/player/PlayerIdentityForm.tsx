import { useEffect, useRef, useState } from 'react';
import {
  findByContact,
  createProfile,
  updateProfile,
  uploadProfilePhoto,
  fetchById,
  saveProfileId,
  loadProfileId,
  type UserProfile,
} from '../../lib/userProfile';

type Identity = {
  name: string;
  emoji: string;
  photoUrl: string | null;
  userProfileId: string;
};

type Props = {
  variant: 'snaphunt' | 'rushb';
  namePlaceholder?: string;
  emojiOptions: readonly string[];
  onComplete: (identity: Identity) => void;
  disabled?: boolean;
};

export function PlayerIdentityForm({ variant, namePlaceholder, emojiOptions, onComplete, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [emoji, setEmoji]     = useState<string>(emojiOptions[0] ?? '🎮');
  const [photoFile, setPhotoFile]   = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [profileId, setProfileId]   = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Returning-player detection state
  const [matched, setMatched]           = useState<UserProfile | null>(null);
  const [showReturnDialog, setShowReturnDialog] = useState(false);

  // On mount: check localStorage for a saved profile
  useEffect(() => {
    const saved = loadProfileId();
    if (!saved) return;
    fetchById(saved).then((profile) => {
      if (!profile) return;
      setProfileId(profile.id);
      setName(profile.name);
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
      setEmoji(profile.emoji);
      setExistingPhotoUrl(profile.photo_url);
    }).catch(() => { /* ignore stale id */ });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreview(url);
  }

  async function handleSubmit() {
    if (disabled || submitting) return;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 24) {
      setError('Name must be 1–24 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Check for returning player if contact provided
      if ((email || phone) && !showReturnDialog) {
        const found = await findByContact(email, phone);
        if (found && found.id !== profileId) {
          setMatched(found);
          setShowReturnDialog(true);
          setSubmitting(false);
          return;
        }
      }
      await finalize(trimmed, false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  async function handleConfirmReturn() {
    if (!matched) return;
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = name.trim();
      // Use existing matched profile, update name/emoji if changed
      await updateProfile(matched.id, {
        name: trimmed || matched.name,
        emoji,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      });
      const finalPhotoUrl = await maybeUploadPhoto(matched.id, matched.photo_url);
      saveProfileId(matched.id);
      setShowReturnDialog(false);
      onComplete({
        name: trimmed || matched.name,
        emoji,
        photoUrl: finalPhotoUrl,
        userProfileId: matched.id,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  async function handleDenyReturn() {
    setShowReturnDialog(false);
    setMatched(null);
    setSubmitting(true);
    setError(null);
    try {
      await finalize(name.trim(), true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  async function finalize(trimmedName: string, forceNew: boolean) {
    let currentProfileId = forceNew ? null : profileId;

    if (currentProfileId) {
      // Update existing profile
      await updateProfile(currentProfileId, {
        name: trimmedName,
        emoji,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      });
    } else {
      // Create new profile
      const created = await createProfile({
        name: trimmedName,
        email: email || null,
        phone: phone || null,
        emoji,
        photo_url: null,
      });
      currentProfileId = created.id;
      setProfileId(created.id);
    }

    const finalPhotoUrl = await maybeUploadPhoto(currentProfileId, existingPhotoUrl);
    if (finalPhotoUrl && finalPhotoUrl !== existingPhotoUrl) {
      await updateProfile(currentProfileId, { photo_url: finalPhotoUrl });
    }

    saveProfileId(currentProfileId);
    onComplete({
      name: trimmedName,
      emoji,
      photoUrl: finalPhotoUrl,
      userProfileId: currentProfileId,
    });
  }

  async function maybeUploadPhoto(pid: string, fallback: string | null): Promise<string | null> {
    if (!photoFile) return fallback;
    return await uploadProfilePhoto(photoFile, pid);
  }

  // ── Display photo ──
  const displayPhoto = photoPreview ?? existingPhotoUrl;

  // ── Style helpers ──
  const isSnaphunt = variant === 'snaphunt';

  const labelClass = isSnaphunt
    ? 'block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-parchment/75'
    : 'block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-1';

  const inputClass = isSnaphunt
    ? 'mt-2 w-full rounded-[3px] border-[1.5px] border-gold/25 bg-forest-mid/50 px-4 py-3 font-mono text-lg tracking-wide text-ink placeholder:text-ink/40 focus:border-gold focus:bg-forest-mid/70 focus:outline-none'
    : 'mt-1 w-full rounded-[2px] border-2 border-rim bg-surface px-4 py-3 font-rb-mono text-[18px] tracking-widest text-ink placeholder:text-ash/50 focus:border-spark focus:outline-none';

  const sectionClass = 'flex flex-col gap-1';

  return (
    <div className="flex flex-col gap-5">

      {/* Profile photo circle */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={[
            'relative flex h-20 w-20 items-center justify-center rounded-full border-2 overflow-hidden transition-opacity',
            isSnaphunt ? 'border-gold/50 bg-forest-mid/60 text-4xl' : 'border-spark/50 bg-surface text-4xl',
          ].join(' ')}
          aria-label="Upload profile photo"
        >
          {displayPhoto ? (
            <img src={displayPhoto} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span>{emoji}</span>
          )}
          {/* Camera overlay */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-xl">📷</span>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
        <span className={isSnaphunt
          ? 'font-display text-[9px] uppercase tracking-[0.2em] text-parchment/50'
          : 'font-rb-mono text-[9px] uppercase tracking-[0.15em] text-ash/70'
        }>
          Tap to change photo
        </span>
      </div>

      {/* Name */}
      <div className={sectionClass}>
        <label className={labelClass}>
          {namePlaceholder ?? 'Your name'} <span className="opacity-60">(required)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder={namePlaceholder ?? 'Enter your name'}
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
        <div className={`text-right text-[10px] ${isSnaphunt ? 'font-mono text-parchment/50' : 'font-rb-mono text-ash/60'}`}>
          {name.trim().length}/24
        </div>
      </div>

      {/* Email */}
      <div className={sectionClass}>
        <label className={labelClass}>Email <span className="opacity-50">(optional)</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={inputClass}
        />
      </div>

      {/* Phone */}
      <div className={sectionClass}>
        <label className={labelClass}>Cell number <span className="opacity-50">(optional)</span></label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+27 82 000 0000"
          autoComplete="tel"
          className={inputClass}
        />
      </div>

      {/* Emoji grid (shown when no photo selected) */}
      {!displayPhoto && (
        <div className={sectionClass}>
          <span className={labelClass}>Or pick an icon</span>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {emojiOptions.map((e) => {
              const selected = e === emoji;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  aria-pressed={selected}
                  className={[
                    'flex aspect-square items-center justify-center rounded-[3px] border-[1.5px] text-2xl transition-transform',
                    isSnaphunt
                      ? selected ? 'border-gold bg-gold/20' : 'border-gold/25 bg-forest-mid/50 active:scale-95'
                      : selected ? 'border-spark bg-spark/15' : 'border-rim bg-surface active:scale-95',
                  ].join(' ')}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Returning player dialog */}
      {showReturnDialog && matched && (
        <div className={[
          'rounded-[3px] border p-4 flex flex-col gap-3',
          isSnaphunt
            ? 'border-gold/40 bg-gold/10'
            : 'border-spark/40 bg-spark/10',
        ].join(' ')}>
          <div className={isSnaphunt
            ? 'font-display text-[13px] font-bold text-parchment'
            : 'font-rb-mono text-[12px] text-smoke'
          }>
            👋 Welcome back!<br />
            <span className="opacity-75 font-normal text-[12px]">
              We found an account for &ldquo;<strong>{matched.name}</strong>&rdquo;. Is this you?
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmReturn}
              disabled={submitting}
              className={[
                'flex-1 rounded-[3px] py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-opacity disabled:opacity-50',
                isSnaphunt
                  ? 'bg-gold text-forest-dark font-display'
                  : 'bg-spark text-void font-rb-mono',
              ].join(' ')}
            >
              {submitting ? '…' : "Yes, that's me!"}
            </button>
            <button
              type="button"
              onClick={handleDenyReturn}
              disabled={submitting}
              className={[
                'flex-1 rounded-[3px] border py-2 text-[12px] font-bold uppercase tracking-[0.06em] transition-opacity disabled:opacity-50',
                isSnaphunt
                  ? 'border-gold/40 text-parchment/75 font-display'
                  : 'border-rim text-ash font-rb-mono',
              ].join(' ')}
            >
              No, new account
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={[
          'rounded-[3px] border px-3 py-2 text-sm font-bold',
          isSnaphunt
            ? 'border-ember/50 bg-ember/20 font-display text-parchment'
            : 'border-threat/50 bg-threat/10 font-rb-mono text-threat',
        ].join(' ')}>
          {error}
        </div>
      )}

      {/* Submit button */}
      {!showReturnDialog && (
        <button
          type="button"
          disabled={disabled || submitting || name.trim().length < 1}
          onClick={handleSubmit}
          className={[
            'w-full rounded-[3px] py-[15px] text-[14px] font-extrabold uppercase tracking-[0.06em] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
            isSnaphunt
              ? 'border-[1.5px] border-gold bg-gold font-display text-forest-dark hover:bg-gold-light'
              : 'bg-threat font-rb-mono text-white tracking-[0.1em]',
          ].join(' ')}
        >
          {submitting ? '…' : 'Continue →'}
        </button>
      )}
    </div>
  );
}
