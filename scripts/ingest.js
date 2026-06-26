require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const CHUNK_SIZE    = 600; // chars
const CHUNK_OVERLAP = 120;

/* ── 마크다운을 섹션 단위로 청크 ── */
function chunkMd(text, source) {
  // 헤더(##, ###) 또는 빈 줄 2개 기준으로 분리
  const paragraphs = text.split(/\n(?=#{1,3} )|\n{2,}/);
  const chunks = [];
  let buffer = '';
  let index = 0;

  for (const para of paragraphs) {
    if ((buffer + '\n' + para).length > CHUNK_SIZE && buffer.trim().length > 50) {
      chunks.push({ source, chunk_index: index++, content: buffer.trim() });
      // 오버랩: 이전 청크 끝부분 일부 유지
      buffer = buffer.slice(-CHUNK_OVERLAP) + '\n' + para;
    } else {
      buffer = buffer ? buffer + '\n' + para : para;
    }
  }
  if (buffer.trim().length > 50) {
    chunks.push({ source, chunk_index: index, content: buffer.trim() });
  }
  return chunks;
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
  if (!data.data?.[0]?.embedding) throw new Error(JSON.stringify(data));
  return data.data[0].embedding;
}

/* ── 메인 ── */
async function ingest() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 .env에 없습니다.');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.md'));

  if (!files.length) {
    console.log('uploads/*.md 파일이 없습니다.');
    return;
  }

  for (const file of files) {
    const content = fs.readFileSync(path.join(uploadsDir, file), 'utf-8');
    const chunks  = chunkMd(content, file);

    console.log(`\n[${file}] ${chunks.length}개 청크 처리 중...`);

    // 기존 데이터 삭제
    await supabase.from('documents').delete().eq('source', file);

    for (const chunk of chunks) {
      const embedding = await embed(chunk.content);
      const { error } = await supabase.from('documents').insert({
        source:      chunk.source,
        chunk_index: chunk.chunk_index,
        content:     chunk.content,
        embedding,
      });
      if (error) console.error('  insert error:', error.message);
      else process.stdout.write('·');
    }
  }

  console.log('\n\n✅ 임베딩 적재 완료!');
}

ingest().catch(e => { console.error(e.message); process.exit(1); });
