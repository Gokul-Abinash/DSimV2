const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

// Generate and save a key pair for a node
function generateKeyPair(nodeID) {
  const keypair = forge.pki.rsa.generateKeyPair(2048);
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);

  fs.writeFileSync(path.join(__dirname, `${nodeID}_private.pem`), privateKeyPem);
  fs.writeFileSync(path.join(__dirname, `${nodeID}_public.pem`), publicKeyPem);
}

// Load a node's private key from PEM file
function loadPrivateKey(nodeID) {
  const pem = fs.readFileSync(path.join(__dirname, `${nodeID}_private.pem`), 'utf8');
  return forge.pki.privateKeyFromPem(pem);
}

// Load a node's public key from PEM file
function loadPublicKey(nodeID) {
  const pem = fs.readFileSync(path.join(__dirname, `${nodeID}_public.pem`), 'utf8');
  return forge.pki.publicKeyFromPem(pem);
}

// Sign a message (string) with a private key
function signMessage(privateKey, message) {
  const md = forge.md.sha256.create();
  md.update(message, 'utf8');
  return forge.util.encode64(privateKey.sign(md));
}

// Verify a signature for a message (string) with a public key
function verifySignature(publicKey, message, signature) {
  const md = forge.md.sha256.create();
  md.update(message, 'utf8');
  return publicKey.verify(md.digest().bytes(), forge.util.decode64(signature));
}

module.exports = {
  generateKeyPair,
  loadPrivateKey,
  loadPublicKey,
  signMessage,
  verifySignature,
};