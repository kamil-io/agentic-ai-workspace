const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../agents/hafeez_bot/MARKETING_RULES.json');

test('Hafeez policy prioritizes accuracy and approval over automation',()=>{
 assert.equal(rules.agent_name,'Hafeez_bot');
 assert.equal(rules.priority_order[0],'factual_accuracy_and_privacy');
 assert.equal(rules.priority_order[1],'human_approval');
 assert.equal(rules.rules.length,7);
 const text=JSON.stringify(rules);
 assert.match(text,/Do not invent audience research/);
 assert.match(text,/Do not publish, message prospects, buy ads or change offers/);
 assert.match(text,/Do not force a sales pitch into every post/);
 assert.match(text,/clear consent/);
});

test('Robot People prompt applies evidence, awareness and plain-language rules',()=>{
 const workflow=require('../workflows/hafeez_bot/robot-people/robot-people-daily-draft.json');
 const prompt=workflow.nodes.find(node=>node.name==='Generate Robot People Draft').parameters.jsonBody;
 assert.match(prompt,/no supplied audience research/);
 assert.match(prompt,/purpose is awareness/);
 assert.match(prompt,/helpful question rather than a sales pitch/);
 assert.match(prompt,/translate it into a familiar business outcome/);
 assert.match(prompt,/Malaysian business owners who are curious about AI agents/);
 assert.match(prompt,/Teach one useful AI-agent idea/);
});
