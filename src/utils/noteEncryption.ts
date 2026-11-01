/**
 * AES-256-GCM Note Encryption using standard hardware-accelerated W3C Web Crypto API.
 * 
 * Features:
 * - PBKDF2 key derivation with 100,000 iterations of SHA-256.
 * - Authenticated AES-GCM 256-bit encryption with fresh 96-bit (12-byte) IV per encryption.
 * - Zero external dependencies, pure standard WebCrypto.
 * - Safe for Markdown files: stored as standard text block header.
 */

const HEADER = "-----BEGIN SHARD ENCRYPTED NOTE-----";
const FOOTER = "-----END SHARD ENCRYPTED NOTE-----";
const PBKDF2_ITERATIONS = 100000;

function bufferToBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isNoteEncrypted(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return trimmed.startsWith(HEADER) && trimmed.includes(FOOTER);
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext note content into an encrypted ASCII envelope.
 */
export async function encryptNote(plainText: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error("Passphrase cannot be empty");

  // 1. Generate 16 bytes random salt and 12 bytes IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Derive 256-bit AES-GCM key
  const key = await deriveKey(passphrase, salt);

  // 3. Encrypt UTF-8 bytes
  const enc = new TextEncoder();
  const plainBytes = enc.encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plainBytes
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const saltB64 = bufferToBase64(salt);
  const ivB64 = bufferToBase64(iv);
  const cipherB64 = bufferToBase64(cipherBytes);

  return [
    HEADER,
    "Version: 1",
    `Salt: ${saltB64}`,
    `IV: ${ivB64}`,
    "",
    cipherB64,
    FOOTER,
  ].join("\n");
}

/**
 * Decrypt an encrypted note ASCII envelope back into plaintext.
 */
export async function decryptNote(encryptedBlock: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error("Passphrase cannot be empty");

  const lines = encryptedBlock.trim().split("\n");
  if (!lines[0].startsWith(HEADER)) {
    throw new Error("Invalid encrypted note header");
  }

  let saltB64 = "";
  let ivB64 = "";
  let bodyStartIndex = 1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("Salt:")) {
      saltB64 = line.substring(5).trim();
    } else if (line.startsWith("IV:")) {
      ivB64 = line.substring(3).trim();
    } else if (line === "") {
      bodyStartIndex = i + 1;
      break;
    }
  }

  if (!saltB64 || !ivB64) {
    throw new Error("Missing cryptographic metadata in note");
  }

  // Gather ciphertext lines until FOOTER
  const cipherLines: string[] = [];
  for (let i = bodyStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === FOOTER) break;
    if (line) cipherLines.push(line);
  }

  const cipherB64 = cipherLines.join("");
  const salt = base64ToBuffer(saltB64);
  const iv = base64ToBuffer(ivB64);
  const cipherBytes = base64ToBuffer(cipherB64);

  // Derive key and decrypt
  const key = await deriveKey(passphrase, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as any },
      key,
      cipherBytes as any
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch {
    throw new Error("Incorrect passphrase or corrupted note data");
  }
}
