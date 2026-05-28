import { useState } from 'react';
import { useViewTransition } from '../hooks/useViewTransition';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { TopBar } from '../components/ui/TopBar';

const EMOJI_PICKS = ['💣', '🔫', '🪖', '🎖️', '⚡', '🔥'] as const;

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

      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-6">
        <section>
          <label htmlFor="op-name" className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Operative Name
          </label>
          <input
            id="op-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="e.g. Ghost"
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-[2px] border-2 border-rim bg-surface px-4 py-3 font-rb-mono text-[20px] tracking-widest text-ink placeholder:text-ash/50 focus:border-spark focus:outline-none"
          />
          <div className="mt-1 text-right font-rb-mono text-[9px] text-ash">{trimmed.length}/24</div>
        </section>

        <section>
          <span className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Select Insignia
          </span>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_PICKS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={e === emoji}
                className={[
                  'flex aspect-square items-center justify-center rounded-[2px] border-2 text-3xl transition-all',
                  e === emoji ? 'border-spark bg-spark/15 scale-100' : 'border-rim bg-surface active:scale-95',
                ].join(' ')}
              >
                {e}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="rounded-[2px] border border-threat/50 bg-threat/10 px-3 py-2 font-rb-mono text-[12px] text-threat">
            {error}
          </div>
        )}

        <div className="mt-auto">
          <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            {submitting ? 'INITIALISING…' : '▶ CREATE OPERATION'}
          </Button>
          {!authUserId && (
            <p className="mt-2 text-center font-rb-mono text-[9px] uppercase tracking-[0.15em] text-ash">
              Connecting to command…
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
