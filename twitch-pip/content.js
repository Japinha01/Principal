// Twitch PiP: botão de Picture-in-Picture no player da Twitch (atalho Alt+P).

(function () {
  'use strict';

  const BTN_ID = 'jx-twitch-pip';
  const ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
    '<path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg>';

  // A Twitch pode ter vários <video> na página (prévias, anúncios). Pega o maior visível.
  function findVideo() {
    let best = null, bestArea = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (v.readyState > 0 && area > bestArea) { best = v; bestArea = area; }
    }
    return best || document.querySelector('video');
  }

  async function togglePip() {
    if (!document.pictureInPictureEnabled) {
      alert('Seu navegador não suporta Picture-in-Picture por script. No Firefox, use o botão nativo que aparece sobre o vídeo.');
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }
      const video = findVideo();
      if (!video) return;
      video.disablePictureInPicture = false;
      video.removeAttribute('disablepictureinpicture');
      await video.requestPictureInPicture();
    } catch (err) {
      console.warn('[Twitch PiP]', err);
    }
  }

  function addButton() {
    if (document.getElementById(BTN_ID)) return;
    const group = document.querySelector('.player-controls__right-control-group');
    if (!group) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.title = 'Picture-in-Picture (Alt+P)';
    btn.setAttribute('aria-label', 'Picture-in-Picture');
    btn.innerHTML = ICON;
    btn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;' +
      'margin:0 2px;border:0;border-radius:4px;background:transparent;color:#fff;cursor:pointer;';
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,.15)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    btn.addEventListener('click', (e) => { e.stopPropagation(); togglePip(); });

    // Fica logo antes do botão de tela cheia (último da barra).
    group.insertBefore(btn, group.lastElementChild);
  }

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.code !== 'KeyP') return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    togglePip();
  });

  // A Twitch é uma SPA e recria o player ao trocar de canal: observa e reinsere o botão.
  new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true });
  addButton();
})();
