"use strict";

const loader = document.currentScript;
const bytes = Uint8Array.from(atob(loader.dataset.sheet), (character) => character.charCodeAt(0));
const { sheet, settings } = JSON.parse(new TextDecoder().decode(bytes));
const preview = U.reviewSheetDocument(sheet, settings)
  .replaceAll("<script>", '<script nonce="' + loader.nonce + '">')
  .replace('onclick="print()"', 'id="sheet-print"')
  .replace('onclick="window.close()"', 'id="sheet-close"');

document.open();
document.write(preview);
document.close();
document.getElementById("sheet-print").addEventListener("click", () => window.print());
document.getElementById("sheet-close").addEventListener("click", () => window.close());
