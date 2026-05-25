import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { CodeInput } from '../components/game/CodeInput';

const EMOJI_PICKS = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉'] as const;

export default function JoinScreen() {
  const go = useViewTransition();
  const params = useParams<{ code?: string }>();
  const authUserId = useStore((s) => s.identity.authUserId);
  const joinSession = useStore((s) => s.joinSession);

  // Deep-linked code prefill: /join/ABC123 → start with that value.
  const [code, setCode] = useState(() => (params.code ? normalizeJoinCode(params.code).slice(0, 6) : ''));
  const [step, setStep] = useState<'code' | 'identity'>(params.code && isValidJoinCode(normalizeJoinCode(params.code)) ? 'identity' : 'code');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(EMOJI_PICKS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once the user types 6 valid chars, move to the identity step.
  useEffect(() => {
    if (step === 'code' && code.length === 6 && isValidJoinCode(code)) {
      setStep('identity');
    }
  }, [code, step]);

  const trimmedName = name.trim();
  const canSubmit =
    step === 'identity' &&
    isValidJoinCode(code) &&
    trimmedName.length >= 1 &&
    trimmedName.length <= 24 &&
    !!authUserId &&
    !submitting;

  async function handleJoin() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { sessionId } = await joinSession({ code, name: trimmedName, emoji });
      go(`/lobby/${sessionId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not join the hunt.';
      setError(msg);
      setSubmitting(false);
      // Drop back to code step so they can fix it.
      if (msg.toLowerCase().includes('code')) setStep('code');
    }
  }

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <TopBar title="Join a Hunt" back="/" right={<TopBarBadge>Guest</TopBarBadge>} />

      <div className="flex flex-1 flex-col px-[22px] pt-6 pb-4">
        {step === 'code' ? (
          <>
            <div className="text-center font-display text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
              Enter 6-character code
            </div>
            <CodeInput value={code} onChange={setCode} />
            {error && (
              <p className="mb-2 text-center font-display text-xs font-bold uppercase tracking-[0.15em] text-blaze">
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="text-center">
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-ink-soft">
                Joining
              </span>
              <div className="mt-1 font-mono text-3xl font-bold tracking-[0.15em]">{code}</div>
              <button
                type="button"
                onClick={() => {
                  setStep('code');
                  setCode('');
                }}
                className="mt-1 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft underline underline-offset-[3px]"
              >
                change
              </button>
            </div>

            <section className="mt-6">
              <label htmlFor="join-name" className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-ink-soft">
                Your hunter name
              </label>
              <input
                id="join-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 24))}
                placeholder="e.g. Robin"
                maxLength={24}
                autoComplete="off"
                spellCheck={false}
                autoFocus
                className="mt-3 w-full border-2 border-ink bg-cream px-4 py-3 font-mono text-2xl tracking-widest placeholder:text-ink/30 focus:bg-cream-2 focus:outline-none"
              />
              <div className="mt-1 text-right font-mono text-[10px] text-ink-soft">{trimmedName.length}/24</div>
            </section>

            <section className="mt-4">
              <span className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-ink-soft">
                Pick a sigil
              </span>
              <div className="mt-3 grid grid-cols-6 gap-2">
                {EMOJI_PICKS.map((e) => {
                  const selected = e === emoji;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      aria-pressed={selected}
                      className={[
                        'flex aspect-square items-center justify-center border-2 border-ink text-3xl transition-transform',
                        selected ? 'bg-gold shadow-brutal' : 'bg-cream-2 active:translate-x-[2px] active:translate-y-[2px]',
                      ].join(' ')}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </section>

            {error && (
              <div className="mt-4 border-2 border-ink bg-blaze px-3 py-2 font-display text-sm font-bold text-cream">
                {error}
              </div>
            )}

            <div className="mt-auto pt-4">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleJoin}
                className="flex w-full items-center justify-center gap-2.5 rounded-[2px] border-2 border-ink bg-blaze px-[22px] py-[18px] font-display text-[17px] font-bold uppercase tracking-tight text-cream shadow-brutal transition-[transform,box-shadow] duration-[80ms] hover:bg-blaze-deep active:translate-x-[3px] active:translate-y-[3px] active:shadow-[1px_1px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? '…Joining…' : '▶ Join the Hunt'}
              </button>
              {!authUserId && (
                <p className="mt-3 text-center font-mono text-[10px] text-ink-soft">Waiting for anonymous sign-in…</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
