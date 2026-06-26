const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const { name, email, message } = body ?? {};
  if (!name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: '이름과 이메일은 필수입니다.' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase
      .from('leads')
      .insert({ name: name.trim(), email: email.trim(), message: message?.trim() ?? null });

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[lead error]', e.message);
    return res.status(500).json({ error: '저장 중 오류가 발생했어요.' });
  }
};
