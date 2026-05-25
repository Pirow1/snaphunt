// supabase/functions/verify-submission/index.ts
// Pillar 3 — Claude tool use for guaranteed structured output.
// Spec §10.2.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.32.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Record the verification verdict for a SnapHunt submission.',
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

const SYSTEM_PROMPT = `You are the verification judge for SnapHunt, a photo-based hide-and-seek game.
You compare two photos and decide if they show THE SAME PHYSICAL OBJECT — not just the same type.
Two red mugs in different rooms are NOT the same object. Two photos of the same statue from different angles ARE.
Always call the submit_verdict tool with your decision. Never reply in plain text.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS });
  }

  const { submission_id } = await req.json();
  if (!submission_id) {
    return new Response(JSON.stringify({ error: 'submission_id required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 1. Load submission + round
  const { data: submission, error: subErr } = await supabase
    .from('submissions')
    .select('*, rounds(*)')
    .eq('id', submission_id)
    .single();
  if (subErr || !submission) {
    return new Response(JSON.stringify({ error: 'Submission not found' }), {
      status: 404,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const round = submission.rounds;
  if (!round?.photo_path || !submission.photo_path) {
    return new Response(JSON.stringify({ error: 'Missing photo paths' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Haversine distance
  const distance = haversine(
    round.hider_lat,
    round.hider_lng,
    submission.seeker_lat,
    submission.seeker_lng,
  );

  // 3. Signed URLs (1h) for both photos
  const { data: hiderUrl, error: hUrlErr } = await supabase.storage
    .from('round-photos')
    .createSignedUrl(round.photo_path, 3600);
  const { data: seekerUrl, error: sUrlErr } = await supabase.storage
    .from('submission-photos')
    .createSignedUrl(submission.photo_path, 3600);
  if (hUrlErr || sUrlErr || !hiderUrl?.signedUrl || !seekerUrl?.signedUrl) {
    return new Response(JSON.stringify({ error: 'Could not sign photo URLs' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
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
          { type: 'image', source: { type: 'url', url: hiderUrl.signedUrl } },
          { type: 'text', text: 'Photo B (seeker submission):' },
          { type: 'image', source: { type: 'url', url: seekerUrl.signedUrl } },
          { type: 'text', text: 'Compare and submit your verdict.' },
        ],
      },
    ],
  });

  // 5. Extract verdict (schema guaranteed by tool_choice)
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    await supabase
      .from('submissions')
      .update({ status: 'error' })
      .eq('id', submission_id);
    return new Response(JSON.stringify({ error: 'AI response malformed' }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const verdict = toolUse.input as {
    similarity_score: number;
    same_object: boolean;
    reasoning: string;
  };

  // 6. Combine vision + location
  const settings = await getSessionSettings(round.session_id);
  const withinRange = distance <= settings.location_tolerance_meters;
  const isMatch =
    verdict.same_object &&
    verdict.similarity_score >= settings.final_match_threshold &&
    withinRange;

  // 7. Persist verdict
  await supabase
    .from('submissions')
    .update({
      cloud_similarity: verdict.similarity_score,
      cloud_reasoning: verdict.reasoning,
      distance_meters: distance,
      is_match: isMatch,
      decision_source: 'cloud',
      status: 'verified',
      verified_at: new Date().toISOString(),
    })
    .eq('id', submission_id);

  // 8. If match: atomic round-winner claim (only first match per round wins)
  let roundWinner = false;
  if (isMatch) {
    const { data: finalized } = await supabase.rpc('finalize_round_winner', {
      p_round_id: round.id,
      p_seeker_id: submission.seeker_id,
    });
    roundWinner = !!finalized;
  }

  return new Response(
    JSON.stringify({
      submission_id,
      cloud_similarity: verdict.similarity_score,
      is_match: isMatch,
      distance_meters: distance,
      cloud_reasoning: verdict.reasoning,
      round_winner: roundWinner,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

async function getSessionSettings(sessionId: string) {
  const { data } = await supabase
    .from('sessions')
    .select('settings')
    .eq('id', sessionId)
    .single();
  return data!.settings as {
    location_tolerance_meters: number;
    final_match_threshold: number;
  };
}
