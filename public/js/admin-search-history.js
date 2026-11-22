// Search history is private to this browser; newest completed searches come first.
window.SICSearchHistory = function (input, scope) {
  const key = 'sic-search-history:' + scope;
  let entries = [];
  try { const stored = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(stored)) entries = stored.filter(x => typeof x === 'string').slice(0, 20); } catch {}
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:relative;flex:1;min-width:200px';
  input.before(wrapper); wrapper.append(input); input.style.width = '100%'; input.autocomplete = 'off';
  const panel = document.createElement('div');
  panel.hidden = true;
  panel.style.cssText = 'position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:40;background:#fff;border:1px solid #cbded8;border-radius:12px;box-shadow:0 8px 24px #12382f26;padding:8px;max-height:300px;overflow:auto';
  wrapper.append(panel);
  input.setAttribute('aria-label', 'নাম, আইডি বা মোবাইল দিয়ে খুঁজুন; সাম্প্রতিক সার্চ');
  function save(value = input.value) {
    value = value.trim().slice(0, 160); if (!value) return;
    entries = [value, ...entries.filter(x => x.toLowerCase() !== value.toLowerCase())].slice(0, 20);
    try { localStorage.setItem(key, JSON.stringify(entries)); } catch {}
  }
  function show() {
    panel.replaceChildren();
    if (!entries.length) { panel.hidden = true; return; }
    const heading = document.createElement('div'); heading.textContent = 'সাম্প্রতিক সার্চ · নতুন থেকে পুরোনো'; heading.style.cssText = 'padding:5px 8px;font-size:12px;color:#61756f'; panel.append(heading);
    entries.forEach(value => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = '↶  ' + value;
      button.style.cssText = 'display:block;width:100%;text-align:left;padding:10px;border:0;border-radius:7px;background:white;color:#123f36;cursor:pointer;font:inherit';
      button.onmouseenter = () => button.style.background = '#edf6f3'; button.onmouseleave = () => button.style.background = 'white';
      button.onclick = () => { input.value = value; save(); input.dispatchEvent(new Event('input', { bubbles:true })); input.focus(); panel.hidden = true; };
      panel.append(button);
    });
    panel.hidden = false;
  }
  input.addEventListener('focus', show);
  input.addEventListener('click', show);
  input.addEventListener('input', () => { panel.hidden = true; });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); save(); panel.hidden = true; }
    if (event.key === 'Escape') panel.hidden = true;
    if (event.key === 'ArrowDown') { event.preventDefault(); show(); panel.querySelector('button')?.focus(); }
  });
  wrapper.addEventListener('focusout', () => { if (input.value.trim()) save(); setTimeout(() => { if (!wrapper.contains(document.activeElement)) panel.hidden = true; }, 0); });
};
