import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { CodeInput } from '../components/game/CodeInput';
import { ForestBg } from '../components/ui/ForestBg';
import { PlayerIdentityForm } from '../components/player/PlayerIdentityForm';

const EMOJI_PICKS = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉'] as const;

export default function JoinScreen() {
  const go = useViewTransition();
  const params = useParams<{ code?: string }>();
  const authUserId = useStore((s) => s.identity.authUserId);
  const joinSession = useStore((s) => s.joinSession);
  const setUserProfile = useStore((s) => s.setUserProfile);

  const [code, setCode] = useState(() => (params.code ? normalizeJoinCode(params.code).slice(0, 6) : ''));
  const [step, setStep] = useState<'code' | 'identity'>(params.code && isValidJoinCode(normalizeJoinCode(params.code)) ? 'identity' : 'code');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'code' && code.length === 6 && isValidJoinCode(code)) {
      setStep('identity');
    }
  }, [code, step]);

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
      const { sessionId } = await joinSession({
        code,
        name: identity.name,
        emoji: identity.emoji,
        userProfileId: identity.userProfileId,
      });
      go(`/lobby/${sessionId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not join the hunt.';
      setError(msg);
      setSubmitting(false);
      if (msg.toLowerCase().includes('code')) setStep('code');
    }
  }

  return (
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment">
      <ForestBg />
      <TopBar title="Join a Hunt" back="/" right={<TopBarBadge>Guest</TopBarBadge>} />

      <div className="flex flex-1 flex-col px-[22px] pt-6 pb-4 overflow-y-auto">
        {step === 'code' ? (
          <>
            <div className="text-center font-display text-[11px] font-bold uppercase tracking-[0.18em] text-parchment/75">
              Enter 6-character code
            </div>
            <CodeInput value={code} onChange={setCode} />
            {error && (
              <p className="mb-2 text-center font-display text-xs font-bold uppercase tracking-[0.15em] text-ember">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-parchment/75">
                Joining
              </span>
              <div className="mt-1 font-mono text-3xl font-bold tracking-[0.15em] text-gold">{code}</div>
              <button
                type="button"
                onClick={() => {
                  setStep('code');
                  setCode('');
                }}
                className="mt-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-parchment/70 underline underline-offset-[3px]"
              >
                change
              </button>
            </div>

            <PlayerIdentityForm
              variant="snaphunt"
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
              <p className="mt-3 text-center font-mono text-[10px] text-parchment/65">Waiting for anonymous sign-in…</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
