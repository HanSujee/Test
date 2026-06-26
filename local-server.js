require('dotenv').config();
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

/* ── Knowledge base ── */
function loadKB() {
  const dir = path.join(__dirname, 'uploads');
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

/* ── Static MIME ── */
const MIME = {
  '.html':'.html', '.js':'application/javascript', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
  '.gif':'image/gif', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.md':'text/markdown; charset=utf-8',
};
function mime(ext) {
  return MIME[ext] || 'application/octet-stream';
}

/* ── /api/chat handler ── */
async function handleChat(req, res) {
  let raw = '';
  for await (const chunk of req) raw += chunk;

  let messages;
  try {
    ({ messages } = JSON.parse(raw));
    if (!Array.isArray(messages)) throw new Error();
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: '잘못된 요청입니다.' }));
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
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reply }));
  } catch (e) {
    console.error('[chat error]', e.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '서버 오류가 발생했어요.' }));
  }
}

/* ── Static file server ── */
function serveStatic(req, res) {
  const url  = req.url.split('?')[0];
  const rel  = url === '/' ? 'index.html' : url;
  const file = path.normalize(path.join(__dirname, rel));

  // directory traversal guard
  if (!file.startsWith(__dirname + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': mime(ext) });
    res.end(data);
  });
}

/* ── Server ── */
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/api/chat') return handleChat(req, res);

  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`✅  Softier chatbot → http://localhost:${PORT}`);
});
