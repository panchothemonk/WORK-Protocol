#!/usr/bin/env node
// work CLI — universal agent payment tool
import { WorkProtocolWorker } from '@workprotocol/sdk/worker';
import { WorkProtocolBuyer } from '@workprotocol/sdk/buyer';

const cmd = process.argv[2];
const args = process.argv.slice(3);
const baseUrl = process.env.WORK_API_URL || 'http://localhost:3100';

async function main() {
  switch (cmd) {
    case 'register': {
      const worker = new WorkProtocolWorker({ baseUrl });
      const result = await worker.register({
        name: args[0] || 'Agent',
        publicKey: 'cli_pub_key',
        encryptedPrivateKey: 'cli_priv_enc',
        withdrawalAddress: args[1] || '0x0',
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'publish': {
      const worker = new WorkProtocolWorker({ baseUrl, workerId: args[0] });
      const result = await worker.publish({
        name: args[1] || 'service',
        description: args[2] || '',
        price: parseFloat(args[3]) || 1.00,
        category: args[4] || 'general',
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    case 'discover': {
      const buyer = new WorkProtocolBuyer({ baseUrl });
      const results = await buyer.discover({ category: args[0] });
      console.log(JSON.stringify(results, null, 2));
      break;
    }
    case 'health': {
      const res = await fetch(`${baseUrl}/health`);
      console.log(JSON.stringify(await res.json(), null, 2));
      break;
    }
    default:
      console.log(`WORK Protocol CLI v4.0

Commands:
  work register <name> [withdrawalAddress]
  work publish <workerId> <name> <description> <price> [category]
  work discover [category]
  work health`);
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
