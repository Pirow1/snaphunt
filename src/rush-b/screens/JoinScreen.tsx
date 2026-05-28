import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../lib/store';
import { Button } from '../components/ui/Button';
import { TopBar } from '../components/ui/TopBar';
import { isValidJoinCode, normalizeJoinCode } from '../lib/codes';

const EMOJI_PICKS = ['💣', '🔫', '🪖', '🎖️', '⚡', '🔥'] as const;

export default function JoinScreen() {
  const { code: codeParam } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const authUserId = useStore((s) => s.identity.authUserId);
  const joinSession = useStore((s) => s.joinSession);

  const [code, setCode] = useState(codeParam ?? '');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(EMOJI_PICKS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const normCode = normalizeJoinCode(code);
  const canSubmit = isValidJoinCode(normCode) && trimmedName.length >= 1 && !!authUserId && !submitting;

  async function handleJoin() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const { sessionId, status } = await joinSession({ code: normCode, name: trimmedName, emoji });
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

      <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-6">
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

        <section>
          <label className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">
            Operative Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 24))}
            placeholder="e.g. Falcon"
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full rounded-[2px] border-2 border-rim bg-surface px-4 py-3 font-rb-mono text-[20px] tracking-widest text-ink placeholder:text-ash/50 focus:border-spark focus:outline-none"
          />
        </section>

        <section>
          <span className="block font-rb-mono text-[10px] uppercase tracking-[0.25em] text-ash mb-2">Insignia</span>
          <div className="grid grid-cols-6 gap-2">
            {EMOJI_PICKS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={e === emoji}
                className={[
                  'flex aspect-square items-center justify-center rounded-[2px] border-2 text-3xl',
                  e === emoji ? 'border-spark bg-spark/15' : 'border-rim bg-surface active:scale-95',
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
          <Button variant="danger" disabled={!canSubmit} onClick={handleJoin}>
            {submitting ? 'JOINING…' : '⬡ JOIN OPERATION'}
          </Button>
        </div>
      </div>
    </main>
  );
}
