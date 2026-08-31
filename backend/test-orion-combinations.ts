import axios from 'axios';
import crypto from 'crypto';
import prisma from './src/lib/prisma';

function md5(input: string): string {
  return crypto.createHash('md5').update(input).digest('hex');
}

function nowSeconds(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function nowMs(): string {
  return Date.now().toString();
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('Fetching active Orionstar provider from database...');
  const provider = await prisma.provider.findFirst({
    where: { 
      status: true,
      OR: [{ name: { contains: 'orionstar', mode: 'insensitive' } }, { name: { contains: 'orion star', mode: 'insensitive' } }]
    }
  });

  if (!provider) {
    console.error('❌ Active Orionstar provider not found in database.');
    return;
  }

  const agentName = provider.agentId.trim();
  const secretKey = provider.secretKey.trim();
  const apiBaseUrl = provider.apiBaseUrl.trim().replace(/\/+$/, '');
  const servicePath = '/ws/service.ashx';

  console.log(`✅ Found Provider: ${provider.name} | Agent: ${agentName} | API: ${apiBaseUrl}`);
  
  const http = axios.create({ baseURL: apiBaseUrl, headers: { 'Content-Length': '0' } });

  // 1. Login to get agentKey
  let agentKey = '';
  try {
    const tLogin = nowSeconds();
    console.log(`\n▶ Logging in... (time=${tLogin})`);
    
    // Login strictly requires query string
    const res = await http.post(servicePath, null, {
      params: { action: 'agentLogin', agentName, agentPasswd: md5(secretKey), time: tLogin }
    });

    const d = res.data;
    console.log(`  Login Response: ${JSON.stringify(d)}`);
    
    agentKey = (d.agentkey ?? d.agentKey ?? d.AgentKey ?? d.AGENTKEY ?? '').toString().trim();
    if (!agentKey) throw new Error('No agentKey in response');
    
    console.log(`✅ Login Success! Key = ${agentKey}`);
  } catch (err: any) {
    console.error(`❌ Login failed: ${err.message}`);
    if (err.response) console.error(err.response.data);
    return;
  }

  await sleep(2000);

  // Helper for testing combinations
  async function testCombination(name: string, payload: any, usePostBody: boolean, useMs: boolean, signAtEnd: boolean) {
    const time = useMs ? nowMs() : nowSeconds();
    const signInput = agentName.toLowerCase() + time + agentKey.toLowerCase();
    const sign = md5(signInput);

    console.log(`\n▶ TEST: ${name}`);
    console.log(`  time format: ${useMs ? 'Milliseconds' : 'Seconds'} | signInput: ${signInput}`);

    try {
      if (usePostBody) {
        // POST Body Form-Urlencoded
        const formData = new URLSearchParams({
          agentName, ...payload, time, sign
        });
        const url = `${servicePath}?action=registerUser`;
        const res = await http.post(url, formData.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log(`  Response: ${JSON.stringify(res.data)}`);
      } else {
        // Query String
        let url = `${servicePath}?action=registerUser`;
        
        if (signAtEnd) {
          const searchParams = new URLSearchParams();
          searchParams.append('agentName', agentName);
          for (const [k, v] of Object.entries(payload)) searchParams.append(k, String(v));
          searchParams.append('time', time);
          searchParams.append('sign', sign);
          url += `&${searchParams.toString()}`;
        } else {
          const params = { agentName, time, sign, ...payload };
          const searchParams = new URLSearchParams(params as any);
          url += `&${searchParams.toString()}`;
        }

        const res = await http.post(url, null);
        console.log(`  Response: ${JSON.stringify(res.data)}`);
      }
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      if (err.response) console.error(err.response.data);
    }
    
    await sleep(2000);
  }

  const testAccount = 'test' + Math.floor(Math.random() * 100000);
  const payload = { account: testAccount, passwd: md5('Test@1234') };

  // Run various combinations
  await testCombination('1. Query String (Original Format, seconds)', payload, false, false, false);
  await testCombination('2. Query String (Time/Sign at end, seconds)', payload, false, false, true);
  await testCombination('3. Query String (Milliseconds)', payload, false, true, false);
  await testCombination('4. POST Form-UrlEncoded (Seconds)', payload, true, false, false);
  await testCombination('5. POST Form-UrlEncoded (Milliseconds)', payload, true, true, false);

  console.log('\n✅ Tests complete.');
}

runTests().catch(console.error).finally(() => prisma.$disconnect());
