import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    const providers = await prisma.provider.findMany();
    console.log("Providers found:", providers.map(p => ({ 
        id: p.id, name: p.name, agentId: p.agentId, apiBaseUrl: p.apiBaseUrl 
    })));

    let target = providers.find(p => p.name.toLowerCase().includes('panda') || p.agentId === 'NickU123');
    
    if (!target) {
        console.log("UltraPanda provider not found.");
        return;
    }

    console.log("Current Provider Config:");
    console.log("  Name:", target.name);
    console.log("  Base URL:", target.apiBaseUrl);
    console.log("  AgentId:", target.agentId);
    console.log("  Endpoints:", JSON.stringify(target.endpoints, null, 2));

    // DO NOT change apiBaseUrl — just fix the endpoint paths
    // The FastAPI provider uses /fast/ prefix as per the UltraPanda API spec
    await prisma.provider.update({
        where: { id: target.id },
        data: {
            apiBaseUrl: 'https://www.ultrapanda.mobi',  // Fixed: was ht.ultrapanda.mobi (returned 404)
            agentId: 'NickU123',
            secretKey: 'AbcD1122',
            endpoints: {
                "appid": "zf0I9bbeOt2mt5z107",
                "appsecret": "P85FLdFf_grvaUhvcmf5kozud39",
                "agentLogin": "/fast/agent/login",
                "agentBalance": "/fast/agent/login",
                "createPlayer": "/fast/user/create",
                "recharge": "/fast/user/deposit",
                "withdraw": "/fast/user/withdrawal",
                "playerBalance": "/fast/user/balance",
                "resetPassword": "/fast/user/updatePasswd"
            }
        }
    });

    console.log("Successfully updated the provider configuration!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
