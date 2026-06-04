// supabase/functions/verify-submission/index.ts
// Pillar 3 — Claude tool use for guaranteed structured output. Spec §10.2.
//
// Serves BOTH games via the `game` body param (default 'snaphunt', so the
// SnapHunt client's existing { submission_id } body is unchanged):
//   * snaphunt — submissions/rounds tables, seeker/hider columns, submission-
//     photos + round-photos buckets, finalize_round_winner on match.
//   * rushb    — rb_submissions/rb_rounds, defuser/planter columns, round-photos
//     for both photos, NO finalize (the defuse puzzle + rb_claim_round_defused
//     decide the round; the edge function only records the vision verdict).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// Cost guard: cap cloud verifications per user per hour so the Claude path
// (which costs money) can't be hammered by a single anon client.
const MAX_CLOUD_VERIFICATIONS_PER_HOUR = 40;

type GameConfig = {
  subTable: string;
  roundTable: string;
  roundLat: string;
  roundLng: string;
  subLat: string;
  subLng: string;
  subUser: string;
  roundBucket: string;
  subBucket: string;
  sessionTable: string;
  writeDecisionSource: boolean;
  finalize: ((roundId: string, userId: string) => Promise<boolean>) | null;
};

const GAMES: Record<string, GameConfig> = {
  snaphunt: {
    subTable: 'submissions',
    roundTable: 'rounds',
    roundLat: 'hider_lat',
    roundLng: 'hider_lng',
    subLat: 'seeker_lat',
    subLng: 'seeker_lng',
    subUser: 'seeker_id',
    roundBucket: 'round-photos',
    subBucket: 'submission-photos',
    sessionTable: 'sessions',
    writeDecisionSource: true,
    finalize: async (roundId, userId) => {
      const { data } = await supabase.rpc('finalize_round_winner', {
        p_round_id: roundId,
        p_seeker_id: userId,
      });
      return !!data;
    },
  },
  rushb: {
    subTable: 'rb_submissions',
    roundTable: 'rb_rounds',
    roundLat: 'planter_lat',
    roundLng: 'planter_lng',
    subLat: 'defuser_lat',
    subLng: 'defuser_lng',
    subUser: 'defuser_id',
    roundBucket: 'round-photos',
    subBucket: 'round-photos',
    sessionTable: 'rb_sessions',
    writeDecisionSource: false,
    finalize: null,
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Record the verification verdict for a submission.',
  input_schema: {
    type: 'object',
    properties: {
      similarity_score: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description:
          'Visual similarity 0-100. 90-100 = clearly same object; 75-89 = likely same; 50-74 = same type but probably different specimen; 0-49 = different.',
      },
      same_object: {
        type: 'boolean',
        description:
          'Whether both photos show the SAME PHYSICAL OBJECT (not just the same type).',
      },
      reasoning: {
        type: 'string',
        maxLength: 280,
        description:
          'One sentence, written in the voice of a witty narrator delivering a verdict.',
      },
    },
    required: ['similarity_score', 'same_object', 'reasoning'],
  },
} as const;

