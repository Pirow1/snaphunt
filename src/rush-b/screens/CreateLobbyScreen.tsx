import { useState } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { TopBar } from '../components/ui/TopBar';
import { PlayerIdentityForm } from '../../components/player/PlayerIdentityForm';

const EMOJI_PICKS = ['💣', '🔫', '🪖', '🎖️', '⚡', '🔥'] as const;

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create operation.');
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full w-full flex-col bg-void text-smoke">
      <TopBar title="New Operation" back="/" right={
        <span className="rounded-[2px] border border-spark/40 bg-spark/10 px-2.5 py-1 font-rb-mono text-[10px] uppercase tracking-[0.15em] text-spark">Host</span>
      } />

      <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6">
        <PlayerIdentityForm
          variant="rushb"
          namePlaceholder="Operative Name"
          emojiOptions={EMOJI_PICKS}
          onComplete={handleIdentity}
          disabled={submitting || !authUserId}
        />

        {error && (
          <div className="mt-4 rounded-[2px] border border-threat/50 bg-threat/10 px-3 py-2 font-rb-mono text-[12px] text-threat">
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
