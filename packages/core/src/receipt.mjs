/**
 * WORK Protocol v4 — Receipt Engine
 * sign(), verify(), freeze(), anchor() for cryptographic receipts.
 */
import { canonicalize, hexToBytes, bytesToHex } from './crypto.mjs';
import * as ed from '@noble/ed25519';

/**
 * Sign a receipt with an Ed25519 private key.
 * Computes canonical hash of receipt (excluding hash + signature fields),
 * signs it, and attaches the hash + signature to the receipt object.
 * Freezes the receipt after signing (sets _frozen = true).
 *
 * @param {object} receipt - the receipt object to sign (mutated in place)
 * @param {string} privateKeyHex - hex-encoded Ed25519 private key
 * @returns {object} the same receipt object, now signed and frozen
 * @throws {Error} if receipt is already frozen
 */
export function sign(receipt, privateKeyHex) {
  if (receipt._frozen === true) {
    throw new Error('Cannot sign: receipt is frozen');
  }

  // Derive public key for signingKeyId
  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = ed.getPublicKey(privateKey);
  const signingKeyId = bytesToHex(publicKey);

  // Compute canonical hash excluding hash + signature + _frozen fields
  const cleanReceipt = {};
  for (const key of Object.keys(receipt).sort()) {
    if (key !== 'receiptHash' && key !== 'signature' && key !== '_frozen') {
      cleanReceipt[key] = receipt[key];
    }
  }
  const hash = canonicalize(cleanReceipt);

  // Sign the hash bytes
  const hashBytes = hexToBytes(hash);
  const signatureBytes = ed.sign(hashBytes, privateKey);

  // Attach hash + signature
  receipt.receiptHash = hash;
  receipt.signature = {
    algorithm: 'ed25519',
    signingKeyId,
    signatureBase64: Buffer.from(signatureBytes).toString('base64'),
  };
  receipt._frozen = true;

  return receipt;
}

/**
 * Verify a signed receipt against a public key.
 * Strips hash + signature fields, re-canonicalizes, re-hashes, and checks:
 *   1. The receiptHash matches the recomputed canonical hash
 *   2. The Ed25519 signature is valid for the hash + public key
 *
 * @param {object} receipt - the signed receipt object
 * @param {string} publicKeyHex - hex-encoded Ed25519 public key
 * @returns {{ valid: boolean, reason?: string }}
 */
export function verify(receipt, publicKeyHex) {
  // Strip hash + signature + _frozen fields
  const cleanReceipt = {};
  for (const key of Object.keys(receipt).sort()) {
    if (key !== 'receiptHash' && key !== 'signature' && key !== '_frozen') {
      cleanReceipt[key] = receipt[key];
    }
  }

  const recomputedHash = canonicalize(cleanReceipt);

  // Check hash match
  if (receipt.receiptHash !== recomputedHash) {
    return { valid: false, reason: 'hash_mismatch' };
  }

  // Verify Ed25519 signature
  try {
    const publicKey = hexToBytes(publicKeyHex);
    const sigBytes = Buffer.from(receipt.signature.signatureBase64, 'base64');
    const hashBytes = hexToBytes(receipt.receiptHash);
    const isValid = ed.verify(sigBytes, hashBytes, publicKey);
    if (!isValid) {
      return { valid: false, reason: 'signature_invalid' };
    }
  } catch {
    return { valid: false, reason: 'signature_invalid' };
  }

  return { valid: true };
}

/**
 * Freeze a receipt, preventing further modifications.
 * Sets the _frozen flag on the receipt object.
 *
 * @param {object} receipt - the receipt to freeze (mutated in place)
 * @returns {object} the same receipt object
 */
export function freeze(receipt) {
  receipt._frozen = true;
  return receipt;
}

/**
 * Anchor a receipt hash on Base (placeholder for Phase 3).
 * Currently logs a message; actual on-chain anchoring will be implemented later.
 *
 * @param {string} receiptHash - hex-encoded receipt hash
 */
export function anchor(receiptHash) {
  console.log(`would anchor on Base: ${receiptHash}`);
}
