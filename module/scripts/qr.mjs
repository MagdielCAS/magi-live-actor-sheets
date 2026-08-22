// A small QR encoder, with no dependency.
//
// It supports byte mode and error correction level M, versions 1 to 10.
// That holds up to 213 bytes, which is more than a pairing URL needs. A
// module must work at a table with no internet, so it cannot load a
// library from the web.
//
// The steps follow ISO/IEC 18004: encode the data, add Reed-Solomon
// correction, place the bits, then try the eight masks and keep the one
// with the lowest penalty.

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

// For each version 1 to 10 at level M: the correction bytes for each
// block, then the groups of blocks as [count, data bytes for each block].
const EC_LEVEL_M = {
  1: { ecPerBlock: 10, groups: [[1, 16]] },
  2: { ecPerBlock: 16, groups: [[1, 28]] },
  3: { ecPerBlock: 26, groups: [[1, 44]] },
  4: { ecPerBlock: 18, groups: [[2, 32]] },
  5: { ecPerBlock: 24, groups: [[2, 43]] },
  6: { ecPerBlock: 16, groups: [[4, 27]] },
  7: { ecPerBlock: 18, groups: [[4, 31]] },
  8: { ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  9: { ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  10: { ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
};

// The middle of each alignment pattern, for each version.
const ALIGNMENT = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/* ------------------------------------------------------------------ */
/* Arithmetic in GF(256)                                               */
/* ------------------------------------------------------------------ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // The primitive polynomial of QR.
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
})();

function mul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

// generatorPoly returns the polynomial whose roots make a code of the
// given length.
function generatorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function correctionBytes(data, count) {
  const gen = generatorPoly(count);
  const remainder = new Array(count).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < count; i += 1) {
      remainder[i] ^= mul(gen[i + 1], factor);
    }
  }
  return remainder;
}

/* ------------------------------------------------------------------ */
/* Encoding the data                                                   */
/* ------------------------------------------------------------------ */

function chooseVersion(byteCount) {
  for (let version = 1; version <= 10; version += 1) {
    const spec = EC_LEVEL_M[version];
    const dataBytes = spec.groups.reduce((sum, [count, size]) => sum + count * size, 0);
    // The header is the mode (4 bits) plus the length field.
    const headerBits = 4 + (version < 10 ? 8 : 16);
    if (byteCount + Math.ceil(headerBits / 8) <= dataBytes) return version;
  }
  throw new Error("The text is too long for this QR encoder.");
}

function toBitStream(bytes, version) {
  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // Byte mode.
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);

  const spec = EC_LEVEL_M[version];
  const dataBytes = spec.groups.reduce((sum, [count, size]) => sum + count * size, 0);
  const capacity = dataBytes * 8;

  // The terminator is up to four zero bits.
  for (let i = 0; i < 4 && bits.length < capacity; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const result = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j];
    result.push(byte);
  }

  // The two pad bytes repeat until the block is full.
  const PAD = [0xec, 0x11];
  let padIndex = 0;
  while (result.length < dataBytes) {
    result.push(PAD[padIndex % 2]);
    padIndex += 1;
  }
  return result;
}

// interleave mixes the data blocks and then the correction blocks, as the
// standard requires.
function interleave(dataBytes, version) {
  const spec = EC_LEVEL_M[version];
  const dataBlocks = [];
  const ecBlocks = [];

  let offset = 0;
  for (const [count, size] of spec.groups) {
    for (let i = 0; i < count; i += 1) {
      const block = dataBytes.slice(offset, offset + size);
      offset += size;
      dataBlocks.push(block);
      ecBlocks.push(correctionBytes(block, spec.ecPerBlock));
    }
  }

  const out = [];
  const longest = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < longest; i += 1) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Building the picture                                                */
/* ------------------------------------------------------------------ */

function emptyMatrix(size) {
  return {
    size,
    cells: Array.from({ length: size }, () => new Array(size).fill(null)),
    reserved: Array.from({ length: size }, () => new Array(size).fill(false)),
  };
}

function place(matrix, row, col, value, reserve = true) {
  matrix.cells[row][col] = value;
  if (reserve) matrix.reserved[row][col] = true;
}

function addFinder(matrix, row, col) {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || cc < 0 || rr >= matrix.size || cc >= matrix.size) continue;
      // The ring of cells around the 7 by 7 pattern is the separator. It
      // is always light, so the edge test applies only inside the box.
      const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const onEdge = inBox && (r === 0 || r === 6 || c === 0 || c === 6);
      const inCentre = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      place(matrix, rr, cc, onEdge || inCentre ? 1 : 0);
    }
  }
}

function addAlignment(matrix, version) {
  const centres = ALIGNMENT[version];
  for (const row of centres) {
    for (const col of centres) {
      // The three finder corners have no alignment pattern.
      if (matrix.reserved[row][col]) continue;
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          const edge = Math.abs(r) === 2 || Math.abs(c) === 2;
          const centre = r === 0 && c === 0;
          place(matrix, row + r, col + c, edge || centre ? 1 : 0);
        }
      }
    }
  }
}

function addTiming(matrix) {
  for (let i = 8; i < matrix.size - 8; i += 1) {
    const value = i % 2 === 0 ? 1 : 0;
    place(matrix, 6, i, value);
    place(matrix, i, 6, value);
  }
}

