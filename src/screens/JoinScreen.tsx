import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';
import { TopBar, TopBarBadge } from '../components/ui/TopBar';
import { CodeInput } from '../components/game/CodeInput';
import { ForestBg } from '../components/ui/ForestBg';

const EMOJI_PICKS = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉'] as const;

export default function JoinScreen() {
  const go = useViewTransition();
  const params = useParams<{ code?: string }>();
  const authUserId = useStore((s) => s.identity.authUserId);
  const joinSession = useStore((s) => s.joinSession);

  const [code, setCode] = useState(() => (params.code ? normalizeJoinCode(params.code).slice(0, 6) : ''));
  const [step, setStep] = useState<'code' | 'identity'>(params.code && isValidJoinCode(normalizeJoinCode(params.code)) ? 'identity' : 'code');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(EMOJI_PICKS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      if (msg.toLowerCase().includes('code')) setStep('code');
    }
  }

  return (
    <main className="relative isolate flex h-full w-full flex-col bg-forest-dark text-parchment">
      <ForestBg />
      <TopBar title="Join a Hunt" back="/" right={<TopBarBadge>Guest</TopBarBadge>} />

      <div className="flex flex-1 flex-col px-[22px] pt-6 pb-4">
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
            <div className="text-center">
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

            <section className="mt-6">
              <label htmlFor="join-name" className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-parchment/75">
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
                className="mt-3 w-full rounded-[3px] border-[1.5px] border-gold/25 bg-forest-mid/50 px-4 py-3 font-mono text-2xl tracking-widest text-parchment placeholder:text-parchment/48 focus:border-gold focus:bg-forest-mid/70 focus:outline-none"
              />
              <div className="mt-1 text-right font-mono text-[10px] text-parchment/65">{trimmedName.length}/24</div>
            </section>

            <section className="mt-4">
              <span className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-parchment/75">
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
                        'flex aspect-square items-center justify-center rounded-[3px] border-[1.5px] text-3xl transition-transform',
                        selected ? 'border-gold bg-gold/20' : 'border-gold/25 bg-forest-mid/50 active:scale-95',
                      ].join(' ')}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </section>

            {error && (
              <div className="mt-4 rounded-[3px] border border-ember/50 bg-ember/20 px-3 py-2 font-display text-sm font-bold text-parchment">
                {error}
              </div>
            )}

            <div className="mt-auto pt-4">
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleJoin}
                className="flex w-full items-center justify-center gap-2.5 rounded-[3px] border-[1.5px] border-gold bg-gold px-[22px] py-[17px] font-display text-[15px] font-extrabold uppercase tracking-[0.06em] text-forest-dark backdrop-blur-sm transition-transform duration-[80ms] active:scale-[0.98] hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? '…Joining…' : '▶ Join the Hunt'}
              </button>
              {!authUserId && (
                <p className="mt-3 text-center font-mono text-[10px] text-parchment/65">Waiting for anonymous sign-in…</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
