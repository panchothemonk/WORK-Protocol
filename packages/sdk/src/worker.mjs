// @workprotocol/sdk — Worker SDK
// High-level API for worker agents: register, publish, execute, get paid.
import crypto from 'node:crypto';
import { WorkProtocolClient } from './client.mjs';
import { humanToMicroUsd } from '@workprotocol/core/helpers';

export class WorkProtocolWorker {
  constructor({ baseUrl, apiKey, workerId }) {
    this.client = new WorkProtocolClient({ baseUrl, apiKey });
    this.workerId = workerId;
  }

  /** Register as a worker */
  async register({ name, publicKey, encryptedPrivateKey, withdrawalAddress, guardrails = {} }) {
    const result = await this.client.createWorker({
      id: `wrk_${crypto.randomBytes(12).toString('hex')}`,
      name, publicKey, encryptedPrivateKey, withdrawalAddress, guardrails,
    });
    this.workerId = result.id;
    return result;
  }

  /** Publish what you offer */
  async publish({ name, description, price, category }) {
    return this.client.publishService({
      id: `svc_${crypto.randomBytes(12).toString('hex')}`,
      worker_id: this.workerId,
      name, description,
      price_micro_usd: humanToMicroUsd(price),
      category,
    });
  }

  /** Execute a job — the only call most agents need */
  async execute({ service, input, maxBudget, buyerAddress }) {
    // Quote
    const quote = await this.client.quote({ workerId: this.workerId, serviceId: service, buyerAddress });

    // Challenge + authorize (test mode for now)
    const challenge = await this.client.createChallenge(quote);
    const auth = await this.client.authorizePayment(challenge, [
      { purpose: 'worker_payout', sig: '0x01' },
      { purpose: 'ai_cost', sig: '0x02' },
      { purpose: 'protocol_fee', sig: '0x03' },
    ]);

    // Create job
    const job = await this.client.createJob({
      paymentAuthId: auth.id,
      input,
    });

    return {
      jobId: job.id,
      status: job.status,
      quote: { buyerPrice: quote.buyerPriceMicroUsd, fee: quote.protocolFeeMicroUsd },
    };
  }
}
