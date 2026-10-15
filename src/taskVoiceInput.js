const ERROR_MESSAGES = {
  'not-allowed': '麥克風權限未開啟，請允許後再試一次。',
  'service-not-allowed': '瀏覽器未允許語音辨識，請檢查權限設定。',
  'audio-capture': '找不到可用的麥克風，請檢查裝置。',
  network: '瀏覽器的線上語音服務無法連線；請檢查網路，或改用支援裝置端辨識的瀏覽器。',
  'language-not-supported': '此瀏覽器尚未提供繁體中文裝置端語音辨識。',
  'no-speech': '沒有聽到聲音，請再試一次。',
};

function speechText(results) {
  let finalText = '';
  let interimText = '';
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    const text = result[0]?.transcript || '';
    if (result.isFinal) finalText += text;
    else interimText += text;
  }
  return finalText + interimText;
}

/** Voice recognition only edits the draft. The existing form submit still saves it. */
export function attachTaskVoiceInput(form, section, input, options = {}) {
  const Recognition = options.Recognition ?? window.SpeechRecognition ?? window.webkitSpeechRecognition;
  const supported = !!Recognition && (options.secureContext ?? window.isSecureContext);
  const field = document.createElement('div');
  field.className = 'task-voice-field';
  input.replaceWith(field);
  field.append(input);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'task-voice-button';
  button.setAttribute('aria-label', '開始語音輸入');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', input.id);
  button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5m-4 0h8"/></svg>';
  field.append(button);

  const status = document.createElement('p');
  status.className = 'task-voice-status';
  status.id = 'task-voice-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  section.append(status);
  button.setAttribute('aria-describedby', status.id);

  if (!supported) {
    button.disabled = true;
    status.textContent = '此瀏覽器無法使用語音輸入；仍可直接打字。';
    return { stop() {}, abort() {} };
  }
  status.textContent = '正在檢查繁體中文語音辨識…';

  let recognition = null;
  let baseText = '';
  let lastError = '';
  let applyingResult = false;
  let localState = 'checking';
  let disposed = false;
  button.disabled = true;
  async function checkLocalRecognition() {
    if (typeof Recognition.available !== 'function' || typeof Recognition.install !== 'function') {
      localState = 'unsupported';
    } else {
      try {
        localState = await Recognition.available({ langs: ['zh-TW'], processLocally: true });
      } catch {
        localState = 'unsupported';
      }
    }
    if (disposed) return;
    button.disabled = false;
    if (localState === 'available') {
      status.textContent = '點麥克風開始說話；語音會在此裝置處理。';
    } else if (localState === 'downloadable' || localState === 'downloading') {
      button.setAttribute('aria-label', '下載繁體中文語音套件');
      status.textContent = '先點麥克風下載瀏覽器的繁體中文語音套件，完成後即可離線辨識。';
    } else {
      status.textContent = '點麥克風開始說話；語音將由瀏覽器的線上服務處理。';
    }
  }
  void checkLocalRecognition();
  function setActive(active) {
    button.classList.toggle('is-listening', active);
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', active ? '停止語音輸入' : '開始語音輸入');
  }
  function stop() {
    if (!recognition) return;
    button.disabled = true;
    status.textContent = '正在完成語音轉文字…';
    try { recognition.stop(); }
    catch { button.disabled = false; }
  }
  function abort() {
    if (!recognition) return;
    const session = recognition;
    recognition = null;
    session.onstart = null;
    session.onresult = null;
    session.onerror = null;
    session.onend = null;
    try { session.abort(); } catch { /* The browser may already have ended recognition. */ }
    button.disabled = false;
    setActive(false);
  }
  button.addEventListener('click', async () => {
    if (recognition) { stop(); return; }
    if (localState === 'downloadable' || localState === 'downloading') {
      button.disabled = true;
      status.textContent = '正在安裝瀏覽器的繁體中文語音套件…';
      try {
        const installed = await Recognition.install({ langs: ['zh-TW'] });
        if (disposed) return;
        localState = installed ? 'available' : 'downloadable';
        status.textContent = installed
          ? '語音套件已安裝。請再點麥克風開始說話。'
          : '語音套件安裝失敗；請確認網路後再點麥克風重試。';
        if (installed) button.setAttribute('aria-label', '開始語音輸入');
      } catch {
        if (disposed) return;
        localState = 'downloadable';
        status.textContent = '語音套件安裝失敗；請確認瀏覽器權限和網路後重試。';
      } finally {
        if (!disposed) button.disabled = false;
      }
      return;
    }
    let session;
    try { session = new Recognition(); }
    catch {
      status.textContent = '無法啟動語音辨識，請改用文字輸入。';
      return;
    }
    recognition = session;
    baseText = input.value;
    lastError = '';
    session.lang = 'zh-TW';
    if (localState === 'available') session.processLocally = true;
    session.continuous = true;
    session.interimResults = true;
    session.maxAlternatives = 1;
    session.onstart = () => {
      if (recognition !== session) return;
      button.disabled = false;
      setActive(true);
      status.textContent = '正在聆聽…再點一次麥克風即可結束。';
    };
    session.onresult = (event) => {
      if (recognition !== session) return;
      const transcript = speechText(event.results);
      if (!transcript) return;
      applyingResult = true;
      input.value = `${baseText}${baseText.trim() ? '\n' : ''}${transcript}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      applyingResult = false;
      status.textContent = '已轉成文字，可繼續說話或點麥克風結束。';
    };
    session.onerror = (event) => {
      if (recognition !== session) return;
      lastError = ERROR_MESSAGES[event.error] || '語音辨識未完成，請再試一次。';
      status.textContent = lastError;
    };
    session.onend = () => {
      if (recognition !== session) return;
      recognition = null;
      button.disabled = false;
      setActive(false);
      if (!lastError) status.textContent = input.value !== baseText ? '語音已填入，請確認內容後繼續。' : '已停止聆聽，可以再點麥克風重試。';
    };
    button.disabled = true;
    status.textContent = '正在等待麥克風啟動；首次使用請在系統提示中允許權限。';
    try { session.start(); }
    catch {
      recognition = null;
      button.disabled = false;
      setActive(false);
      status.textContent = '無法啟動語音辨識，請再試一次。';
    }
  });
  input.addEventListener('input', () => {
    if (!recognition || applyingResult) return;
    abort();
    status.textContent = '已停止聆聽，你可以直接修改文字。';
  });

  const overlay = form.closest('.modal-overlay');
  if (overlay) {
    const observer = new MutationObserver(() => {
      if (form.isConnected && overlay.classList.contains('open')) return;
      disposed = true;
      abort();
      observer.disconnect();
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }
  return { stop, abort };
}
