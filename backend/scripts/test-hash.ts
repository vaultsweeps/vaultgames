import crypto from 'crypto';

const agentId = '122030';
const timestamp = Math.floor(Date.now() / 1000).toString();
const secretKey = 'c6c49138efde354eb81a599f7e68b744';

const strToHash = `${agentId}:${timestamp}:${secretKey}`;
const token = crypto.createHash('md5').update(strToHash).digest('hex').toLowerCase();

console.log('Agent ID:', agentId);
console.log('Timestamp:', timestamp);
console.log('String to hash:', strToHash);
console.log('Token:', token);
