import { useState } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { ForestBg } from '../components/ui/ForestBg';
import { PlayerIdentityForm } from '../components/player/PlayerIdentityForm';

const EMOJI_PICKS = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉'] as const;

export default function CreateLobbyScreen() {
  const go = useViewTransition();
  const authUserId = useStore((s) => s.identity.authUserId);
  const createSession = useStore((s) => s.createSession);
  const setUserProfile = useStore((s) => s.setUserProfile);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleIdentity(identity: {
    name: string;
    emoji: string;
    photoUrl: string | null;
    userProfileId: string;
  }) {
    if (!authUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      setUserProfile(identity.userProfileId, identity.photoUrl);
      const { sessionId } = await createSession({
        name: identity.name,
        emoji: identity.emoji,
        userProfileId: identity.userProfileId,
      });
      go(`/lobby/${sessionId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create the hunt.';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment">
      <ForestBg />
      <div className="flex items-center justify-between border-b border-gold/[0.18] bg-[rgba(10,18,8,0.6)] px-[22px] py-[18px] pb-3 backdrop-blur-md">
        <button
          type="button"
          aria-label="Back"
          onClick={() => go('/snaphunt')}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-gold/35 bg-forest-mid/60 font-display text-xl font-extrabold text-gold active:bg-gold active:text-forest-dark"
        >
          ←
        </button>
        <div className="font-display text-[14px] font-extrabold uppercase tracking-[0.12em] text-parchment">
          New Hunt
        </div>
        <div className="rounded-[2px] border border-gold/35 bg-gold/15 px-2.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.15em] text-gold">
          Host
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-[22px] py-7">
        <PlayerIdentityForm
          variant="snaphunt"
          namePlaceholder="Hunter name"
          emojiOptions={EMOJI_PICKS}
          onComplete={handleIdentity}
          disabled={submitting || !authUserId}
        />

        {error && (
          <div className="mt-4 rounded-[3px] border border-ember/50 bg-ember/20 px-3 py-2 font-display text-sm font-bold text-parchment">
            {error}
          </div>
        )}

        {!authUserId && (
          <p className="mt-3 text-center font-mono text-[10px] text-parchment/65">
            Waiting for anonymous sign-in…
          </p>
        )}
      </div>
    </main>
  );
}
