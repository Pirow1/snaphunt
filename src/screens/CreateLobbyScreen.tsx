import { useState } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { ForestBg } from '../components/ui/ForestBg';

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

      <div className="flex flex-1 flex-col gap-8 px-[22px] py-7">
        <section>
          <label htmlFor="hunter-name" className="block font-display text-[11px] font-bold uppercase tracking-[0.25em] text-parchment/75">
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
            className="mt-3 w-full rounded-[3px] border-[1.5px] border-gold/25 bg-forest-mid/50 px-4 py-3 font-mono text-2xl tracking-widest text-ink placeholder:text-ink/40 focus:border-gold focus:bg-forest-mid/70 focus:outline-none"
          />
          <div className="mt-1 text-right font-mono text-[10px] text-parchment/65">{trimmed.length}/24</div>
        </section>

        <section>
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
                    selected
                      ? 'border-gold bg-gold/20 scale-100'
                      : 'border-gold/25 bg-forest-mid/50 active:scale-95',
                  ].join(' ')}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="rounded-[3px] border border-ember/50 bg-ember/20 px-3 py-2 font-display text-sm font-bold text-parchment">
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
            <p className="mt-3 text-center font-mono text-[10px] text-parchment/65">
              Waiting for anonymous sign-in…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
