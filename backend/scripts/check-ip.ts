import axios from 'axios';

async function checkIP() {
  try {
    const v4 = await axios.get('https://api.ipify.org');
    console.log('Axios IPv4:', v4.data);
  } catch (e) {
    console.log('IPv4 check failed:', e.message);
  }
  
  try {
    const v6 = await axios.get('https://api64.ipify.org');
    console.log('Axios IPv6:', v6.data);
  } catch (e) {
    console.log('IPv6 check failed:', e.message);
  }
}

checkIP();
