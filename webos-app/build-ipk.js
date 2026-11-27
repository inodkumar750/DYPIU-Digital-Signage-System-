/**
 * NEXORA TV — webOS IPK Builder
 * Packages the webOS app into a valid .ipk file (Debian ar archive)
 * No external dependencies required — pure Node.js built-ins only
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const APP_ID  = 'in.ac.dypiu.nexora.tv';
const APP_DIR = path.join(__dirname, 'app');
const OUT_DIR = path.join(__dirname, '..', 'public');
const OUT_IPK = path.join(OUT_DIR, 'NEXORA-TV.ipk');

// ─── 1. POSIX ustar tar builder ─────────────────────────────────────────────
function buildTarGz(entries) {
  const blocks = [];

  for (const { name, data } of entries) {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

    // 512-byte ustar header
    const hdr = Buffer.alloc(512, 0);
    hdr.write(name.slice(0, 99), 0, 'utf8');                           // name
    hdr.write('0000755\0', 100, 'ascii');                               // mode
    hdr.write('0000000\0', 108, 'ascii');                               // uid
    hdr.write('0000000\0', 116, 'ascii');                               // gid
    const sizeOct = buf.length.toString(8).padStart(11, '0') + '\0';
    hdr.write(sizeOct, 124, 'ascii');                                   // size
    const mtimeOct = Math.floor(Date.now()/1000).toString(8).padStart(11,'0') + '\0';
    hdr.write(mtimeOct, 136, 'ascii');                                  // mtime
    hdr.write('        ', 148, 'ascii');                                // checksum placeholder
    hdr.write('0', 156, 'ascii');                                       // type: regular file
    hdr.write('ustar\0', 257, 'ascii');                                 // magic
    hdr.write('00', 263, 'ascii');                                      // version

    // Calculate & write checksum
    let chk = 0;
    for (let i = 0; i < 512; i++) chk += hdr[i];
    hdr.write(chk.toString(8).padStart(6,'0') + '\0 ', 148, 'ascii');

    blocks.push(hdr);

    // Data (512-byte aligned)
    const paddedSz = Math.ceil(buf.length / 512) * 512;
    const paddedBuf = Buffer.alloc(paddedSz, 0);
    buf.copy(paddedBuf);
    blocks.push(paddedBuf);
  }

  // End-of-archive marker
  blocks.push(Buffer.alloc(1024, 0));
  return zlib.gzipSync(Buffer.concat(blocks));
}

// ─── 2. ar archive builder ───────────────────────────────────────────────────
function buildAr(files) {
  const parts = [Buffer.from('!<arch>\n', 'ascii')];
  for (const { name, data } of files) {
    const hdr =
      name.slice(0, 16).padEnd(16, ' ') +   // identifier
      '0           '.slice(0, 12) +           // timestamp
      '0     ' +                              // owner id
      '0     ' +                              // group id
      '100644  ' +                            // file mode
      String(data.length).padEnd(10, ' ') +  // file size
      '`\n';                                  // end chars
    parts.push(Buffer.from(hdr, 'ascii'));
    parts.push(data);
    if (data.length % 2 !== 0) parts.push(Buffer.from('\n', 'ascii'));
  }
  return Buffer.concat(parts);
}

// ─── 3. Collect app files ────────────────────────────────────────────────────
const installBase = `./usr/palm/applications/${APP_ID}`;
const dataEntries = [];

function collectFiles(dir, base) {
  for (const fname of fs.readdirSync(dir)) {
    const full  = path.join(dir, fname);
    const entry = `${base}/${fname}`;
    const stat  = fs.statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, entry);
    } else {
      dataEntries.push({ name: entry, data: fs.readFileSync(full) });
      console.log(`  + ${entry} (${stat.size} bytes)`);
    }
  }
}

console.log('\n📦 NEXORA TV — webOS IPK Builder');
console.log('─'.repeat(44));
console.log('App files:');
collectFiles(APP_DIR, installBase);

// ─── 4. control.tar.gz ───────────────────────────────────────────────────────
const control =
`Package: ${APP_ID}
Version: 1.0.4
Section: misc
Priority: optional
Architecture: all
Installed-Size: 512
Maintainer: DYPIU <it@dypiu.ac.in>
Description: NEXORA TV Digital Signage Player
 Auto-launches NEXORA signage dashboard on D.Y. Patil International
 University campus displays. Connects to local NEXORA server.
`;
const controlTarGz = buildTarGz([{ name: './control', data: control }]);

// ─── 5. data.tar.gz ──────────────────────────────────────────────────────────
const dataTarGz = buildTarGz(dataEntries);

// ─── 6. debian-binary ────────────────────────────────────────────────────────
const debBinary = Buffer.from('2.0\n', 'ascii');

// ─── 7. Package into .ipk ────────────────────────────────────────────────────
const ipk = buildAr([
  { name: 'debian-binary',   data: debBinary   },
  { name: 'control.tar.gz',  data: controlTarGz },
  { name: 'data.tar.gz',     data: dataTarGz   },
]);

fs.writeFileSync(OUT_IPK, ipk);

const sizeMB = (ipk.length / 1024).toFixed(1);
console.log('─'.repeat(44));
console.log(`✅ IPK built: NEXORA-TV.ipk (${sizeMB} KB)`);
console.log(`📁 Saved to: ${OUT_IPK}`);
console.log('─'.repeat(44));
console.log('Install steps on LG webOS TV:');
console.log('  1. Enable Developer Mode on TV');
console.log('  2. Use ares-install or Developer Mode app');
console.log('  3. Or copy to USB and install via Dev menu');
console.log('─'.repeat(44));
