const fs = require('fs')
const path = require('path')

const replacements = [
  // Backgrounds
  [/bg-\[#0F1219\]/g, 'bg-background'],
  [/bg-\[#0f1219\]/g, 'bg-background'],
  [/bg-dark-900/g, 'bg-background'],
  [/bg-\[#1A1E29\]/g, 'bg-surface'],
  [/bg-\[#1a1e29\]/g, 'bg-surface'],
  [/bg-dark-800/g, 'bg-surface'],
  [/bg-\[#13161F\]/g, 'bg-surface-elevated'],
  [/bg-\[#13161f\]/g, 'bg-surface-elevated'],
  [/bg-dark-700/g, 'bg-surface-elevated'],
  [/bg-\[#252A36\]/g, 'bg-surface-elevated'],
  [/bg-\[#252a36\]/g, 'bg-surface-elevated'],
  [/bg-\[#2F3543\]/g, 'bg-surface-elevated'],
  [/bg-\[#2f3543\]/g, 'bg-surface-elevated'],
  // Borders
  [/border-white\/5\b/g, 'border-border-subtle'],
  [/border-white\/10\b/g, 'border-border-strong'],
]

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const fullPath = path.join(dir, f)
    if (fs.statSync(fullPath).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next') walkDir(fullPath, callback)
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      callback(fullPath)
    }
  })
}

let totalFiles = 0
let changedFiles = 0

walkDir(path.join(__dirname, '../src'), (filePath) => {
  totalFiles++
  let content = fs.readFileSync(filePath, 'utf8')
  let original = content
  for (const [from, to] of replacements) {
    content = content.replace(from, to)
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8')
    changedFiles++
    console.log(`Updated: ${path.relative(path.join(__dirname, '..'), filePath)}`)
  }
})

console.log(`\nDone! Changed ${changedFiles} of ${totalFiles} files.`)
