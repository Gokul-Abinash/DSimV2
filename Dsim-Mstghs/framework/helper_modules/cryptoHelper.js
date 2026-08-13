const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// In-memory key caching to eliminate disk I/O overhead
const privateKeyCache = {};
const publicKeyCache = {};

// Load a node's private key from PEM file
function loadPrivateKey(nodeID) {
  if (privateKeyCache[nodeID]) return privateKeyCache[nodeID];
  const pem = fs.readFileSync(path.join(__dirname, `${nodeID}_private.pem`), 'utf8');
  privateKeyCache[nodeID] = pem;
  return pem;
}

// Load a node's public key from PEM file
function loadPublicKey(nodeID) {
  if (publicKeyCache[nodeID]) return publicKeyCache[nodeID];
  const pem = fs.readFileSync(path.join(__dirname, `${nodeID}_public.pem`), 'utf8');
  publicKeyCache[nodeID] = pem;
  return pem;
}

// High-speed native OpenSSL sign (< 0.05ms)
function signMessage(privateKey, message) {
  try {
    const signer = crypto.createSign('SHA256');
    signer.update(message, 'utf8');
    return signer.sign(privateKey, 'base64');
  } catch (e) {
    return '';
  }
}

// High-speed native OpenSSL verify (< 0.05ms)
function verifySignature(publicKey, message, signature) {
  try {
    if (!signature || !publicKey) return false;
    const verifier = crypto.createVerify('SHA256');
    verifier.update(message, 'utf8');
    return verifier.verify(publicKey, signature, 'base64');
  } catch (e) {
    return false;
  }
}

module.exports = {
  loadPrivateKey,
  loadPublicKey,
  signMessage,
  verifySignature,
};