// Version 7 and above carry the version number in two blocks of 18 cells,
// near the top right and the bottom left finder. A reader needs them, and
// the mask does not change them.
function addVersionInfo(matrix, version) {
  if (version < 7) return;

  let rest = version << 12;
  for (let i = 5; i >= 0; i -= 1) {
    if (rest & (1 << (i + 12))) rest ^= 0x1f25 << i;
  }
  const bits = (version << 12) | rest;
  const size = matrix.size;

  for (let i = 0; i < 18; i += 1) {
    const bit = (bits >> i) & 1;
    const a = Math.floor(i / 3);
    const b = size - 11 + (i % 3);
    place(matrix, b, a, bit); // The bottom left block.
    place(matrix, a, b, bit); // The top right block.
  }
}

function reserveFormat(matrix) {
  const size = matrix.size;
  for (let i = 0; i < 9; i += 1) {
    if (!matrix.reserved[8][i]) place(matrix, 8, i, 0);
    if (!matrix.reserved[i][8]) place(matrix, i, 8, 0);
  }
  for (let i = 0; i < 8; i += 1) {
    place(matrix, 8, size - 1 - i, 0);
    place(matrix, size - 1 - i, 8, 0);
  }
  // The one cell that is always dark.
  place(matrix, size - 8, 8, 1);
}

function placeData(matrix, bytes) {
  const size = matrix.size;
  const bits = [];
  for (const byte of bytes) {
    for (let i = 7; i >= 0; i -= 1) bits.push((byte >> i) & 1);
  }

  let index = 0;
  let upward = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right -= 1; // The timing column is not part of the path.
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (matrix.reserved[row][col]) continue;
        matrix.cells[row][col] = index < bits.length ? bits[index] : 0;
        index += 1;
      }
    }
    upward = !upward;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(matrix, maskIndex) {
  const size = matrix.size;
  const out = matrix.cells.map((row) => row.slice());
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (matrix.reserved[r][c]) continue;
      if (MASKS[maskIndex](r, c)) out[r][c] ^= 1;
    }
  }
  return out;
}

// The format bits carry the level and the mask, with a BCH code.
function formatBits(maskIndex) {
  const LEVEL_M = 0b00;
  let value = (LEVEL_M << 3) | maskIndex;
  let rest = value << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if (rest & (1 << (i + 10))) rest ^= 0x537 << i;
  }
  return ((value << 10) | rest) ^ 0x5412;
}

function writeFormat(cells, size, maskIndex) {
  const bits = formatBits(maskIndex);
  const bit = (i) => (bits >> i) & 1;

  // The first copy runs down column 8, then left along row 8.
  for (let i = 0; i <= 5; i += 1) cells[i][8] = bit(i);
  cells[7][8] = bit(6);
  cells[8][8] = bit(7);
  cells[8][7] = bit(8);
  for (let i = 9; i <= 14; i += 1) cells[8][14 - i] = bit(i);

  // The second copy runs along row 8 on the right, then down column 8 at
  // the bottom.
  for (let i = 0; i <= 7; i += 1) cells[8][size - 1 - i] = bit(i);
  for (let i = 8; i <= 14; i += 1) cells[size - 15 + i][8] = bit(i);

  cells[size - 8][8] = 1;
}

function penalty(cells, size) {
  let score = 0;

  // Rule 1: a run of five or more equal cells in a line.
  for (let i = 0; i < size; i += 1) {
    for (const line of [cells[i], cells.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        if (line[j] === line[j - 1]) {
          run += 1;
          if (run === 5) score += 3;
          else if (run > 5) score += 1;
        } else {
          run = 1;
        }
      }
    }
  }

  // Rule 2: a square of four equal cells.
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = cells[r][c];
      if (v === cells[r][c + 1] && v === cells[r + 1][c] && v === cells[r + 1][c + 1]) {
        score += 3;
      }
    }
  }

  // Rule 3: a pattern that looks like a finder.
  const A = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const B = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matches = (line, start, pattern) => pattern.every((p, k) => line[start + k] === p);
  for (let i = 0; i < size; i += 1) {
    const row = cells[i];
    const col = cells.map((r) => r[i]);
    for (const line of [row, col]) {
      for (let j = 0; j + 11 <= size; j += 1) {
        if (matches(line, j, A) || matches(line, j, B)) score += 40;
      }
    }
  }

  // Rule 4: the balance between dark and light.
  let dark = 0;
  for (const row of cells) for (const v of row) dark += v;
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/* ------------------------------------------------------------------ */
/* The public part                                                     */
/* ------------------------------------------------------------------ */

// encode returns the QR as an array of rows of 0 and 1.
export function encode(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)));
  const version = chooseVersion(bytes.length);
  const size = 17 + version * 4;

  const matrix = emptyMatrix(size);
  addFinder(matrix, 0, 0);
  addFinder(matrix, 0, size - 7);
  addFinder(matrix, size - 7, 0);
  addAlignment(matrix, version);
  addTiming(matrix);
  addVersionInfo(matrix, version);
  reserveFormat(matrix);
  placeData(matrix, interleave(toBitStream(bytes, version), version));

  let best = null;
  for (let maskIndex = 0; maskIndex < 8; maskIndex += 1) {
    const cells = applyMask(matrix, maskIndex);
    writeFormat(cells, size, maskIndex);
    const score = penalty(cells, size);
    if (!best || score < best.score) best = { score, cells };
  }
  return best.cells;
}

// toSvg draws the QR as an SVG picture. The quiet border of four cells is
// part of the standard, and a reader needs it.
export function toSvg(text, pixelSize = 256) {
  const cells = encode(text);
  const quiet = 4;
  const size = cells.length + quiet * 2;

  let path = "";
  for (let r = 0; r < cells.length; r += 1) {
    for (let c = 0; c < cells.length; c += 1) {
      if (cells[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}"`,
    ` viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img">`,
    `<rect width="${size}" height="${size}" fill="#ffffff"/>`,
    `<path d="${path}" fill="#000000"/>`,
    `</svg>`,
  ].join("");
}
