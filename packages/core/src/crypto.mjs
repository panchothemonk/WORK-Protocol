/**
 * WORK Protocol v4 — Core Crypto
 * Ed25519 keygen via @noble/ed25519, SHA-256 via node:crypto,
 * deterministic canonicalization for receipt hashing.
 */
import * as ed from '@noble/ed25519';
import crypto from 'node:crypto';

/**
 * Generate a fresh Ed25519 keypair.
 * @returns {{ publicKey: string, privateKey: string }} hex-encoded keys
 */
export function generateKeyPair() {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return {
    publicKey: ed.utils.bytesToHex(publicKey),
    privateKey: ed.utils.bytesToHex(privateKey),
  };
}

/**
 * Compute SHA-256 hash of data (string, Uint8Array, or object).
 * Objects are JSON.stringify'd before hashing.
 * @param {string|Uint8Array|object} data
 * @returns {string} hex-encoded hash
 */
export function sha256(data) {
  const hash = crypto.createHash('sha256');
  if (typeof data === 'string') {
    hash.update(data, 'utf8');
  } else if (data instanceof Uint8Array) {
    hash.update(data);
  } else {
    hash.update(JSON.stringify(data), 'utf8');
  }
  return hash.digest('hex');
}

/**
 * Deterministic canonical hash of an object.
 * Sorts keys alphabetically, JSON.stringify with no whitespace, then SHA-256.
 * @param {object} obj
 * @returns {string} hex-encoded canonical hash
 */
export function canonicalize(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sorted = {};
  for (const key of sortedKeys) {
    sorted[key] = obj[key];
  }
  const json = JSON.stringify(sorted);
  return sha256(json);
}

/**
 * Verify an Ed25519 signature.
 * @param {string} publicKeyHex - hex-encoded Ed25519 public key
 * @param {string|Uint8Array} message - the message that was signed
 * @param {string} signatureHex - hex-encoded Ed25519 signature
 * @returns {boolean}
 */
export function verifySignature(publicKeyHex, message, signatureHex) {
  try {
    const publicKey = ed.utils.hexToBytes(publicKeyHex);
    const signature = ed.utils.hexToBytes(signatureHex);
    let messageBytes;
    if (typeof message === 'string') {
      messageBytes = new TextEncoder().encode(message);
    } else if (message instanceof Uint8Array) {
      messageBytes = message;
    } else {
      messageBytes = new TextEncoder().encode(JSON.stringify(message));
    }
    return ed.verify(signature, messageBytes, publicKey);
  } catch {
    return false;
  }
}
