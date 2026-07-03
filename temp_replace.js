const fs = require('fs');
const files = [
  './frontend/src/app/login/page.tsx',
  './frontend/src/app/register/page.tsx',
  './frontend/src/components/layout/Footer.tsx',
  './frontend/src/app/dashboard/layout.tsx',
  './frontend/src/app/admin/layout.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the Zap logo blocks with the gradient box
  content = content.replace(
    /<div className="w-\d+ h-\d+ bg-gradient-to-br[^>]+>\s*<Zap className="[^"]+"\s*\/>\s*<\/div>/g,
    '<img src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" className="h-10 w-auto object-contain drop-shadow-md" />'
  );
  
  // Replace standalone Zap icons next to the Vault Sweeps text
  content = content.replace(
    /<Zap className="[^"]+"\s*\/>(\s*<span[^>]+>VAULT SWEEPS<\/span>)/g,
    '<img src="/images/vault-sweeps-logo.png" alt="Vault Sweeps" className="h-8 w-auto object-contain drop-shadow-md mr-2" />$1'
  );
  
  fs.writeFileSync(file, content);
}

console.log('Logos replaced!');
