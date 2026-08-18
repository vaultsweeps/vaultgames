import axios from 'axios';
import crypto from 'crypto';

const appid = "zf0I9bbeOt2mt5z107";
const appsecret = "P85FLdFf_grvaUhvcmf5kozud39";
const account = "NickU123";

function sign(params: any, secret: string) {
    const sortedKeys = Object.keys(params).sort();
    const strArr: string[] = [];
    for (const key of sortedKeys) {
        strArr.push(`${key}=${params[key]}`);
    }
    const str = strArr.join('&') + secret;
    return crypto.createHash('md5').update(str).digest('hex');
}

async function testLogin(passwd: string, useAppId: boolean) {
    const params: any = {
        requestid: crypto.randomBytes(16).toString('hex'),
        timestamp: Date.now().toString(),
        account: account,
        passwd: passwd
    };
    if (useAppId) {
        params.appid = appid;
    }
    params.sign = sign(params, appsecret);
    
    try {
        const res = await axios.post('https://gm.vblink777.club/fast/agent/login', new URLSearchParams(params).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });
        console.log(`[useAppId=${useAppId}] Passwd ${passwd.substring(0,6)}... -> Code: ${res.data.code}, Msg: ${res.data.message || res.data.msg}`);
    } catch (e: any) {
        console.log(`[useAppId=${useAppId}] Passwd ${passwd.substring(0,6)}... -> Error: ${e.response?.status} ${e.message}`);
    }
}

async function run() {
    await testLogin('AbcD1122', false);
}
run();
