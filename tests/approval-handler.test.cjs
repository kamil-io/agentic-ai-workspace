const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'workflows', name === 'approval-handler' ? 'fahmi_bot/approvals' : 'hafeez_bot/threads', `kebundata-threads-${name}.json`)));
const w = read('approval-handler');
const node = name => w.nodes.find(n => n.name === name);
test('PostgreSQL fixture exercises current workflow queries',()=>{
  const sql=fs.readFileSync(path.join(__dirname,'approval-handler.postgres.sql'),'utf8');
  for(const name of ['Claim Pending Approval','Persist Container ID','Record Publish Attempt','Update Postgres Approved','Record Uncertain Publication']) {
    assert(sql.includes(node(name).parameters.query.replaceAll('public.','pg_temp.')),`${name} fixture differs from workflow`);
  }
});
const callback = {action:'approve',approvalId:'1',reviewerId:'123',chatId:'456',config:{threadsUserId:'789'}};
const row = {id:1,post_id:'42',approved_reply:'Exact approved text',approval_status:'APPROVAL_CLAIMED',publish_status:'PUBLISHING',approved_by_telegram_user_id:'123',approval_execution_id:'run-1',approval_claimed_at:'2026-09-13T00:00:00Z',approval_expires_at:'2026-09-14T00:00:00Z'};
function run(name, input, cb=callback) {
  return new Function('$input','$','$execution',node(name).parameters.jsCode)(
    {first:()=>({json:input})},
    n=>({first:()=>({json:n==='Parse Telegram Callback Data'?cb:{...cb,draft_reply:row.approved_reply,post_id:row.post_id}})}),
    {id:'run-1'});
}
test('templates inactive, code compiles, connection targets exist', () => {
  for (const f of ['approval-handler','outbound-engager']) {
    const wf=read(f); assert.equal(wf.active,false);
    for(const n of wf.nodes) if(n.parameters.jsCode) new Function(n.parameters.jsCode);
    for(const outputs of Object.values(wf.connections)) for(const branch of outputs.main) for(const edge of branch) assert(wf.nodes.some(n=>n.name===edge.node));
  }
});
test('snapshot is used even if original draft field changes',()=>{
  assert.equal(run('Validate Stored Approval',{...row,draft_reply:'Different text'})[0].json.draft_reply,row.approved_reply);
});
test('invalid, expired-at-claim, consumed and wrong-owner approvals reject',()=>{
  for(const change of [{id:null},{post_id:'bad'},{approved_reply:' '},{approval_expires_at:null},{approval_expires_at:row.approval_claimed_at},{approval_execution_id:'other'},{approved_by_telegram_user_id:'999'},{approval_status:'APPROVED_BY_HUMAN'}]) assert.throws(()=>run('Validate Stored Approval',{...row,...change}));
});
test('rejection works even for invalid draft content',()=>{
  const r=run('Validate Stored Approval',{...row,post_id:null,approved_reply:null,approval_status:'REJECTED_BY_HUMAN',publish_status:'REJECTED'},{...callback,action:'reject'});
  assert.equal(r[0].json.action,'reject');
});
test('Telegram acknowledgement cannot replace approval context',()=>{
  for(const response of [{ok:true,result:true},{error:'acknowledgement failed'}]) {
    const output=run('Restore Approval Context',response)[0].json;
    assert.equal(output.action,'approve');assert.equal(output.draft_reply,row.approved_reply);assert.equal(output.config.threadsUserId,'789');
  }
  assert.equal(w.connections['Answer Telegram Callback'].main[0][0].node,'Restore Approval Context');
});
test('missing or malformed API IDs never pass validation',()=>{
  for(const name of ['Validate Container ID','Validate Published ID']) {
    for(const value of [{},{id:'bad'},{error:'timeout'}]) assert.throws(()=>run(name,value));
    assert.equal(run(name,{id:'123'})[0].json.id,'123');
  }
});
test('uncertain outcomes bypass success and publishing is not retried',()=>{
  for(const name of ['Create Threads Reply Container','Validate Container ID','Persist Container ID','Record Publish Attempt','Publish to Threads','Validate Published ID','Update Postgres Approved']) {
    assert.equal(node(name).onError,'continueErrorOutput');
    assert.equal(node(name).retryOnFail,false);
    assert.equal(w.connections[name].main[1][0].node,'Record Uncertain Publication');
  }
  assert.equal(w.connections['Validate Container ID'].main[0][0].node,'Persist Container ID');
  assert.equal(w.connections['Wait 4s Ingestion'].main[0][0].node,'Record Publish Attempt');
  assert(!w.connections['Record Uncertain Publication']);
});
