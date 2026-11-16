"use strict";

const downloadButton = document.querySelector("#download-receipt");
const receipt = document.querySelector(".receipt-view .r");
const statusMessage = document.querySelector(".pb [role=status]");

function pdfFromCanvas(canvas) {
  const jpeg = atob(canvas.toDataURL("image/jpeg", 0.94).split(",")[1]);
  const imageBytes = Uint8Array.from(jpeg, (character) => character.charCodeAt(0));
  const pageWidth = 595.28;
  const pageHeight = 419.53;
  const scale = Math.min((pageWidth - 24) / canvas.width, (pageHeight - 24) / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  const commands = "q " + width + " 0 0 " + height + " " + ((pageWidth - width) / 2)
    + " " + ((pageHeight - height) / 2) + " cm /Receipt Do Q\n";

  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let length = 0;
  function append(content) {
    const bytes = typeof content === "string" ? encoder.encode(content) : content;
    parts.push(bytes);
    length += bytes.length;
  }
  function object(...contents) {
    const number = offsets.length;
    offsets.push(length);
    append(number + " 0 obj\n");
    for (const content of contents) append(content);
    append("\nendobj\n");
  }

  append("%PDF-1.4\n");
  object("<< /Type /Catalog /Pages 2 0 R >>");
  object("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  object("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageWidth + " " + pageHeight
    + "] /Resources << /XObject << /Receipt 4 0 R >> >> /Contents 5 0 R >>");
  object("<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height
    + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + imageBytes.length
    + " >>\nstream\n", imageBytes, "\nendstream");
  object("<< /Length " + commands.length + " >>\nstream\n" + commands + "endstream");
  const xref = length;
  append("xref\n0 " + offsets.length + "\n0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) append(String(offset).padStart(10, "0") + " 00000 n \n");
  append("trailer\n<< /Size " + offsets.length + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
  return new Blob(parts, { type: "application/pdf" });
}

async function downloadReceipt() {
  downloadButton.disabled = true;
  statusMessage.textContent = "PDF তৈরি হচ্ছে…";
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(receipt.querySelectorAll("img"), (img) => img.decode()));
    const canvas = await window.html2canvas(receipt, { scale: 2, logging: false, windowWidth: Math.max(innerWidth, receipt.scrollWidth + 32) });
    const url = URL.createObjectURL(pdfFromCanvas(canvas));
    const link = document.createElement("a");
    link.href = url;
    link.download = "receipt-" + downloadButton.dataset.code + ".pdf";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    statusMessage.textContent = "";
  } catch (error) {
    statusMessage.textContent = "PDF তৈরি করা যায়নি। আবার চেষ্টা করুন বা প্রিন্ট চাপুন।";
  } finally {
    downloadButton.disabled = false;
  }
}

downloadButton.addEventListener("click", downloadReceipt);
document.querySelector("#print-receipt").addEventListener("click", () => window.print());
if (downloadButton.hasAttribute("data-auto-download")) downloadReceipt();
