(function () {
  /* ── Styles ── */
  const style = document.createElement('style');
  style.textContent = `
    #sf-btn {
      position:fixed;bottom:28px;right:28px;z-index:9999;
      width:56px;height:56px;border-radius:9999px;
      background:#8a5e44;color:#fff;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 24px rgba(138,94,68,.38);
      transition:transform .2s,background .2s;
    }
    #sf-btn:hover{background:#79503a;transform:scale(1.06)}
    #sf-btn:active{transform:scale(.94)}

    #sf-win {
      position:fixed;bottom:96px;right:28px;z-index:9998;
      width:360px;max-height:560px;
      background:#fff;border-radius:20px;
      box-shadow:0 14px 52px rgba(60,42,26,.18);
      display:flex;flex-direction:column;overflow:hidden;
      transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;
      transition:transform .26s cubic-bezier(.4,0,.2,1),opacity .26s;
      font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif;
    }
    #sf-win.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}

    #sf-head {
      background:#8a5e44;color:#fff;
      padding:15px 18px;
      display:flex;align-items:center;justify-content:space-between;flex-shrink:0;
    }
    .sf-hinfo{display:flex;align-items:center;gap:10px}
    .sf-avatar{
      width:36px;height:36px;border-radius:9999px;
      background:rgba(255,255,255,.22);
      display:flex;align-items:center;justify-content:center;font-size:17px;
    }
    .sf-hname{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .sf-hsub{font-size:11px;opacity:.78;margin-top:2px}
    #sf-close{
      background:none;border:none;color:#fff;cursor:pointer;
      opacity:.7;font-size:18px;line-height:1;padding:4px;
      transition:opacity .15s;
    }
    #sf-close:hover{opacity:1}

    #sf-msgs {
      flex:1;overflow-y:auto;padding:14px;
      display:flex;flex-direction:column;gap:9px;
      background:#faf8f5;
    }
    #sf-msgs::-webkit-scrollbar{width:4px}
    #sf-msgs::-webkit-scrollbar-thumb{background:#e0d6cc;border-radius:9999px}

    .sf-msg{
      max-width:84%;padding:10px 14px;border-radius:14px;
      font-size:13.5px;line-height:1.58;letter-spacing:-.01em;word-break:break-word;
      white-space:pre-wrap;
    }
    .sf-msg.bot{
      background:#fff;color:#26221e;
      border:1px solid #ece3d6;
      align-self:flex-start;border-bottom-left-radius:4px;
    }
    .sf-msg.user{
      background:#8a5e44;color:#fff;
      align-self:flex-end;border-bottom-right-radius:4px;
    }
    .sf-msg.err{
      background:#fff0ee;color:#b5301f;
      border:1px solid #f5c6c2;
      align-self:flex-start;border-bottom-left-radius:4px;
    }

    .sf-typing{
      display:flex;align-items:center;gap:4px;
      padding:11px 14px;
      background:#fff;border:1px solid #ece3d6;
      border-radius:14px;border-bottom-left-radius:4px;
      align-self:flex-start;
    }
    .sf-typing span{
      width:6px;height:6px;background:#c4b09a;border-radius:9999px;
      animation:sf-dot .9s ease-in-out infinite;
    }
    .sf-typing span:nth-child(2){animation-delay:.16s}
    .sf-typing span:nth-child(3){animation-delay:.32s}
    @keyframes sf-dot{
      0%,60%,100%{transform:translateY(0);opacity:.45}
      30%{transform:translateY(-5px);opacity:1}
    }

    #sf-form{
      display:flex;gap:8px;padding:11px 14px;
      border-top:1px solid #ece3d6;background:#fff;flex-shrink:0;
    }
    #sf-input{
      flex:1;border:1px solid #e0d6cc;border-radius:9999px;
      padding:8px 15px;font-size:13.5px;font-family:inherit;
      color:#26221e;background:#faf8f5;outline:none;
      transition:border-color .15s;
    }
    #sf-input:focus{border-color:#8a5e44}
    #sf-input::placeholder{color:#b6a68f}
    #sf-send{
      width:34px;height:34px;border-radius:9999px;
      background:#8a5e44;color:#fff;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      transition:background .15s,transform .1s;
    }
    #sf-send:hover{background:#79503a}
    #sf-send:active{transform:scale(.88)}
    #sf-send:disabled{background:#d4c4b5;cursor:default}

    @media(max-width:480px){
      #sf-win{width:calc(100vw - 40px);right:20px;bottom:84px}
      #sf-btn{right:20px;bottom:18px}
    }
  `;
  document.head.appendChild(style);

  /* ── DOM ── */
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <button id="sf-btn" aria-label="채팅 상담 열기">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M20 2H4C2.9 2 2 2.9 2 4v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2Z" fill="currentColor"/>
      </svg>
    </button>
    <div id="sf-win" role="dialog" aria-label="소프티에 채팅 상담">
      <div id="sf-head">
        <div class="sf-hinfo">
          <div class="sf-avatar">🌿</div>
          <div>
            <div class="sf-hname">소피 · 소프티에 도우미</div>
            <div class="sf-hsub">무엇이든 물어보세요</div>
          </div>
        </div>
        <button id="sf-close" aria-label="닫기">✕</button>
      </div>
      <div id="sf-msgs"></div>
      <form id="sf-form">
        <input id="sf-input" type="text" placeholder="메시지를 입력하세요…" autocomplete="off" maxlength="500">
        <button id="sf-send" type="submit" aria-label="전송">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M2 21 23 12 2 3v7l17 2-17 2v7Z" fill="currentColor"/>
          </svg>
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(wrap);

  const btn    = document.getElementById('sf-btn');
  const win    = document.getElementById('sf-win');
  const close  = document.getElementById('sf-close');
  const msgs   = document.getElementById('sf-msgs');
  const form   = document.getElementById('sf-form');
  const input  = document.getElementById('sf-input');
  const send   = document.getElementById('sf-send');

  let open = false;
  let busy = false;
  let history = []; // {role, content}[]

  function toggle() {
    open = !open;
    win.classList.toggle('open', open);
    if (open) input.focus();
  }

  btn.addEventListener('click', toggle);
  close.addEventListener('click', toggle);

  function addMsg(text, type) {
    const d = document.createElement('div');
    d.className = `sf-msg ${type}`;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const d = document.createElement('div');
    d.className = 'sf-typing';
    d.id = 'sf-typing';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('sf-typing')?.remove();
  }

  async function chat(text) {
    if (!text.trim() || busy) return;
    busy = true;
    send.disabled = true;

    addMsg(text, 'user');
    history.push({ role: 'user', content: text });
    if (history.length > 10) history = history.slice(-10);

    showTyping();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      hideTyping();

      if (!res.ok) throw new Error('서버 오류가 발생했어요.');

      const { reply } = await res.json();
      const answer = reply || '응답을 받지 못했어요.';
      addMsg(answer, 'bot');
      history.push({ role: 'assistant', content: answer });
      if (history.length > 10) history = history.slice(-10);
    } catch (e) {
      hideTyping();
      addMsg(e.message || '오류가 발생했어요. 잠시 후 다시 시도해주세요.', 'err');
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chat(text);
  });

  /* 1초 후 환영 메시지 */
  setTimeout(() => {
    if (!open) toggle();
    addMsg('안녕하세요! 저는 소프티에 도우미 소피예요 🌿\n소프티에 브랜드나 제품에 대해 궁금한 점이 있으시면 편하게 물어보세요!', 'bot');
  }, 1000);
})();
