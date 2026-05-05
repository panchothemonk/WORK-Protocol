// @workprotocol/sdk — thin HTTP client wrapping the API
import crypto from 'node:crypto';

export class WorkProtocolClient {
  constructor({ baseUrl = 'http://localhost:3100', apiKey } = {}) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async _fetch(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    headers['Idempotency-Key'] = crypto.randomUUID();

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${this.baseUrl}${path}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // Workers
  async createWorker(params) { return this._fetch('POST', '/api/v1/workers', params); }
  async getWorker(id) { return this._fetch('GET', `/api/v1/workers/${id}`); }

  // Services
  async publishService(params) { return this._fetch('POST', '/api/v1/services', params); }
  async searchServices(query) { return this._fetch('GET', `/api/v1/services?${new URLSearchParams(query)}`); }

  // Jobs
  async quote(params) { return this._fetch('POST', '/api/v1/jobs/quote', params); }
  async createJob(params) { return this._fetch('POST', '/api/v1/jobs', params); }
  async getJob(id) { return this._fetch('GET', `/api/v1/jobs/${id}`); }

  // Payments
  async createChallenge(quote) { return this._fetch('POST', '/api/v1/payments/x402/challenge', { quote }); }
  async authorizePayment(challenge, signatures) { return this._fetch('POST', '/api/v1/payments/x402/authorize', { challenge, signatures }); }

  // Receipts
  async getReceipt(id) { return this._fetch('GET', `/api/v1/receipts/${id}`); }
  async verifyReceipt(receipt, publicKey) { return this._fetch('POST', '/api/v1/public/verify/receipt', { receipt, publicKey }); }

  // Reputation
  async getReputation(workerId) { return this._fetch('GET', `/api/v1/reputation/${workerId}`); }

  // Health
  async health() { return this._fetch('GET', '/health'); }
}
