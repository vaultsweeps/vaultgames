const fs = require('fs');
const path = require('path');

const dir = 'frontend/src';

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk(dir, function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('width={160} height={40}')) {
      let updated = content.replace(/width=\{160\}\s+height=\{40\}/g, 'width={551} height={488}');
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log('Updated: ' + filePath);
    }
  }
});
