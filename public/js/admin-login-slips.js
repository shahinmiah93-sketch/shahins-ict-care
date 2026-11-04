// Admin-only, local generation: PINs never leave the browser for PDF conversion.
(() => {
  const encoder = new TextEncoder();
  function pdf(pages) {
    const chunks = [], offsets = [0]; let length = 0;
    const add = value => { const b = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(b); length += b.length; };
    const object = (id, body) => { offsets[id] = length; add(`${id} 0 obj\n`); add(body); add('\nendobj\n'); };
    add('%PDF-1.4\n%SIC\n');
    object(1,'<< /Type /Catalog /Pages 2 0 R >>');
    object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
    pages.forEach((page,i)=>{
      const id=3+i*3, commands='q\n595.276 0 0 841.89 0 0 cm\n/Photo Do\nQ\n';
      object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Photo ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
      offsets[id+1]=length; add(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`); add(page.bytes); add('\nendstream\nendobj\n');
      object(id+2,`<< /Length ${encoder.encode(commands).length} >>\nstream\n${commands}endstream`);
    });
    const xref=length; add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for(const offset of offsets.slice(1)) add(`${String(offset).padStart(10,'0')} 00000 n \n`);
    add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  async function download(students, options={}) {
    if(!students.length) throw Error('কোনো শিক্ষার্থী নেই');
    // Refuse to silently distribute empty credentials.
    if(students.some(s=>!s.id || !String(s.pin || '').trim())) throw Error('তালিকার কোনো শিক্ষার্থীর PIN পাওয়া যায়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
    const font = new FontFace('SICSlip','url(/fonts/kalpurush.ttf)');
    await font.load(); document.fonts.add(font);
    const pages=[], W=1654,H=2339, margin=66,gap=22, top=108;
    const cw=(W-margin*2-gap)/2,ch=416;
    const settings=options.settings || {};
    function label(ctx,text,x,y,size=28,color='#253b46',align='left') { ctx.font=`${size}px SICSlip`; ctx.fillStyle='#000'; ctx.textAlign=align; ctx.fillText(String(text || ''),x,y); }
    function fit(ctx,text,x,y,max,size=30,color='#153b3d') { while(size>19){ctx.font=`${size}px SICSlip`;if(ctx.measureText(String(text)).width<=max)break;size--;} label(ctx,text,x,y,size,color); }
    function nameLines(ctx,text,x,y,max) {
      const words=String(text).split(/\s+/); let lines=['']; ctx.font='36px SICSlip';
      for(const word of words) { const i=lines.length-1, next=(lines[i]+' '+word).trim(); if(ctx.measureText(next).width>max&&lines[i])lines.push(word);else lines[i]=next; }
      if(lines.length<=2) lines.forEach((line,i)=>fit(ctx,line,x,y+i*34,max,34));
      else fit(ctx,text,x,y,max,28);
    }
    for(let start=0;start<students.length;start+=10) {
      const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
      label(ctx,'শিক্ষার্থী লগইন স্লিপ',margin,65,36,'#123d3c');
      label(ctx,`A4 · ${Math.floor(start/10)+1}/${Math.ceil(students.length/10)} · কাটার দাগ বরাবর কাটুন`,W-margin,65,25,'#586970','right');
      students.slice(start,start+10).forEach((s,i)=>{
        const x=margin+(i%2)*(cw+gap),y=top+Math.floor(i/2)*(ch+gap),pad=24;
        ctx.strokeStyle='#000';ctx.lineWidth=1.5;ctx.setLineDash([8,6]);ctx.strokeRect(x,y,cw,ch);ctx.setLineDash([]);
        ctx.fillStyle='#000';ctx.textAlign='center';ctx.font='bold 46px Arial, sans-serif';
        ctx.fillText(settings.nameEn || "Shahin's ICT Care",x+cw/2,y+53,cw-pad*2);
        ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+pad,y+67);ctx.lineTo(x+cw-pad,y+67);ctx.stroke();
        label(ctx,'শিক্ষার্থী লগইন স্লিপ',x+cw/2,y+95,25,'#000','center');
        nameLines(ctx,s.name || s.nameEn || 'শিক্ষার্থী',x+pad,y+133,cw-pad*2);
        const batch=options.batchName ? options.batchName(s.batchId) : s.batchId || '';
        fit(ctx,[s.session,batch].filter(Boolean).join(' · '),x+pad,y+193,cw-pad*2,25,'#000');
        const bw=(cw-pad*2-18)/2,by=y+211;
        for(let k=0;k<2;k++){ctx.lineWidth=1.5;ctx.strokeRect(x+pad+k*(bw+18),by,bw,94);}
        label(ctx,'শিক্ষার্থী রোল / আইডি',x+pad+16,by+28,24);
        label(ctx,'লগইন PIN',x+pad+bw+34,by+28,24);
        ctx.font='bold 48px monospace';ctx.fillStyle='#000';ctx.textAlign='left';ctx.fillText(String(s.id),x+pad+16,by+78);
        ctx.fillText(String(s.pin),x+pad+bw+34,by+78);
        label(ctx,'shahinictcare.com',x+pad,y+340,29,'#000');
        label(ctx,'লগইন → শিক্ষার্থী → রোল ও PIN দিন',x+pad,y+369,25);
        label(ctx,'PIN গোপন রাখুন। সমস্যা হলে অফিসে যোগাযোগ করুন।',x+pad,y+399,22,'#000');
      });
      const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
      if(!image)throw Error('PDF তৈরি করা যায়নি');
      pages.push({width:W,height:H,bytes:new Uint8Array(await image.arrayBuffer())});canvas.width=canvas.height=0;
    }
    const blob=pdf(pages),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`student-login-slips-${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dhaka'})}.pdf`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    return {pages:pages.length,count:students.length};
  }
  window.SICLoginSlips={download};
})();
