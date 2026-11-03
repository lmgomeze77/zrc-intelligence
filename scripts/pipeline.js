const fs = require('node:fs');
const { validatePublished } = require('../lib/briefing-contract');
const [command, path = 'data.json', local] = process.argv.slice(2);
function read(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }
if (command === 'guard') {
  let generate = true;
  try { validatePublished(read(path), { requireOpenAI: true }); generate = false; } catch {}
  console.log(generate ? 'A fresh OpenAI edition is required.' : 'Fresh edition exists; resume delivery only.');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `generate=${generate}\n`);
} else if (command === 'validate') {
  validatePublished(read(path), { requireOpenAI: true });
  console.log('Validated current OpenAI briefing.');
} else if (command === 'merge-ledger') {
  const a = fs.existsSync(path) ? read(path) : { version: 1, editions: {} };
  const b = read(local);
  if (a.version !== 1 || b.version !== 1) throw new Error('Unsupported delivery ledger');
  for (const [id, row] of Object.entries(b.editions)) {
    const prior = a.editions[id];
    if (prior && prior.digest !== row.digest) throw new Error('Conflicting delivery edition');
    a.editions[id] = { ...prior, ...row, recipients: { ...prior?.recipients, ...row.recipients } };
  }
  fs.writeFileSync(path, JSON.stringify(a, null, 2) + '\n');
} else throw new Error('Unknown pipeline command');
