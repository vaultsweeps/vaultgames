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
  
  if (!content.includes('getTelegramUrl')) {
    // If it's not even used, skip
  } else {
    if (!content.includes("import { getTelegramUrl } from '@/lib/telegram'")) {
      content = "import { getTelegramUrl } from '@/lib/telegram'\n" + content;
      changed = true;
    }
    if (!content.includes("import { useAuthStore }")) {
      content = "import { useAuthStore } from '@/store/authStore'\n" + content;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(f, content);
  }
});
