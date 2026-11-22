// Private admission paperwork: mounted only in the admin interface.
window.SICAdmissionFiles = function (studentId = '') {
  const root = document.createElement('section'); root.className = 'card';
  root.innerHTML = '<h3>ভর্তি ফর্মের সংযুক্তি <small class="muted">· শুধু অ্যাডমিন</small></h3><p class="muted">অফলাইন ভর্তি ফর্মের স্ক্যান বা প্রয়োজনীয় কাগজ যুক্ত করুন। একাধিক PDF, JPG, PNG বা WEBP বাছতে পারবেন। প্রতি ফাইল সর্বোচ্চ ১০ MB।</p><label class="btn line">＋ ফাইল বাছুন<input data-files type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden></label> <button type="button" class="btn gold" data-upload hidden>ফাইল সংরক্ষণ করুন</button><p data-status role="status" aria-live="polite"></p><div data-queue></div><div data-list></div>';
  const input = root.querySelector('[data-files]'), button = root.querySelector('[data-upload]'), status = root.querySelector('[data-status]'), queueBox = root.querySelector('[data-queue]'), list = root.querySelector('[data-list]');
  let id = studentId, queue = [], busy = false;
  const endpoint = () => '/api/admin/admission-files/' + encodeURIComponent(id);
  const paint = () => {
    button.hidden = !id || !queue.length; button.disabled = busy; input.disabled = busy;
    queueBox.innerHTML = queue.map((file, index) => '<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;padding:8px 0;overflow-wrap:anywhere"><span>' + U.esc(file.name) + ' · ' + (file.size / 1048576).toFixed(2) + ' MB</span><button type="button" class="btn sm line" data-remove="' + index + '"' + (busy ? ' disabled' : '') + '>বাদ দিন</button></div>').join('');
  };
  async function refresh() {
    if (!id) return;
    const result = await U.api(endpoint());
    list.innerHTML = result.items.length ? '<h4>সংরক্ষিত ফাইল (' + U.bn(result.items.length) + ')</h4>' + result.items.map(item => '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #dae5e2"><span style="flex:1;min-width:140px;overflow-wrap:anywhere">' + U.esc(item.name) + '<small style="display:block" class="muted">' + (item.size / 1048576).toFixed(2) + ' MB · ' + U.date(item.createdAt.slice(0,10)) + '</small></span><a class="btn sm line" target="_blank" rel="noopener" href="' + endpoint() + '/' + item.id + '">দেখুন</a><a class="btn sm line" href="' + endpoint() + '/' + item.id + '?download=1">↓ ডাউনলোড</a></div>').join('') : '<p class="muted">এখনো কোনো ফাইল সংযুক্ত নেই।</p>';
  }
  async function upload() {
    if (!id || busy || !queue.length) return;
    busy = true; paint(); let saved = 0;
    try {
      while (queue.length) {
        const file = queue[0]; status.textContent = 'সংরক্ষণ হচ্ছে: ' + file.name;
        const response = await fetch(endpoint() + '?name=' + encodeURIComponent(file.name), { method: 'POST', body: file });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'ফাইল সংরক্ষণ হয়নি');
        queue.shift(); saved++; paint();
      }
      status.textContent = '✓ ফাইল সংরক্ষিত হয়েছে।';
    } catch (error) { status.textContent = (saved ? U.bn(saved) + 'টি ফাইল সেভ হয়েছে। ' : '') + error.message + ' বাকি ফাইলগুলো আবার সংরক্ষণ করুন।'; }
    finally { busy = false; paint(); await refresh().catch(() => { list.textContent = 'ফাইলের তালিকা আনতে সমস্যা হয়েছে। পাতা আবার খুলুন।'; }); }
  }
  input.onchange = () => {
    const errors = [];
    for (const file of input.files) {
      if (!/\.(pdf|jpe?g|png|webp)$/i.test(file.name) || !file.size || file.size > 10 * 1048576) { errors.push(file.name); continue; }
      if (!queue.some(other => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified)) queue.push(file);
    }
    input.value = ''; paint();
    status.textContent = errors.length ? 'ফাইলের ধরন বা আকার ঠিক নেই: ' + errors.join(', ') : id ? 'ফাইল সংরক্ষণ করুন বাটনে চাপুন।' : 'ভর্তি সেভ করলে বাছাই করা ফাইলগুলো এই শিক্ষার্থীর সঙ্গে সংরক্ষিত হবে।';
  };
  queueBox.onclick = event => { const remove = event.target.closest('[data-remove]'); if (remove && !busy) { queue.splice(Number(remove.dataset.remove), 1); paint(); } };
  button.onclick = upload;
  if (id) refresh().catch(error => { status.textContent = error.message; });
  return { element: root, hasPending: () => !!queue.length, bind: async sid => { id = sid; paint(); if (queue.length) await upload(); else await refresh().catch(error => { status.textContent = error.message; }); } };
};
