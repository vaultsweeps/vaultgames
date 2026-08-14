import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const providers = await prisma.provider.findMany();
    console.log("Providers found:", providers.map(p => ({ id: p.id, name: p.name, agentId: p.agentId })));

    let target = providers.find(p => p.name.toLowerCase().includes('panda') || p.agentId === '***REDACTED***');
    
    if (!target) {
        console.log("UltraPanda provider not found.");
        return;
    }

    console.log("Updating Provider:", target.name);

    await prisma.provider.update({
        where: { id: target.id },
        data: {
            agentId: '***REDACTED***',
            secretKey: 'AbcD1122',
            endpoints: {
                "appid": "zf0I9bbeOt2mt5z107",
                "appsecret": "P85FLdFf_grvaUhvcmf5kozud39",
                "agentLogin": "/agent/login",
                "agentBalance": "/agent/login",
                "createPlayer": "/user/create",
                "recharge": "/user/deposit",
                "withdraw": "/user/withdrawal",
                "playerBalance": "/user/balance",
                "resetPassword": "/user/updatePasswd"
            }
        }
    });

    console.log("Successfully updated the provider configuration!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
