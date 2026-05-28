import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { TopBar } from '../components/ui/TopBar';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';
import { PlayerIdentityForm } from '../../components/player/PlayerIdentityForm';

const EMOJI_PICKS = ['💣', '🔫', '🪖', '🎖️', '⚡', '🔥'] as const;

export default function JoinScreen() {
  const { code: codeParam } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const authUserId = useStore((s) => s.identity.authUserId);
  const joinSession = useStore((s) => s.joinSession);
  const setUserProfile = useStore((s) => s.setUserProfile);

  const [code, setCode] = useState(codeParam ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normCode = normalizeJoinCode(code);

  async function handleIdentity(identity: {
    name: string;
    emoji: string;
    photoUrl: string | null;
    userProfileId: string;
  }) {
    if (!authUserId || !isValidJoinCode(normCode)) return;
    setSubmitting(true);
    setError(null);
    try {
      setUserProfile(identity.userProfileId, identity.photoUrl);
      const { sessionId, status } = await joinSession({
        code: normCode,
        name: identity.name,
        emoji: identity.emoji,
        userProfileId: identity.userProfileId,
      });
      navigate(status === 'playing' ? `/game/${sessionId}` : `/lobby/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join operation.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <TopBar title="Join Operation" back="/" right={
        <span className="rounded-[2px] border border-threat/40 bg-threat/10 px-2.5 py-1 font-rb-mono text-[10px] uppercase tracking-[0.15em] text-threat">Defuser</span>
      } />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-6">
        {/* Code input */}
        <section>
          <label className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Operation Code
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="6-CHAR CODE"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[2px] border-2 border-rim bg-surface px-4 py-3 font-rb-mono text-[24px] tracking-[0.4em] text-spark placeholder:text-ash/40 focus:border-spark focus:outline-none text-center"
          />
        </section>

        {/* Identity form (only show when code is valid) */}
        {isValidJoinCode(normCode) && (
          <PlayerIdentityForm
            variant="rushb"
            namePlaceholder="Operative Name"
            emojiOptions={EMOJI_PICKS}
            onComplete={handleIdentity}
            disabled={submitting || !authUserId}
          />
        )}

        {error && (
          <div className="rounded-[2px] border border-threat/50 bg-threat/10 px-3 py-2 font-rb-mono text-[12px] text-threat">
            {error}
          </div>
        )}

        {!authUserId && (
          <p className="mt-2 text-center font-rb-mono text-[9px] uppercase tracking-[0.15em] text-ash">
            Connecting to command…
          </p>
        )}
      </div>
    </main>
  );
}
