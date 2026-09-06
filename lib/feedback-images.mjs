import { inflateSync } from "node:zlib";
// Accept only non-interlaced PNG screenshots. Discard ancillary metadata and
// validate the decompressed size before a submitted image can reach an admin.
export function cleanFeedbackPng(value) {
  const fail = () => {
    throw new Error(
      "Choose a valid PNG screenshot under 5 MB and 4096 × 4096 pixels.",
    );
  };
  if (
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value) ||
    value.length > 7_000_000
  )
    fail();
  const bytes = Buffer.from(value.split(",")[1], "base64"),
    signature = Buffer.from("89504e470d0a1a0a", "hex");
  if (bytes.length > 5 * 1024 * 1024 || !bytes.subarray(0, 8).equals(signature))
    fail();
  const output = [signature],
    compressed = [];
  let offset = 8,
    width = 0,
    height = 0,
    channels = 0,
    ended = false,
    hasPalette = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) fail();
    const length = bytes.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > bytes.length) fail();
    const kind = bytes.toString("ascii", offset + 4, offset + 8),
      data = bytes.subarray(offset + 8, end - 4);
    if (
      crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)
    )
      fail();
    if (offset === 8 && kind !== "IHDR") fail();
    if (kind === "IHDR") {
      if (width || length !== 13) fail();
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[data[9]];
      if (
        !width ||
        !height ||
        width > 4096 ||
        height > 4096 ||
        !channels ||
        data[8] !== 8 ||
        data[10] !== 0 ||
        data[11] !== 0 ||
        data[12] !== 0
      )
        fail();
    } else if (kind === "IDAT") compressed.push(data);
    else if (kind === "PLTE") {
      if (!length || length % 3 || length > 768) fail();
      hasPalette = true;
    } else if (kind === "IEND") {
      if (length) fail();
      ended = true;
    } else if (
      !["tRNS", "sRGB", "gAMA"].includes(kind) &&
      kind[0] === kind[0].toUpperCase()
    )
      fail();
    if (["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(kind))
      output.push(bytes.subarray(offset, end));
    offset = end;
    if (ended) break;
  }
  if (!ended || offset !== bytes.length || !compressed.length) fail();
  const raw = inflateSync(Buffer.concat(compressed), {
    maxOutputLength: height * (width * channels + 1),
  });
  if (raw.length !== height * (width * channels + 1)) fail();
  for (let y = 0; y < height; y++)
    if (raw[y * (width * channels + 1)] > 4) fail();
  if (bytes[25] === 3 && !hasPalette) fail();
  return `data:image/png;base64,${Buffer.concat(output).toString("base64")}`;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
