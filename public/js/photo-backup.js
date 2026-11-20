// Merge the server's bounded, uncompressed ZIP chunks into one category download.
window.SICPhotoBackup = async function (category, progress) {
  const locals = [], directories = []; let offset = 0, count = 0, directorySize = 0;
  for (let index = 0; index < category.parts.length; index++) {
    progress('ছবি সংগ্রহ হচ্ছে… ' + Math.round(index / category.parts.length * 100) + '%');
    const response = await fetch(category.parts[index].url, { cache: 'no-store' });
    if (!response.ok) throw new Error(response.status === 401 ? 'আবার লগইন করুন।' : 'ডাউনলোড হয়নি। ছবির তালিকা আবার খুলে চেষ্টা করুন।');
    const bytes = new Uint8Array(await response.arrayBuffer()), view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error('ব্যাকআপ ফাইলটি ঠিক নেই। আবার চেষ্টা করুন।');
    const start = view.getUint32(end + 16, true), entries = view.getUint16(end + 10, true);
    locals.push(new Blob([bytes.subarray(0, start)]));
    let cursor = start;
    for (let i = 0; i < entries; i++) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('ব্যাকআপ ফাইলটি ঠিক নেই।');
      const size = 46 + view.getUint16(cursor + 28, true) + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
      const record = bytes.slice(cursor, cursor + size), header = new DataView(record.buffer);
      header.setUint32(42, header.getUint32(42, true) + offset, true);
      directories.push(record); directorySize += size; cursor += size;
    }
    offset += start; count += entries;
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, count, true); view.setUint16(10, count, true);
  view.setUint32(12, directorySize, true); view.setUint32(16, offset, true);
  const zip = new Blob([...locals, ...directories, end], { type: 'application/zip' });
  const url = URL.createObjectURL(zip), link = document.createElement('a');
  link.href = url; link.download = 'shahins-' + category.key + '-' + new Date().toISOString().slice(0, 10) + '.zip';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  progress('✓ ZIP প্রস্তুত। ব্রাউজারের ডাউনলোড তালিকা দেখুন।');
};
