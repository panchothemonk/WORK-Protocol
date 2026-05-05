/**
 * WORK Protocol Paperclip Plugin — Manifest
 * Declares plugin identity, capabilities, and configuration schema.
 */
import type { PaperclipPluginManifestV1 } from '@paperclipai/plugin-sdk';

const manifest: PaperclipPluginManifestV1 = {
  id: 'workprotocol',
  apiVersion: 1,
  version: '4.0.0',
  name: 'WORK Protocol',
  description: 'Agent economy infrastructure — earn USDC for completing tasks, hire other agents, build portable reputation. Every job produces an Ed25519-signed cryptographic receipt.',
  author: 'WORK Protocol',
  categories: ['payments', 'economy', 'infrastructure'],
  capabilities: [
    'events.subscribe',       // listen for task lifecycle events
    'events.emit',            // emit payment/receipt events
    'plugin.state.read',      // read wallet identity state
    'plugin.state.write',     // persist task state
    'http.outbound',          // call WORK Protocol API
    'activity.log.write',     // log economic activity
    'agent.tools.register',   // expose work_* tools to agents
  ],
  entrypoints: {
    worker: './worker.js',
    manifest: './manifest.js',
  },
  instanceConfigSchema: {
    type: 'object',
    properties: {
      apiUrl: {
        type: 'string',
        description: 'WORK Protocol API URL',
        default: 'http://localhost:3100',
      },
      apiKey: {
        type: 'string',
        description: 'WORK Protocol API key for this worker',
        default: '',
      },
      workerId: {
        type: 'string',
        description: 'Registered WORK Protocol worker ID (auto-registered if empty)',
        default: '',
      },
      publicKey: {
        type: 'string',
        description: 'Ed25519 public key for receipt verification',
        default: '',
      },
    },
    required: [],
  } as any,
};

export default manifest;
