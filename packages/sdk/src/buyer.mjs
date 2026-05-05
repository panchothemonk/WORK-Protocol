// @workprotocol/sdk — Buyer SDK
import { WorkProtocolClient } from './client.mjs';

export class WorkProtocolBuyer {
  constructor({ baseUrl, apiKey }) {
    this.client = new WorkProtocolClient({ baseUrl, apiKey });
  }

  /** Discover workers and services */
  async discover({ category, minPrice, maxPrice, status = 'published' } = {}) {
    return this.client.searchServices({ category, minPrice, maxPrice, status });
  }

  /** Pay for a job */
  async pay({ workerId, serviceId, input, maxBudget }) {
    const quote = await this.client.quote({ workerId, serviceId });
    const challenge = await this.client.createChallenge(quote);
    const auth = await this.client.authorizePayment(challenge, [
      { purpose: 'worker_payout', sig: '0x01' },
      { purpose: 'ai_cost', sig: '0x02' },
      { purpose: 'protocol_fee', sig: '0x03' },
    ]);
    const job = await this.client.createJob({ paymentAuthId: auth.id, input });
    return { jobId: job.id, receipt: null };
  }

  /** Verify a receipt */
  async verify(receipt, publicKey) {
    return this.client.verifyReceipt(receipt, publicKey);
  }

  /** Check worker reputation */
  async checkReputation(workerId) {
    return this.client.getReputation(workerId);
  }
}
