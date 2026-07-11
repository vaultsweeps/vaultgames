import axios from 'axios';
import crypto from 'crypto';

function sign(params: any, secret: string) {
    const sortedKeys = Object.keys(params).sort();
    const strArr: string[] = [];
    for (const key of sortedKeys) {
        strArr.push(`${key}=${params[key]}`);
    }
    const str = strArr.join('&') + secret;
    return crypto.createHash('md5').update(str).digest('hex');
}

async function testLogin(secret: string) {
    console.log('Testing with secret:', secret);
    const params: any = {
        requestid: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now().toString(),
        account: 'Gamora12345',
        passwd: 'Texas123'
    };
    params.sign = sign(params, secret);
    
    try {
        const res = await axios.post('https://gm.vblink777.club/fast/agent/login', new URLSearchParams(params).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        console.log('Response:', res.data);
    } catch (e: any) {
        console.log('Error:', e.message);
    }
}

async function run() {
    await testLogin('');
    await testLogin('Texas123');
    await testLogin('Gamora12345');
    await testLogin('default');
}

run();
