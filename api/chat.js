const fs   = require('fs');
const path = require('path');

/* ── Knowledge base (evaluated at cold-start) ── */
function loadKB() {
  const dir = path.join(process.cwd(), 'uploads');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => `=== ${f} ===\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`)
    .join('\n\n');
}

const SYSTEM_PROMPT = `당신은 소프티에(Softier) 브랜드의 친절한 상담 도우미 '소피'입니다.

아래 공식 문서를 바탕으로만 답변하세요.

--- 지식 베이스 ---
${loadKB()}
--- 끝 ---

[규칙]
1. 자기소개·대화형 질문: 소피라는 이름과 소프티에 도우미 역할을 자연스럽게 소개하세요.
2. 브랜드·제품·서비스 질문: 지식 베이스 내용만 사용하세요.
3. 문서에 없는 정보는 창작 금지 — "공식 채널을 통해 문의해 주세요"로 안내하세요.
4. 무관한 질문(날씨 등): "소프티에 서비스 관련 질문만 답변드릴 수 있어요 😊"
5. 항상 한국어, 친근하고 따뜻한 톤, 2~4문장으로 답변하세요.`;

/* ── Vercel serverless handler ── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel may deliver body as object (if parsed) or string
  let messages;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    ({ messages } = body);
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

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
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-10),
        ],
        max_completion_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!apiRes.ok) {
      const err = await apiRes.json();
      throw new Error(err.error?.message || 'OpenAI API 오류');
    }

    const data = await apiRes.json();
    const reply = data.choices[0].message.content;
    return res.status(200).json({ reply });
  } catch (e) {
    console.error('[chat error]', e.message);
    return res.status(500).json({ error: '서버 오류가 발생했어요.' });
  }
};
