const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LearnerMemory, projectIdentity } = require('../dist/memory.js');

function fakeState(seed = {}) {
  const items = new Map(Object.entries(seed));
  return {
    items,
    get: (key, fallback) => items.has(key) ? items.get(key) : fallback,
    update: async (key, value) => { items.set(key, value); }
  };
}

test('retains aggregated difficulty across sessions without storing prompts or code', async () => {
  const store = fakeState();
  const first = new LearnerMemory(store);
  const id = projectIdentity('/Users/person/dev/project-one');
  await first.initialize();
  await first.record({ projectId:id, projectName:'project-one', language:'javascript',
    question:'Meu secret_api_key=ABC and setInterval continua confuso', kind:'difficulty', origin:'fallback' });
  const second = new LearnerMemory(store);
  assert.match(second.userView(id,'project-one'), /temporizadores/);
  assert.match(second.modelContext(id,'project-one'), /1 pedidos de ajuda/);
  const saved = JSON.stringify([...store.items]);
  assert.doesNotMatch(saved, /secret_api_key|ABC|\/Users\/person\/dev/);
  assert.match(saved, /fallback/);
});

test('two workspaces sharing the same name remain separate; deletion targets one', async () => {
  const store = fakeState();
  const m = new LearnerMemory(store);
  const a = projectIdentity('/Users/a/OrderFlow');
  const b = projectIdentity('/Users/b/OrderFlow');
  assert.notEqual(a,b);
  await m.record({projectId:a,projectName:'OrderFlow',language:'python',question:'git branch',kind:'question',origin:'model'});
  await m.record({projectId:b,projectName:'OrderFlow',language:'python',question:'sqlite database',kind:'difficulty',origin:'model'});
  assert.equal(m.forProject(a,'OrderFlow').length,1);
  await m.clearProject(a,'OrderFlow');
  assert.equal(m.forProject(a,'OrderFlow').length,0);
  assert.equal(m.forProject(b,'OrderFlow').length,1);
  await m.clear();
  assert.equal(m.read().length,0);
});

test('legacy stored raw questions become categories and are deleted from old key', async () => {
  const store = fakeState({'sainii.learnerNotes.v1':[{
    project:'OrderFlow', topic:'confused about setInterval; private password=TOPSECRET',
    type:'question',time:'2026-10-13T00:00:00.000Z'
  }]});
  const memory = new LearnerMemory(store);
  await Promise.all([memory.initialize(), memory.initialize()]);
  assert.equal(store.items.get('sainii.learnerNotes.v1').length,0);
  assert.equal(memory.read().length,1);
  assert.equal(memory.forProject(projectIdentity('/tmp/OrderFlow'),'OrderFlow').length,1);
  assert.doesNotMatch(JSON.stringify(memory.read()), /TOPSECRET|password/);
});
