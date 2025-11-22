(function(){
  'use strict';

  const MODEL_KEY = 'app.llm.model';
  const DEFAULT_MODEL = (typeof localStorage !== 'undefined' && localStorage.getItem(MODEL_KEY)) || 'Qwen3-4B-q4f16_1-MLC';

  // Expose a single global wrapper
  window.AppLLM = {
    engine: null,
    ready: false,
    modelId: DEFAULT_MODEL,
    _aborted: false,
    _mlc: null,
    _loading: null,

    /**
     * Load the model once. Use IndexedDB cache so subsequent sessions start fast.
     * updateProgress(percent: number, phase?: string) is an optional callback for UI.
     */
    async load(modelId, updateProgress){
      const id = modelId || this.modelId;
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported. Use Chrome/Edge 113+ or Firefox 118+.');
      }
      this.modelId = id;
      try { localStorage.setItem(MODEL_KEY, id); } catch(_) {}

      // Reuse existing engine if already initialized in this session
      if (this.ready && this.engine) {
        if (typeof updateProgress === 'function') updateProgress(100, 'Model ready');
        return this.engine;
      }

      // If a load is already in-flight, await it
      if (this._loading) {
        await this._loading;
        if (typeof updateProgress === 'function') updateProgress(100, 'Model ready');
        return this.engine;
      }

      this._loading = (async () => {
        // Dynamically import WebLLM ESM so this file works in classic or module script contexts
        if (!this._mlc) {
          try { if (typeof updateProgress === 'function') updateProgress(0, 'Loading runtime...'); } catch(_){}
          this._mlc = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
        }
        const { CreateMLCEngine } = this._mlc;

        this.engine = await CreateMLCEngine(id, {
          useIndexedDBCache: true,
          initProgressCallback: (p) => {
            let percent = 0;
            if (p && typeof p === 'object' && 'progress' in p) percent = Math.floor((p.progress || 0) * 100);
            else if (typeof p === 'number') percent = Math.floor(p * 100);
            const phase = (p && typeof p === 'object' && (p.text || p.phase)) ? (p.text || p.phase) : '';
            if (typeof updateProgress === 'function') updateProgress(percent, phase);
          },
        });
        this.ready = true;
      })();

      await this._loading;
      this._loading = null;
      if (typeof updateProgress === 'function') updateProgress(100, 'Model ready');
      return this.engine;
    },

    /**
     * Stream a chat completion. onToken is called with each token chunk.
     * Returns when the stream completes. If stop() was called, resolves early.
     */
    async generate(userText, { system = '', messages = null, onToken } = {}){
      if (!this.engine) throw new Error('Model not loaded');
      this._aborted = false;
      let chatMessages = Array.isArray(messages) && messages.length ? messages.slice() : [];
      if (!chatMessages.length) {
        if (system) chatMessages.push({ role: 'system', content: system });
        chatMessages.push({ role: 'user', content: userText });
      } else {
        if (system && chatMessages[0]?.role !== 'system') {
          chatMessages.unshift({ role: 'system', content: system });
        }
      }
      const stream = await this.engine.chat.completions.create({ messages: chatMessages, stream: true });
      for await (const chunk of stream) {
        if (this._aborted) break;
        const token = (chunk && chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) || '';
        if (token && typeof onToken === 'function') onToken(token);
      }
    },

    stop(){ this._aborted = true; },
  };
})();
