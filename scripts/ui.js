(function(){
  'use strict';
  window.App = window.App || {};

  const Storage = window.AppHelpers;

  const KEYS = {
    messages: 'messages',
    model: 'model',
  };

  const initialState = {
    messages: Storage.load(KEYS.messages, []),
    generating: false,
    modelReady: false,
    progress: 0,
    error: '',
    streamingAssistantId: null,
    autoScroll: true,
  };

  let $messages, $input, $send, $stop, $progress, $progressLabel, $statusText;

  function renderMessages(){
    const items = (App.state.messages || []).map(m => {
      const isUser = m.role === 'user';
      const rowClass = isUser ? 'user' : 'assistant';
      const bubbleClass = isUser ? 'bubble-user' : 'bubble-assistant';
      const avatarText = isUser ? 'U' : 'A';
      const thinkBlock = (!isUser && m.think) ? `
        <div class="mb-2">
          <details>
            <summary class="cursor-pointer select-none text-xs text-[#64748B] hover:text-[#0F172A] flex items-center gap-2">
              <span class="inline-flex items-center rounded-md bg-[#EEF2FF] px-2 py-1 ring-1 ring-black/5">Reasoning</span>
              <span class="opacity-60">(click to toggle)</span>
            </summary>
            <div class="mt-2 rounded-md bg-[#F8FAFF] ring-1 ring-black/5 p-3 whitespace-pre-wrap text-[#334155] text-sm">${escapeHtml(m.think)}</div>
          </details>
        </div>
      ` : '';
      return `
        <div class="message-row ${rowClass}">
          ${isUser ? '' : `<div class=\"avatar\" aria-hidden=\"true\">${avatarText}</div>`}
          <div class="bubble ${bubbleClass}" data-id="${m.id}">
            ${thinkBlock}
            <p>${escapeHtml(m.content)}</p>
          </div>
          ${isUser ? `<div class=\"avatar\" aria-hidden=\"true\">${avatarText}</div>` : ''}
        </div>
      `;
    }).join('');
    $messages.html(items);
    if (App.state.autoScroll) window.AppHelpers.scrollToBottom($messages);
  }

  function escapeHtml(str){
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setControlsEnabled(ready){
    const disabled = !ready || App.state.generating || !!App.state.error;
    $input.prop('disabled', !ready || !!App.state.error);
    $send.prop('disabled', disabled);
    $stop.prop('disabled', !App.state.generating);
  }

  function extractThinkParts(text){
    try {
      const re = /<think>([\s\S]*?)<\/think>/i;
      const m = re.exec(text || '');
      if (!m) return { visible: text || '', think: '' };
      const think = (m[1] || '').trim();
      const visible = (text || '').replace(re, '').trim();
      return { visible, think };
    } catch(_e){
      return { visible: text || '', think: '' };
    }
  }

  function postProcessAssistant(id){
    const msg = App.state.messages.find(x => x.id === id);
    if (!msg || msg.role !== 'assistant') return;
    const parts = extractThinkParts(msg.content || '');
    msg.content = parts.visible;
    if (parts.think) msg.think = parts.think;
    Storage.save(KEYS.messages, App.state.messages);
    renderMessages();
  }

  function splitThinkInAll(){
    let changed = false;
    (App.state.messages || []).forEach(m => {
      if (m && m.role === 'assistant' && typeof m.content === 'string' && m.content.indexOf('<think') !== -1 && !m.think){
        const parts = extractThinkParts(m.content);
        m.content = parts.visible;
        if (parts.think) m.think = parts.think;
        changed = true;
      }
    });
    if (changed) { Storage.save(KEYS.messages, App.state.messages); }
  }

  function setProgress(percent, label){
    App.state.progress = percent;
    $progress.css('width', percent + '%');
    $progressLabel.text(label || ('Downloading model... ' + percent + '%'));
    if (percent >= 100) {
      $('#modelStatus').addClass('progress-pulse');
      setTimeout(function(){ $('#modelStatus').removeClass('progress-pulse'); }, 800);
    }
  }

  function addMessage(role, content){
    const msg = { id: window.AppHelpers.uid(), role: role, content: content };
    App.state.messages.push(msg);
    Storage.save(KEYS.messages, App.state.messages);
    return msg.id;
  }

  function updateMessage(id, content){
    const m = App.state.messages.find(x => x.id === id);
    if (m) { m.content = content; Storage.save(KEYS.messages, App.state.messages); }
    $(`.bubble[data-id=\"${id}\"] p`).text(content);
  }

  async function startModel(){
    try {
      splitThinkInAll();
      $statusText.text('Preparing model...');
      setProgress(0, 'Preparing model...');
      await window.AppLLM.load(undefined, (p, phase) => {
        const label = (phase && /cache/i.test(phase)) ? ('Loading from cache... ' + p + '%') :
                      (phase && /download/i.test(phase)) ? ('Downloading model... ' + p + '%') :
                      (phase && /compile|build/i.test(phase)) ? ('Compiling kernels... ' + p + '%') :
                      ('Loading model... ' + p + '%');
        setProgress(p, label);
      });
      App.state.modelReady = true;
      setProgress(100, 'Model ready');
      $statusText.text('Model ready');
      setControlsEnabled(true);
    } catch (err) {
      App.state.error = (err && err.message) ? err.message : 'Failed to initialize model';
      $statusText.text(App.state.error);
      setControlsEnabled(false);
    }
  }

  async function handleSend(){
    const text = window.AppHelpers.trimmed($input.val());
    if (!text) return;
    if (!App.state.modelReady || App.state.generating) return;

    App.state.generating = true;
    setControlsEnabled(true);

    addMessage('user', text);
    renderMessages();
    $input.val('');
    const history = (App.state.messages || []).map(m => ({ role: m.role, content: m.content }));

    const assistantId = addMessage('assistant', '');
    App.state.streamingAssistantId = assistantId;
    renderMessages();

    try {
      await window.AppLLM.generate(text, {
        system: 'You are a concise, helpful assistant. Keep responses brief and useful.',
        messages: history,
        onToken: function(t) {
          const existing = App.state.messages.find(m => m.id === assistantId);
          const current = (existing && typeof existing.content === 'string') ? existing.content : '';
          const next = current + String(t || '');
          updateMessage(assistantId, next);
          if (App.state.autoScroll) window.AppHelpers.scrollToBottom($messages);
        }
      });
    } catch (e) {
      const fallback = 'An error occurred while generating the response.';

    splitThinkInAll();
      const existing = App.state.messages.find(m => m.id === assistantId)?.content || '';
      updateMessage(assistantId, existing || fallback);
    } finally {
      App.state.generating = false;
      App.state.streamingAssistantId = null;
      postProcessAssistant(assistantId);
      setControlsEnabled(true);
    }
  }

  function bindEvents(){
    $input.on('keydown', function(e){
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $send.trigger('click');
      }
    });

    $send.on('click', function(){ handleSend(); });

    $stop.on('click', function(){
      try { window.AppLLM.stop(); } catch(_e){}
      App.state.generating = false;
      setControlsEnabled(true);
    });

    $input.on('input', function(){
      this.style.height = 'auto';
      const max = 160;
      this.style.height = Math.min(this.scrollHeight, max) + 'px';
    });

    // Auto-scroll new content if user is near the bottom
    const observer = new MutationObserver(function(){
      if (App.state.autoScroll) {
        requestAnimationFrame(function(){ window.AppHelpers.scrollToBottom($messages); });
      }
    });
    if ($messages && $messages[0]) { observer.observe($messages[0], { childList: true, subtree: true }); }

    // Toggle autoScroll depending on user scroll position
    $messages.on('scroll', function(){
      App.state.autoScroll = window.AppHelpers.isNearBottom($messages, 48);
    });
  }

  const App = window.App;
  App.state = initialState;

  App.init = function(){
    $messages = $('#messages');
    $input = $('#chatInput');
    $send = $('#sendBtn');
    $stop = $('#stopBtn');
    $progress = $('#progressBar');
    $progressLabel = $('#progressLabel');
    $statusText = $('#statusText');

    App.state.isAppPage = $messages && $messages.length > 0;
    if (!App.state.isAppPage) {
      return;
    }

    renderMessages();
    bindEvents();
    startModel();
  };

  App.render = function(){
    if (!App.state.isAppPage) return;
    // No-op on non-chat pages; chat page updates via events
  };

})();
