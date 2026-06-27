const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '01234567890123456789012345678901';

exports.encrypt = (text) => {
  if (!text) return null;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
};

exports.decrypt = (cipher) => {
  if (!cipher) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Decryption error:', e);
    return null;
  }
};