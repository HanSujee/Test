const fs   = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

/* ── 폴백: 전체 MD 파일 주입 ── */
function loadKB() {
  const dir = path.join(process.cwd(), 'uploads');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => `=== ${f} ===\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`)
    .join('\n\n');
}
const FALLBACK_KB = loadKB();

/* ── 시스템 프롬프트 ── */
function buildPrompt(context) {
  return `당신은 소프티에(Softier) 브랜드의 친절한 상담 도우미 '소피'입니다.

아래 참고 자료를 바탕으로만 답변하세요.

--- 참고 자료 ---
${context}
--- 끝 ---

[규칙]
1. 자기소개·대화형 질문: 소피라는 이름과 소프티에 도우미 역할을 자연스럽게 소개하세요.
2. 브랜드·제품·서비스 질문: 참고 자료 내용만 사용하세요.
3. 문서에 없는 정보는 창작 금지 — "공식 채널을 통해 문의해 주세요"로 안내하세요.
4. 무관한 질문(날씨 등): "소프티에 서비스 관련 질문만 답변드릴 수 있어요 😊"
5. 항상 한국어, 친근하고 따뜻한 톤, 2~4문장으로 답변하세요.`;
}

/* ── 임베딩 ── */
async function embed(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

/* ── RAG 검색 (실패 시 null 반환 → 폴백) ── */
async function retrieveContext(question) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  try {
    const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const embedding = await embed(question);

    const { data, error } = await supabase.rpc('match_documents', {
      query_embedding: embedding,
      match_count: 5,
    });

    if (error || !data?.length) return null;

    return data.map(d => `[${d.source}]\n${d.content}`).join('\n\n');
  } catch {
    return null;
  }
}

/* ── 대화 로그 (best-effort) ── */
async function logChat(question, answer, sources) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('chat_logs').insert({ question, answer, sources });
  } catch {}
}

/* ── Vercel / 로컬 공용 핸들러 ── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let messages;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    ({ messages } = body);
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const trimmed     = messages.slice(-10);
  const lastUserMsg = [...trimmed].reverse().find(m => m.role === 'user')?.content ?? '';

  // RAG → 폴백
  const ragContext = await retrieveContext(lastUserMsg);
  const context    = ragContext ?? FALLBACK_KB;

  try {
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [
          { role: 'system', content: buildPrompt(context) },
          ...trimmed,
        ],
        max_completion_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.json();
      throw new Error(err.error?.message || 'API 오류');
    }

    const data    = await apiRes.json();
    const reply   = data.choices[0].message.content;
    const sources = ragContext
      ? [...new Set(ragContext.match(/\[([^\]]+)\]/g)?.map(s => s.slice(1, -1)) ?? [])]
      : [];

    logChat(lastUserMsg, reply, sources); // best-effort, await 생략

    return res.status(200).json({ reply, rag: !!ragContext });
  } catch (e) {
    console.error('[chat error]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했어요.' });
  }
};
