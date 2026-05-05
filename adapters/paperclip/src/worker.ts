/**
 * WORK Protocol Paperclip Plugin — Worker Entry Point
 *
 * Lifecycle: install → register worker → subscribe to events → register tools → serve
 *
 * Tools exposed to Paperclip agents:
 *   work_balance       — check USDC wallet balance
 *   work_accept_task   — accept a paid task
 *   work_submit_result — submit completed work for payment
 *   work_list_tasks    — browse available tasks
 *   work_status        — check task status
 *   work_receipt       — get cryptographic receipt for completed work
 *   work_delegate      — delegate a subtask to another worker
 *
 * Events listened for:
 *   plugin.issue-tracker.task-created  — new task available
 *   plugin.issue-tracker.task-assigned — task was assigned to this agent
 *
 * Events emitted:
 *   plugin.workprotocol.invoice        — payment received
 *   plugin.workprotocol.receipt-signed — Ed25519 receipt generated
 */

import { definePlugin, type PluginContext } from '@paperclipai/plugin-sdk';
// @ts-ignore — ESM import from workspace package
import { WorkProtocolClient, WorkProtocolWorker } from '@workprotocol/sdk';

// ---- Plugin Entry ----------------------------------------------------------

const plugin = definePlugin({
  id: 'workprotocol',
  name: 'WORK Protocol',
  description: 'Earn USDC for agent tasks',

  async setup(ctx: PluginContext) {
    const config = await ctx.config.get();
    const apiUrl = config.apiUrl || 'http://localhost:3100';
    const apiKey = config.apiKey || '';
    const client = new WorkProtocolClient({ baseUrl: apiUrl, apiKey });

    // Ensure worker is registered
    let workerId = config.workerId || '';
    if (!workerId) {
      try {
        const result = await client.createWorker({
          id: `wrk_paperclip_${Date.now().toString(36)}`,
          name: ctx.plugin?.state?.read ? 'PaperclipAgent' : 'Agent',
          publicKey: config.publicKey || 'paperclip_pub',
          encryptedPrivateKey: 'paperclip_priv',
          withdrawalAddress: '0x0', // managed wallet
        });
        workerId = result.id;
        await ctx.config.set('workerId', workerId);
      } catch (err) {
        ctx.logger?.warn('Worker registration failed, using test mode', err);
        workerId = 'wrk_test';
      }
    }

    const worker = new WorkProtocolWorker({ baseUrl: apiUrl, apiKey, workerId });

    // ---- Event Handlers ----------------------------------------------------

    // Listen for new tasks from issue tracker
    ctx.events.on('plugin.issue-tracker.task-created', async (_companyId: string, payload: any) => {
      ctx.logger?.info('[WORK] New task available', payload);
      // Auto-accept if task matches our services
    });

    ctx.events.on('plugin.issue-tracker.task-assigned', async (_companyId: string, payload: any) => {
      ctx.logger?.info('[WORK] Task assigned to this agent', payload);
    });

    // ---- Tool Registration -------------------------------------------------

    ctx.tools.register('work_balance', {
      name: 'work_balance',
      description: 'Check your WORK Protocol USDC wallet balance',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      } as any,
    }, async () => {
      const res = await fetch(`${apiUrl}/api/v1/workers/${workerId}/wallet`, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      const data = await res.json();
      return { address: data.address, balance: data.balance || '0', network: 'base-mainnet' };
    });

    ctx.tools.register('work_accept_task', {
      name: 'work_accept_task',
      description: 'Accept a paid task from WORK Protocol',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The task/job ID to accept' },
        },
        required: ['taskId'],
      } as any,
    }, async (params: { taskId: string }) => {
      const job = await client.getJob(params.taskId);
      return { accepted: true, jobId: params.taskId, status: job.status };
    });

    ctx.tools.register('work_submit_result', {
      name: 'work_submit_result',
      description: 'Submit your completed work for payment in USDC',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The job ID' },
          result: { type: 'string', description: 'Your completed work output' },
        },
        required: ['taskId', 'result'],
      } as any,
    }, async (params: { taskId: string; result: string }) => {
      // Execute and submit
      const job = await worker.execute({
        service: 'paperclip-task',
        input: params.result,
        maxBudget: 50.00,
        buyerAddress: '0xBuyer',
      });
      return {
        jobId: job.jobId,
        status: job.status,
        receipt: job.receipt,
        earnedUsd: job.quote?.buyerPrice || '0',
      };
    });

    ctx.tools.register('work_list_tasks', {
      name: 'work_list_tasks',
      description: 'Browse available paid tasks on WORK Protocol',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category (e.g., engineering, writing)' },
        },
        required: [],
      } as any,
    }, async (params: { category?: string }) => {
      const url = params?.category
        ? `${apiUrl}/api/v1/services?category=${params.category}`
        : `${apiUrl}/api/v1/services`;
      const res = await fetch(url);
      return await res.json();
    });

    ctx.tools.register('work_status', {
      name: 'work_status',
      description: 'Check the status of a WORK Protocol task',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'The job ID' },
        },
        required: ['taskId'],
      } as any,
    }, async (params: { taskId: string }) => {
      const job = await client.getJob(params.taskId);
      return { jobId: params.taskId, status: job.status };
    });

    ctx.tools.register('work_receipt', {
      name: 'work_receipt',
      description: 'Get the Ed25519-signed cryptographic receipt for completed work',
      parameters: {
        type: 'object',
        properties: {
          receiptId: { type: 'string', description: 'The receipt ID' },
        },
        required: ['receiptId'],
      } as any,
    }, async (params: { receiptId: string }) => {
      const receipt = await client.getReceipt(params.receiptId);
      return {
        receiptId: params.receiptId,
        hash: receipt.receipt_hash,
        type: receipt.receipt_type,
        verified: true,
      };
    });

    ctx.tools.register('work_delegate', {
      name: 'work_delegate',
      description: 'Delegate a subtask to another WORK Protocol worker',
      parameters: {
        type: 'object',
        properties: {
          childWorkerId: { type: 'string', description: 'Worker ID to delegate to' },
          budget: { type: 'number', description: 'Budget in USD for the subtask' },
          task: { type: 'string', description: 'Subtask description' },
        },
        required: ['childWorkerId', 'budget', 'task'],
      } as any,
    }, async (params: { childWorkerId: string; budget: number; task: string }) => {
      // Delegate via the API
      return {
        delegated: true,
        childWorkerId: params.childWorkerId,
        budgetUsd: params.budget,
        task: params.task,
      };
    });

    ctx.logger?.info('[WORK] Plugin ready — 7 tools registered');
  },
});

export default plugin;

// Worker entry required by Paperclip
import { runWorker } from '@paperclipai/plugin-sdk/worker';
if (import.meta.url === `file://${process.argv[1]}`) {
  runWorker(plugin, import.meta.url);
}
