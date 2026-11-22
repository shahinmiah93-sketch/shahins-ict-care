// Recent search terms stay in this browser, separately for each search field.
(() => {
  const records = new WeakMap();
  let active = null, panel = null;
  const normalize = value => String(value).trim().replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d)).toLowerCase();
  function eligible(input) {
    if (!(input instanceof HTMLInputElement) || !['text','search','tel'].includes(input.type) || input.disabled || input.readOnly || input.hasAttribute('data-combo')) return false;
    return input.type === 'search' || /খুঁজ|সার্চ|search|নাম.*(?:আইডি|মোবাইল)|আইডি.*নাম|রোল.*নাম/i.test(input.placeholder || '') || input.matches('[data-q],[data-docq],[data-saleq],[data-f="q"],[data-g="q"],input[name="q"]');
  }
  function scope(input) {
    const route = location.hash.replace(/^#/, '').split('/').slice(0,2).join('/');
    if (location.pathname.startsWith('/admin') && input.id === 'q' && /^students(?:\/|$)/.test(route)) return 'students-' + (route.includes('online') ? 'online' : 'offline');
    const marker = input.id || input.name || [...input.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('|') || input.placeholder;
    return location.pathname + ':' + route + ':' + (input.closest('form')?.id || '') + ':' + marker;
  }
  function setup(input) {
    if (!records.has(input)) { records.set(input, { key:'sic-search-history:' + scope(input), previous:input.value }); input.autocomplete='off'; }
    return records.get(input);
  }
  function read(input) {
    try { const value=JSON.parse(localStorage.getItem(setup(input).key)||'[]'); return Array.isArray(value) ? value.filter(x=>typeof x==='string').slice(0,20) : []; } catch { return []; }
  }
  function save(input, value=input.value) {
    value=value.trim().slice(0,160); if (!value || setup(input).removed === normalize(value)) return;
    const values=[value,...read(input).filter(x=>normalize(x)!==normalize(value))].slice(0,20);
    try { localStorage.setItem(setup(input).key,JSON.stringify(values)); } catch {}
  }
  function hide() { if(panel) panel.hidden=true; }
  function place() {
    if (!active?.isConnected || !panel || panel.hidden) return hide();
    const r=active.getBoundingClientRect(), below=innerHeight-r.bottom-10;
    panel.style.width=Math.min(Math.max(r.width,240),innerWidth-16)+'px';
    panel.style.left=Math.max(8,Math.min(r.left,innerWidth-parseFloat(panel.style.width)-8))+'px';
    panel.style.maxHeight=Math.max(100,Math.min(300,below>=160?below:r.top-12))+'px';
    panel.style.top=below>=160 ? r.bottom+6+'px' : 'auto'; panel.style.bottom=below>=160 ? 'auto' : innerHeight-r.top+6+'px';
  }
  function show(input) {
    setup(input); active=input;
    if(!panel){panel=document.createElement('div');panel.setAttribute('aria-label','সাম্প্রতিক সার্চ');panel.style.cssText='position:fixed;z-index:2147483000;background:white;color:#123f36;border:1px solid #cbded8;border-radius:12px;box-shadow:0 8px 24px #12382f26;padding:8px;overflow:auto;box-sizing:border-box';document.body.append(panel);}
    panel.replaceChildren(); const entries=read(input); if(!entries.length)return hide();
    const header=document.createElement('div');header.textContent='সাম্প্রতিক সার্চ · নতুন থেকে পুরোনো';header.style.cssText='padding:5px 8px;font-size:12px;color:#61756f';panel.append(header);
    for(const value of entries){
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:4px';
      const button=document.createElement('button');button.type='button';button.textContent='↶  '+value;button.style.cssText='flex:1;min-width:0;text-align:left;overflow-wrap:anywhere;padding:10px;border:0;border-radius:7px;background:white;color:#123f36;cursor:pointer;font:inherit';
      button.onmouseenter=()=>button.style.background='#edf6f3';button.onmouseleave=()=>button.style.background='white';
      button.onclick=()=>{setup(input).removed=null;input.value=value;save(input);input.focus();hide();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));};
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='এই সার্চটি মুছুন';remove.setAttribute('aria-label',value+' — ইতিহাস থেকে মুছুন');remove.style.cssText='flex:none;width:34px;height:34px;border:0;border-radius:7px;background:#f8eeee;color:#a33b3b;font-size:22px;cursor:pointer';
      remove.onclick=event=>{event.stopPropagation();if(normalize(input.value)===normalize(value)){setup(input).removed=normalize(value);setup(input).previous='';}try{localStorage.setItem(setup(input).key,JSON.stringify(read(input).filter(x=>normalize(x)!==normalize(value))));}catch{}show(input);if(!panel.hidden)panel.querySelector('button')?.focus();};
      row.append(button,remove);panel.append(row);
    }
    const clear=document.createElement('button');clear.type='button';clear.textContent='ইতিহাস মুছুন';clear.style.cssText='border:0;background:transparent;color:#697a75;padding:8px;cursor:pointer';clear.onclick=()=>{setup(input).removed=normalize(input.value);setup(input).previous='';try{localStorage.removeItem(setup(input).key);}catch{}hide();};panel.append(clear);
    panel.hidden=false;place();
  }
  document.addEventListener('focusin',event=>{if(eligible(event.target))show(event.target);else if(!panel?.contains(event.target))hide();});
  document.addEventListener('click',event=>{if(eligible(event.target))show(event.target);else if(!panel?.contains(event.target))hide();});
  document.addEventListener('input',event=>{const input=event.target;if(!eligible(input))return;const state=setup(input);state.removed=null;if(!input.value.trim())save(input,state.previous);state.previous=input.value;hide();});
  document.addEventListener('focusout',event=>{if(records.has(event.target))save(event.target);});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')hide();
    if(!eligible(event.target))return;
    if(event.key==='Enter'){setup(event.target).removed=null;save(event.target);hide();}
    if(event.key==='ArrowDown'){show(event.target);if(!panel.hidden){event.preventDefault();panel.querySelector('button')?.focus();}}
  });
  addEventListener('hashchange',hide);addEventListener('resize',hide);document.addEventListener('scroll',event=>{if(!panel?.contains(event.target))hide();},true);
})();