const SYSTEM_PROMPT = `You are the verification judge for a photo-based hide-and-seek game.
You compare two photos and decide if they show THE SAME PHYSICAL OBJECT — not just the same type.
Two red mugs in different rooms are NOT the same object. Two photos of the same statue from different angles ARE.
Always call the submit_verdict tool with your decision. Never reply in plain text.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const { submission_id, game = 'snaphunt' } = await req.json();
  if (!submission_id) return json({ error: 'submission_id required' }, 400);

  const cfg = GAMES[game as string];
  if (!cfg) return json({ error: `unknown game: ${game}` }, 400);

  // 1. Load submission + its round (aliased to `round` so both games read the same way)
  const { data: submission, error: subErr } = await supabase
    .from(cfg.subTable)
    .select(`*, round:${cfg.roundTable}(*)`)
    .eq('id', submission_id)
    .single();
  if (subErr || !submission) return json({ error: 'Submission not found' }, 404);

  const round = submission.round;
  if (!round?.photo_path || !submission.photo_path) return json({ error: 'Missing photo paths' }, 400);

  // 1.5 Cost guard — per-user hourly cap on cloud verifications
  const sinceIso = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from(cfg.subTable)
    .select('id', { count: 'exact', head: true })
    .eq(cfg.subUser, submission[cfg.subUser])
    .gte('created_at', sinceIso);
  if ((count ?? 0) > MAX_CLOUD_VERIFICATIONS_PER_HOUR) {
    await supabase.from(cfg.subTable).update({ status: 'error' }).eq('id', submission_id);
    return json({ error: 'Rate limit: too many verifications this hour' }, 429);
  }

  // 2. Haversine distance
  const distance = haversine(round[cfg.roundLat], round[cfg.roundLng], submission[cfg.subLat], submission[cfg.subLng]);

  // 3. Signed URLs (1h) for both photos
  const { data: roundUrl, error: rUrlErr } = await supabase.storage
    .from(cfg.roundBucket).createSignedUrl(round.photo_path, 3600);
  const { data: subUrl, error: sUrlErr } = await supabase.storage
    .from(cfg.subBucket).createSignedUrl(submission.photo_path, 3600);
  if (rUrlErr || sUrlErr || !roundUrl?.signedUrl || !subUrl?.signedUrl) {
    return json({ error: 'Could not sign photo URLs' }, 500);
  }

  // 4. Claude vision + forced tool use
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [VERDICT_TOOL],
    tool_choice: { type: 'tool', name: 'submit_verdict' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Photo A (target object):' },
          { type: 'image', source: { type: 'url', url: roundUrl.signedUrl } },
          { type: 'text', text: 'Photo B (submission):' },
          { type: 'image', source: { type: 'url', url: subUrl.signedUrl } },
          { type: 'text', text: 'Compare and submit your verdict.' },
        ],
      },
    ],
  });

  // 5. Extract verdict (schema guaranteed by tool_choice)
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    await supabase.from(cfg.subTable).update({ status: 'error' }).eq('id', submission_id);
    return json({ error: 'AI response malformed' }, 502);
  }
  const verdict = toolUse.input as { similarity_score: number; same_object: boolean; reasoning: string };

  // 6. Combine vision + location
  const settings = await getSessionSettings(cfg.sessionTable, round.session_id);
  const withinRange = distance <= settings.location_tolerance_meters;
  const isMatch = verdict.same_object && verdict.similarity_score >= settings.final_match_threshold && withinRange;

  // 7. Persist verdict
  const update: Record<string, unknown> = {
    cloud_similarity: verdict.similarity_score,
    cloud_reasoning: verdict.reasoning,
    distance_meters: distance,
    is_match: isMatch,
    status: 'verified',
    verified_at: new Date().toISOString(),
  };
  if (cfg.writeDecisionSource) update.decision_source = 'cloud';
  await supabase.from(cfg.subTable).update(update).eq('id', submission_id);

  // 8. On match: SnapHunt claims the round winner atomically; Rush B leaves the
  //    round open for the defuse puzzle to resolve.
  let roundWinner = false;
  if (isMatch && cfg.finalize) {
    roundWinner = await cfg.finalize(round.id, submission[cfg.subUser]);
  }

  return json({
    submission_id,
    similarity: verdict.similarity_score, // alias for clients that read `similarity`
    cloud_similarity: verdict.similarity_score,
    is_match: isMatch,
    distance_meters: distance,
    cloud_reasoning: verdict.reasoning,
    round_winner: roundWinner,
  });
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

async function getSessionSettings(sessionTable: string, sessionId: string) {
  const { data } = await supabase.from(sessionTable).select('settings').eq('id', sessionId).single();
  return data!.settings as { location_tolerance_meters: number; final_match_threshold: number };
}
