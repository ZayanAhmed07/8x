// Renders the Windows installer artwork from HTML and saves it in the formats NSIS needs:
//   build/installerSidebar.bmp (164x314): welcome and finish pages
//   build/installerHeader.bmp  (150x57):  top-right of every other page
//   build/icon.ico:                       installer, uninstaller and header icon
// Run: npx electron scripts/make-installer-art.js
const { app, BrowserWindow } = require("electron");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("../package.json");

const BUILD = path.join(__dirname, "..", "build");
const BARS = [0.42, 0.78, 1, 0.64, 0.86, 0.46, 0.24];
const bars = (color, height) => `<div style="display:flex;align-items:flex-end;gap:${Math.round(height / 9)}px;height:${height}px">${BARS.map((ratio) => `<i style="display:block;width:${Math.round(height / 6)}px;height:${Math.round(ratio * 100)}%;border-radius:2px;background:${color}"></i>`).join("")}</div>`;

const SIDEBAR = `<!doctype html><html><body style="margin:0;width:164px;height:314px;overflow:hidden;background:#12110F;font-family:Georgia,'Palatino Linotype',serif;color:#F3EFE6;position:relative">
  <div style="position:absolute;inset:0;background:radial-gradient(180px 160px at 50% 110%, rgba(240,128,79,.45), transparent 70%), radial-gradient(120px 90px at 0% 0%, rgba(240,128,79,.12), transparent 70%)"></div>
  <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,244,230,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,244,230,.05) 1px,transparent 1px);background-size:16px 16px"></div>
  <div style="position:relative;padding:26px 18px">
    ${bars("#F0804F", 26)}
    <div style="margin-top:22px;font-size:30px;line-height:1;letter-spacing:-.5px">Tally</div>
    <div style="font-size:30px;line-height:1.05;letter-spacing:-.5px;font-style:italic;color:#F0804F">Capture</div>
    <div style="margin-top:14px;font-family:'Segoe UI',sans-serif;font-size:11px;line-height:1.45;color:rgba(243,239,230,.66)">Record meetings without a bot. Who owes what, with the moment they said it.</div>
  </div>
  <div style="position:absolute;left:18px;right:18px;bottom:18px;display:flex;justify-content:space-between;font-family:'Segoe UI',sans-serif;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(243,239,230,.42)"><span>Windows</span><span>v${version}</span></div>
</body></html>`;

const HEADER = `<!doctype html><html><body style="margin:0;width:150px;height:57px;overflow:hidden;background:#FFFFFF;display:flex;align-items:center;justify-content:flex-end;gap:7px;padding-right:8px;box-sizing:border-box;font-family:Georgia,serif;color:#1D1C19">
  ${bars("#C2410C", 18)}<span style="font-size:15px;letter-spacing:-.3px;white-space:nowrap">Tally <i style="color:#C2410C">Capture</i></span>
</body></html>`;

/** 24-bit bottom-up BMP from Electron's BGRA bitmap. */
function toBmp(image, width, height) {
  const pixels = image.resize({ width, height, quality: "best" }).toBitmap();
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const data = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = (height - 1 - y) * rowSize + x * 3;
      data[target] = pixels[source];
      data[target + 1] = pixels[source + 1];
      data[target + 2] = pixels[source + 2];
    }
  }
  const header = Buffer.alloc(54);
  header.write("BM", 0);
  header.writeUInt32LE(54 + data.length, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(data.length, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);
  return Buffer.concat([header, data]);
}

/** ICO with PNG-compressed entries (supported since Windows Vista). */
function toIco(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, png }, index) => {
    const entry = 6 + index * 16;
    header[entry] = size >= 256 ? 0 : size;
    header[entry + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...pngs.map(({ png }) => png)]);
}

async function render(html, width, height) {
  const win = new BrowserWindow({ width, height, show: false, useContentSize: true, frame: false, webPreferences: { offscreen: true } });
  const file = path.join(os.tmpdir(), `tally-art-${width}x${height}.html`);
  fs.writeFileSync(file, html);
  await win.loadFile(file);
  await new Promise((resolve) => setTimeout(resolve, 400));
  const image = await win.webContents.capturePage();
  win.destroy();
  return image;
}

// Each render opens and closes a window; do not quit when the last one closes.
app.on("window-all-closed", () => {});

app.whenReady().then(async () => {
  try {
  fs.writeFileSync(path.join(BUILD, "installerSidebar.bmp"), toBmp(await render(SIDEBAR, 164, 314), 164, 314));
  fs.writeFileSync(path.join(BUILD, "installerHeader.bmp"), toBmp(await render(HEADER, 150, 57), 150, 57));
  const { nativeImage } = require("electron");
  const master = nativeImage.createFromPath(path.join(BUILD, "icon.png"));
  fs.writeFileSync(path.join(BUILD, "icon.ico"), toIco([256, 64, 48, 32, 16].map((size) => ({ size, png: master.resize({ width: size, height: size, quality: "best" }).toPNG() }))));
  // PNG previews, so the artwork can be checked without building an installer.
  fs.writeFileSync(path.join(BUILD, "preview-sidebar.png"), (await render(SIDEBAR, 164, 314)).resize({ width: 164, height: 314 }).toPNG());
  fs.writeFileSync(path.join(BUILD, "preview-header.png"), (await render(HEADER, 150, 57)).resize({ width: 150, height: 57 }).toPNG());
  console.log("installer art written to build/");
  app.quit();
  } catch (error) {
    // Offscreen capture occasionally fails on some GPUs; the committed art is still valid.
    console.error("installer art failed:", error.message, "(re-run npm run art)");
    app.exit(1);
  }
});
