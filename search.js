const fs = require('fs');
const content = fs.readFileSync('doc_out.txt', 'utf16le');
const idx = content.indexOf('playerList');
console.log(content.substring(idx, idx + 1000));
