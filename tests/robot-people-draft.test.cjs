const test=require('node:test');
const assert=require('node:assert/strict');
const w=require('../workflows/hafeez_bot/robot-people/robot-people-daily-draft.json');
const node=name=>w.nodes.find(n=>n.name===name);
test('daily review template has no publishing capability or secret fields',()=>{
 assert.equal(w.active,false); assert.equal(w.settings.timezone,'Asia/Kuala_Lumpur');
 assert.equal(node('Daily 9 AM Kuala Lumpur').parameters.rule.interval[0].expression,'0 9 * * *');
 assert(!JSON.stringify(w).includes('graph.threads.net')); assert(!JSON.stringify(w).includes('access_token'));
 assert(w.nodes.every(n=>!n.credentials));
 assert.equal(node('Generate Robot People Draft').parameters.genericAuthType,'httpHeaderAuth');
 for(const n of w.nodes)if(n.parameters.jsCode)new Function(n.parameters.jsCode);
 for(const c of Object.values(w.connections))for(const branch of c.main)for(const e of branch)assert(node(e.node));
});
test('invalid or blocked model output stops rather than using replacement content',()=>{
 const run=r=>new Function('$input',node('Validate Generated Draft').parameters.jsCode)({first:()=>({json:r})});
 for(const r of [{},{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'MAX_TOKENS'}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'x'.repeat(501)}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'Guna *dashboard* untuk kerja'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'We assign owner dan due date'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'AI kami boleh urus semua mesej'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'Semua masuk ke dalam senarai rapi secara automatik'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'Deploy agentic system untuk lead triage'}]}}]}])assert.throws(()=>run(r));
 assert.equal(run({candidates:[{finishReason:'STOP',content:{parts:[{text:'Draft example'}]}}]})[0].json.text,'Draft example');
});
test('daily claim is unique and persistence precedes review delivery',()=>{
 assert.match(node('Ensure Draft Store').parameters.query,/draft_date DATE NOT NULL UNIQUE/);
 assert.match(node('Ensure Draft Store').parameters.query,/review_status TEXT NOT NULL DEFAULT 'PENDING'/);
 const claim=node('Claim Daily Draft').parameters.query;
 assert.match(claim,/ON CONFLICT \(draft_date\) DO UPDATE/);
 assert.match(claim,/WHERE robot_people_content_drafts\.status='FAILED'/);
 assert.match(claim,/execution_id=EXCLUDED\.execution_id/);
 assert.equal(w.connections['Store Exact Draft'].main[0][0].node,'Send Draft for Human Review');
 assert.match(node('Store Exact Draft').parameters.query,/execution_id=\$3/);
 assert.match(node('Send Draft for Human Review').parameters.text,/\$json.draft_text/);
 assert.equal(node('Send Draft for Human Review').parameters.replyMarkup,'inlineKeyboard');
 assert.deepEqual(node('Send Draft for Human Review').parameters.inlineKeyboard.rows.flatMap(r=>r.row.buttons.map(b=>b.text)),['✅ Approve draft','❌ Reject','✏️ Request edit']);
 assert.match(node('Record Review Delivery').parameters.query,/telegram_message_id=\$3::bigint/);
 assert.equal(node('Send Draft for Human Review').onError,'continueErrorOutput');
 assert.equal(w.connections['Record Failure'].main[0][0].node,'Stop Failed Run');
});
