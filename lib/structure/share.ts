import { gzipSync, gunzipSync, strFromU8, strToU8 } from "fflate";
import type { SharePayloadV1 } from "./types";

export const MAX_SHARE_URL_LENGTH = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let idx = 0; idx < bytes.length; idx += chunk) {
      binary += String.fromCharCode(...bytes.subarray(idx, idx + chunk));
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}

export function encodePayload(payload: SharePayloadV1): string {
  // fflate's browser inflater can reject some level-9 streams emitted by the
  // Node runtime ("invalid distance") even though standard gzip tools accept
  // them.  The CLI therefore uses stored gzip blocks for cross-runtime links;
  // links copied inside the browser keep the compact level-9 representation.
  const compressionLevel = typeof window === "undefined" ? 0 : 9;
  const compressed = gzipSync(strToU8(JSON.stringify(payload)), { level: compressionLevel });
  return bytesToBase64(compressed)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodePayload(encoded: string): SharePayloadV1 {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const parsed = JSON.parse(strFromU8(gunzipSync(base64ToBytes(padded)))) as SharePayloadV1;
    validatePayload(parsed);
    return parsed;
  } catch (error) {
    throw new Error(`分享链接损坏或版本不受支持：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function validatePayload(payload: SharePayloadV1): void {
  if (!payload || payload.v !== 1) throw new Error("仅支持 SharePayloadV1");
  if (payload.format !== "poscar" && payload.format !== "lammps-data") throw new Error("format 无效");
  const structure = payload.structure;
  if (!structure || structure.cell.length !== 9 || structure.origin.length !== 3 || structure.pbc.length !== 3) {
    throw new Error("结构晶胞字段无效");
  }
  if (!structure.elements.length || structure.positions.length !== structure.elements.length * 3) {
    throw new Error("元素与坐标数量不一致");
  }
  if (![...structure.positions, ...structure.cell, ...structure.origin].every(Number.isFinite)) {
    throw new Error("结构包含 NaN 或无穷数");
  }
}

export function makeShareUrl(payload: SharePayloadV1, baseUrl: string): string {
  const base = baseUrl.split("#")[0];
  const url = `${base}#s=${encodePayload(payload)}`;
  if (url.length > MAX_SHARE_URL_LENGTH) {
    throw new Error(`压缩链接为 ${url.length.toLocaleString()} 字符，超过 100,000 字符的 URL-only 上限`);
  }
  return url;
}

export function payloadFromHash(hash: string): SharePayloadV1 | null {
  if (!hash || hash === "#") return null;
  const encoded = new URLSearchParams(hash.slice(1)).get("s");
  return encoded ? decodePayload(encoded) : null;
}
