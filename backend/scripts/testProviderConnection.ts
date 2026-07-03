import axios from 'axios';

async function testConnection(url: string, providerName: string) {
  try {
    console.log(`Testing connection to ${providerName} (${url})...`);
    // We just do a simple GET request. Even if it returns 404 or 401 Unauthorized, 
    // it means the connection succeeded and the IP Whitelist is working.
    // If it throws ECONNRESET, the IP is still being blocked at the network level.
    await axios.get(url, { timeout: 10000 });
    console.log(`✅ ${providerName}: Connection SUCCESS (IP is whitelisted)`);
  } catch (error: any) {
    if (error.response) {
      // 400s or 500s mean the connection was successful, but the API rejected the route/auth
      console.log(`✅ ${providerName}: Connection SUCCESS (Got HTTP ${error.response.status}, which means IP is whitelisted)`);
    } else {
      console.error(`❌ ${providerName}: CONNECTION FAILED -> ${error.message}`);
    }
  }
}

async function runTests() {
  await testConnection('https://apius.gamevault999.com', 'Gamevault');
  console.log('---');
  await testConnection('https://external.juwa777.com', 'Juwa');
  console.log('---');
  await testConnection('https://orionstars.vip', 'Orionstar');
}

runTests();
