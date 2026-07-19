const fs = require('fs');
const files = [
  'src/components/modals/ZappayDepositModal.tsx',
  'src/components/modals/PlayWithAgentModal.tsx',
  'src/components/modals/ManualCashoutModal.tsx',
  'src/components/modals/ChimePayPalDepositModal.tsx',
  'src/components/home/HomePageClient.tsx',
  'src/app/dashboard/support/page.tsx',
  'src/app/dashboard/cashouts/page.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  let changed = false;
  
  if (content.includes("import { getTelegramUrl } from '@/lib/telegram'\n'use client'")) {
    content = content.replace("import { getTelegramUrl } from '@/lib/telegram'\n'use client'", "'use client'\nimport { getTelegramUrl } from '@/lib/telegram'");
    changed = true;
  }
  
  if (content.includes("import { useAuthStore } from '@/store/authStore'\nimport { getTelegramUrl } from '@/lib/telegram'\n'use client'")) {
    content = content.replace("import { useAuthStore } from '@/store/authStore'\nimport { getTelegramUrl } from '@/lib/telegram'\n'use client'", "'use client'\nimport { useAuthStore } from '@/store/authStore'\nimport { getTelegramUrl } from '@/lib/telegram'");
    changed = true;
  }

  // General fix for any file where 'use client' got pushed down
  const useClientRegex = /^(import .*[\s\S]*?)('use client'|"use client")\r?\n/m;
  const match = content.match(useClientRegex);
  if (match) {
    const original = match[0];
    const newStr = match[2] + '\n' + match[1];
    content = content.replace(original, newStr);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(f, content);
  }
});
