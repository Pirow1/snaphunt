import { useState } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';

const EMOJI_PICKS = ['🦊', '🦌', '🦅', '🐝', '🐢', '🦉'] as const;

export default function CreateLobbyScreen() {
  const go = useViewTransition();
  const authUserId = useStore((s) => s.identity.authUserId);
  const createSession = useStore((s) => s.createSession);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(EMOJI_PICKS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length >= 1 && trimmed.length <= 24 && !!authUserId && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { sessionId } = await createSession({ name: trimmed, emoji });
      go(`/lobby/${sessionId}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create the hunt.';
      setError(msg);
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full w-full flex-col bg-cream text-ink">
      <div className="flex items-center justify-between border-b-2 border-dashed border-ink px-[22px] py-[18px] pb-3">
        <button
          type="button"
          aria-label="Back"
          onClick={() => go('/')}
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-ink bg-cream font-display text-xl font-extrabold active:bg-ink active:text-cream"
        >
          ←
        </button>
        <div className="font-display text-[15px] font-extrabold uppercase tracking-[0.1em]">
          New Hunt
        </div>
        <div className="bg-ink px-2.5 py-1.5 font-display text-[11px] font-bold uppercase tracking-[0.15em] text-cream">
          Host
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-8 px-[22px] py-7">
        <section>
          <label htmlFor="hunter-name" className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-ink-soft">
            Your hunter name
          </label>
          <input
            id="hunter-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="e.g. Sam"
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            className="mt-3 w-full border-2 border-ink bg-cream px-4 py-3 font-mono text-2xl tracking-widest placeholder:text-ink/30 focus:bg-cream-2 focus:outline-none"
          />
          <div className="mt-1 text-right font-mono text-[10px] text-ink-soft">
            {trimmed.length}/24
          </div>
        </section>

        <section>
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
                    selected
                      ? 'bg-gold shadow-brutal translate-x-0 translate-y-0'
                      : 'bg-cream-2 active:translate-x-[2px] active:translate-y-[2px]',
                  ].join(' ')}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="border-2 border-ink bg-blaze px-3 py-2 font-display text-sm font-bold text-cream">
            {error}
          </div>
        )}

        <div className="mt-auto">
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {submitting ? '…Conjuring…' : '▶ Set the Trap'}
          </Button>
          {!authUserId && (
            <p className="mt-3 text-center font-mono text-[10px] text-ink-soft">
              Waiting for anonymous sign-in…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
