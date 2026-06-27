import hashlib, base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad

def derive(password, salt, klen=32, ilen=16):
    d = b''
    prev = b''
    while len(d) < klen + ilen:
        prev = hashlib.md5(prev + password + salt).digest()
        d += prev
    return d[:klen], d[klen:klen + ilen]

cipher = 'U2FsdGVkX1/4/DsdmF2jlNdz9UvyYRstrbbY8mn7lDA='
enc = base64.b64decode(cipher)
print(enc[:8])
salt = enc[8:16]
for key in [b'01234567890123456789012345678567', b'your_aes_encryption_key_32_chars_min', b'01234567890123456789012345678901']:
    try:
        k, iv = derive(key, salt)
        pt = unpad(AES.new(k, AES.MODE_CBC, iv).decrypt(enc[16:]), AES.block_size)
        print(key, pt)
    except Exception as e:
        print(key, 'failed:', e)
