import fs from 'fs';

const CONTAINER_BOXES = new Set([
  'moov',
  'trak',
  'mdia',
  'minf',
  'stbl',
  'edts',
  'udta',
  'meta',
  'mvex',
]);

function readBoxes(buf) {
  const boxes = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1 && offset + 16 <= buf.length) {
      size = Number(buf.readBigUInt64BE(offset + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = buf.length - offset;
    }
    if (!Number.isFinite(size) || size < headerSize || offset + size > buf.length) {
      return null; // Unrecognized MP4 structure; skip safely
    }
    boxes.push({ type, offset, size, data: buf.subarray(offset, offset + size) });
    offset += size;
  }
  return offset === buf.length ? boxes : null;
}

function patchChunkOffsetsInMoov(moovBuf, deltaBytes) {
  function walk(start, end) {
    let pos = start;
    while (pos + 8 <= end) {
      let size = moovBuf.readUInt32BE(pos);
      const type = moovBuf.toString('ascii', pos + 4, pos + 8);
      let hdr = 8;
      if (size === 1 && pos + 16 <= end) {
        size = Number(moovBuf.readBigUInt64BE(pos + 8));
        hdr = 16;
      }
      if (!Number.isFinite(size) || size < hdr || pos + size > end) break;
      const boxEnd = pos + size;

      if (type === 'stco' && pos + hdr + 8 <= boxEnd) {
        const count = moovBuf.readUInt32BE(pos + hdr + 4);
        for (let i = 0; i < count; i++) {
          const entryPos = pos + hdr + 8 + i * 4;
          if (entryPos + 4 <= boxEnd) {
            const oldVal = moovBuf.readUInt32BE(entryPos);
            moovBuf.writeUInt32BE(oldVal + deltaBytes, entryPos);
          }
        }
      } else if (type === 'co64' && pos + hdr + 8 <= boxEnd) {
        const count = moovBuf.readUInt32BE(pos + hdr + 4);
        for (let i = 0; i < count; i++) {
          const entryPos = pos + hdr + 8 + i * 8;
          if (entryPos + 8 <= boxEnd) {
            const oldVal = moovBuf.readBigUInt64BE(entryPos);
            moovBuf.writeBigUInt64BE(oldVal + BigInt(deltaBytes), entryPos);
          }
        }
      } else if (CONTAINER_BOXES.has(type)) {
        const childStart = type === 'meta' ? pos + hdr + 4 : pos + hdr;
        if (childStart < boxEnd) walk(childStart, boxEnd);
      }

      pos = boxEnd;
    }
  }
  walk(0, moovBuf.length);
}

/**
 * Losslessly moves an MP4 file's `moov` atom before `mdat` (FastStart)
 * so Android TVs & browsers begin video playback immediately without
 * buffering the entire file first. Returns true if file was converted.
 */
export function ensureMp4FastStart(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    const boxes = readBoxes(buf);
    if (!boxes) return false;

    const moovIdx = boxes.findIndex((b) => b.type === 'moov');
    const mdatIdx = boxes.findIndex((b) => b.type === 'mdat');
    if (moovIdx === -1 || mdatIdx === -1 || moovIdx < mdatIdx) {
      return false; // Already FastStart or not applicable
    }

    const moovCopy = Buffer.from(boxes[moovIdx].data);
    patchChunkOffsetsInMoov(moovCopy, moovCopy.length);

    const reordered = [];
    for (let i = 0; i < boxes.length; i++) {
      if (i === moovIdx) continue;
      if (i === mdatIdx) {
        reordered.push(moovCopy);
      }
      reordered.push(boxes[i].data);
    }

    const tmpPath = `${filePath}.faststart.tmp`;
    fs.writeFileSync(tmpPath, Buffer.concat(reordered));
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (err) {
    console.warn('FastStart skip:', err?.message || err);
    return false;
  }
}
