import axios from 'axios';
import crypto from 'crypto';

const appid = "z85FTZJVXBztimxd39";
const appsecret = "OafJBPedqDu1bamzcZp1nl3Bcf6";
const account = "VegasV01";

function sign(params: any, secret: string) {
    const sortedKeys = Object.keys(params).sort();
    const strArr: string[] = [];
    for (const key of sortedKeys) {
        strArr.push(`${key}=${params[key]}`);
    }
    const str = strArr.join('&') + secret;
    return crypto.createHash('md5').update(str).digest('hex');
}

async function testEndpoint(baseUrl: string) {
    const params: any = {
        requestid: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now().toString(),
        account: account,
        passwd: "SomePassword123",
        appid: appid
    };
    params.sign = sign(params, appsecret);
    
    const url = `${baseUrl}/fast/agent/login`;
    console.log(`Testing ${url}...`);
    try {
        const res = await axios.post(url, new URLSearchParams(params).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 5000
        });
        console.log(`Success on ${baseUrl}: Code ${res.data.code}`);
    } catch (e: any) {
        if (e.response) {
             console.log(`Error on ${baseUrl}: ${e.response.status}`);
        } else {
             console.log(`Error on ${baseUrl}: ${e.message}`);
        }
    }
}

async function run() {
    const domains = [
        "https://gm.vblink777.club",
        "https://api.vblink777.club",
        "http://api.vblink777.club",
        "https://vblink777.club",
        "http://vblink777.club",
        "https://api.vblink.com"
    ];
    for (const d of domains) {
        await testEndpoint(d);
    }
}
run();
