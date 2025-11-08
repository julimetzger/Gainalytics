#!/usr/bin/env node
/**
 * Gainalytics Autonomous Dev Agent CLI
 * Usage:
 *   npm run agent run TRN-104
 *   npm run agent loop -- --max 2
 */

import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import {runTask} from './runners/runTask';
import {CONFIG} from './config';

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const param = args[1];

  console.log('Running agent with command: ', cmd);
  switch (cmd) {
    case 'run': {
      if (!param) {
        console.error('❌ Usage: npm run agent run <TASK_ID>');
        process.exit(1);
      }

      const backlogFile = path.join(CONFIG.agentRoot, CONFIG.backlogPath);
      if (!fs.existsSync(backlogFile)) {
        console.error('❌ Backlog file not found:', backlogFile);
        process.exit(1);
      }

      const backlog = yaml.parse(fs.readFileSync(backlogFile, 'utf8'));
      const task = backlog.find((t) => t.id === param);
      if (!task) {
        console.error(`❌ Task ${param} not found in backlog.`);
        process.exit(1);
      }

      console.log(`🚀 Running agent for task ${task.id}: ${task.title}`);
      console.log('task', task);
      const report = await runTask(task);
      console.log('✅ Task completed:');
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    default:
      console.log('Usage:');
      console.log('  npm run agent run <TASK_ID>');
      console.log('  npm run agent loop -- --max <N>');
  }
}

main().catch((err) => {
  console.error('💥 Agent crashed:', err);
  process.exit(1);
});
