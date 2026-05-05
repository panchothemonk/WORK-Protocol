/**
 * WORK Protocol v4 — Core Identity
 *
 * Worker and buyer identity creation + Ed25519 key-possession
 * challenge-response proofs.  No database dependency — pure
 * cryptographic operations suitable for client-side and server-side.
 */
import {
  generateKeypair,
  randomHex,
  bytesToHex,
  hexToBytes,
  getPublicKey,
  sign,
  verify,
} from './crypto.mjs';

// ---- Helpers --------------------------------------------------------------

function shortId() {
  // 16 random bytes → 32 hex chars
  return randomHex(16);
}

// ---- Worker identity ------------------------------------------------------

/**
 * @typedef {object} WorkerIdentity
 * @property {string}   workerId          "wrk_" + random hex
 * @property {string}   name              Human-readable name
 * @property {string}   publicKey         Ed25519 public key (hex)
 * @property {string}   privateKey        Ed25519 private key (hex)
 * @property {string}   withdrawalAddress On-chain address for USDC payout
 * @property {object}   guardrails        Worker-defined constraints
 */

/**
 * Create a new worker identity with a fresh Ed25519 keypair.
 *
 * @param {object}   opts
 * @param {string}   opts.name
 * @param {string}   opts.withdrawalAddress
 * @param {object}   [opts.guardrails]    Default: {}
 * @returns {WorkerIdentity}
 */
export function createWorkerIdentity({ name, withdrawalAddress, guardrails = {} }) {
  const { publicKey, privateKey } = generateKeypair();

  return {
    workerId: `wrk_${shortId()}`,
    name,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
    withdrawalAddress,
    guardrails,
  };
}

// ---- Buyer identity -------------------------------------------------------

/**
 * @typedef {object} BuyerIdentity
 * @property {string} buyerId    "buy_" + random hex
 * @property {string} address    On-chain address
 * @property {string} publicKey  Ed25519 public key (hex)
 * @property {string} privateKey Ed25519 private key (hex) — internal
 */

/**
 * Create a new buyer identity with a fresh Ed25519 keypair.
 *
 * @param {object}   opts
 * @param {string}   opts.address  On-chain address
 * @returns {BuyerIdentity}
 */
export function createBuyerIdentity({ address }) {
  const { publicKey, privateKey } = generateKeypair();

  return {
    buyerId: `buy_${shortId()}`,
    address,
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(privateKey),
  };
}

// ---- Key possession challenge-response ------------------------------------

/**
 * Generate a random challenge for key-possession proof.
 *
 * @returns {{ challenge: string }}
 */
export function keyPossessionChallenge() {
  return { challenge: randomHex(32) };
}

/**
 * Sign a challenge with the worker's/buyer's Ed25519 private key.
 *
 * @param {object}   opts
 * @param {string}   opts.challenge       Hex-encoded challenge
 * @param {string}   opts.privateKeyHex   Ed25519 private key (hex)
 * @returns {{ signature: string }}
 */
export function keyPossessionProof({ challenge, privateKeyHex }) {
  const sig = sign(hexToBytes(challenge), hexToBytes(privateKeyHex));
  return { signature: bytesToHex(sig) };
}

/**
 * Verify a key-possession proof.
 *
 * @param {object}   opts
 * @param {string}   opts.challenge       Hex-encoded challenge
 * @param {string}   opts.signature       Hex-encoded signature
 * @param {string}   opts.publicKeyHex    Ed25519 public key (hex)
 * @returns {boolean}
 */
export function verifyKeyPossession({ challenge, signature, publicKeyHex }) {
  return verify(
    hexToBytes(signature),
    hexToBytes(challenge),
    hexToBytes(publicKeyHex),
  );
}
