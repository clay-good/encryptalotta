#!/usr/bin/env node
// Verify the minisign signature on the release manifest (SPEC-INTERNATIONAL.md §4.2).
//
//   node scripts/verify-release-signature.js [file] [signature] [public-key]
//   (defaults: RELEASES.md  RELEASES.md.minisig  minisign.pub)
//
// Pure Node built-ins — no minisign binary needed, so audit-release.js can run
// it in CI. Readers can cross-check with the reference tool:
//   minisign -Vm RELEASES.md -p minisign.pub
//
// minisign format (https://jedisct1.github.io/minisign/):
//   public key  = base64( "Ed" ‖ key_id[8] ‖ ed25519_pk[32] )
//   signature   = base64( "ED" ‖ key_id[8] ‖ sig[64] )   sig = Ed25519(BLAKE2b-512(file))
//                 ("Ed" = legacy, sig over the raw file)
//   trusted comment line, then
//   global sig  = base64( Ed25519(sig[64] ‖ trusted_comment) )
// Both signatures must verify; the trusted comment is therefore authenticated.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function b64Line(text, index) {
    const lines = String(text).split(/\r?\n/);
    return lines[index] !== undefined ? Buffer.from(lines[index].trim(), 'base64') : Buffer.alloc(0);
}

function keyIdHex(id) {
    // minisign prints the 8-byte key id as a little-endian u64.
    return Buffer.from(id).reverse().toString('hex').toUpperCase();
}

function verifyMinisign(fileBuf, sigText, pubText) {
    const pub = b64Line(pubText, 1);
    if (pub.length !== 42 || pub.toString('latin1', 0, 2) !== 'Ed') return { ok: false, error: 'malformed public key' };
    const lines = String(sigText).split(/\r?\n/);
    const sig = b64Line(sigText, 1);
    if (sig.length !== 74) return { ok: false, error: 'malformed signature' };
    const alg = sig.toString('latin1', 0, 2);
    if (alg !== 'ED' && alg !== 'Ed') return { ok: false, error: 'unsupported signature algorithm ' + JSON.stringify(alg) };
    const keyId = keyIdHex(pub.subarray(2, 10));
    if (!sig.subarray(2, 10).equals(pub.subarray(2, 10))) {
        return { ok: false, error: `signed by key ${keyIdHex(sig.subarray(2, 10))}, expected ${keyId}` };
    }
    const tcLine = lines[2] || '';
    const TC = 'trusted comment: ';
    if (!tcLine.startsWith(TC)) return { ok: false, error: 'missing trusted comment' };
    const trustedComment = tcLine.slice(TC.length);
    const globalSig = b64Line(sigText, 3);
    if (globalSig.length !== 64) return { ok: false, error: 'malformed global signature' };

    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, pub.subarray(10)]), format: 'der', type: 'spki' });
    const signed = alg === 'ED' ? crypto.createHash('blake2b512').update(fileBuf).digest() : fileBuf;
    if (!crypto.verify(null, signed, key, sig.subarray(10))) return { ok: false, keyId, error: 'file signature does not verify' };
    const globalData = Buffer.concat([sig.subarray(10), Buffer.from(trustedComment, 'utf8')]);
    if (!crypto.verify(null, globalData, key, globalSig)) return { ok: false, keyId, error: 'trusted-comment signature does not verify' };
    return { ok: true, keyId, trustedComment, prehashed: alg === 'ED' };
}

module.exports = { verifyMinisign };

if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    const [file = 'RELEASES.md', sigFile = file + '.minisig', pubFile = 'minisign.pub'] = process.argv.slice(2);
    const abs = p => path.resolve(root, p);
    let r;
    try {
        r = verifyMinisign(fs.readFileSync(abs(file)), fs.readFileSync(abs(sigFile), 'utf8'), fs.readFileSync(abs(pubFile), 'utf8'));
    } catch (e) {
        r = { ok: false, error: e.message };
    }
    if (r.ok) {
        console.log(`OK  ${file} — signature verified (key ${r.keyId})`);
        console.log(`    trusted comment: ${r.trustedComment}`);
    } else {
        console.error(`FAIL ${file} — ${r.error}`);
        process.exit(1);
    }
}
