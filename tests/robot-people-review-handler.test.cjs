const test=require('node:test');
const assert=require('node:assert/strict');
const w=require('../workflows/fahmi_bot/approvals/robot-people-review-handler.json');
const node=name=>w.nodes.find(n=>n.name===name);
const runParser=raw=>new Function('$input',node('Parse Telegram Review Update').parameters.jsCode.replace('YOUR_TELEGRAM_REVIEWER_ID','765967664').replace('YOUR_TELEGRAM_CHAT_ID','765967664').replace('YOUR_THREADS_USER_ID','28448492461400993'))({first:()=>({json:raw})});
test('approval claims one eligible stored draft and publishes through Query Auth',()=>{
 const text=JSON.stringify(w);
 assert.equal(w.active,false);
 assert(text.includes('graph.threads.net'));
 assert(!text.includes('access_token'));
 assert.match(node('Record Review Decision').parameters.query,/review_status='PENDING'/);
 assert.match(node('Record Review Decision').parameters.query,/telegram_message_id=\$4::bigint/);
 assert.match(node('Record Review Decision').parameters.query,/publish_enabled=true/);
 assert.match(node('Record Review Decision').parameters.query,/publish_status='UNPUBLISHED'/);
 assert.match(node('Record Review Decision').parameters.query,/publish_execution_id=CASE WHEN \$1='approve' THEN \$5/);
 assert.equal(node('Create Threads Text Container').parameters.genericAuthType,'httpQueryAuth');
 assert.equal(node('Publish to Threads').parameters.genericAuthType,'httpQueryAuth');
 assert.equal(node('Create Threads Text Container').parameters.jsonBody,'={{ {media_type:"TEXT",text:$json.draftText} }}');
});
test('publication is single-attempt and uncertain outcomes require reconciliation',()=>{
 for(const name of ['Create Threads Text Container','Validate Container ID','Persist Container ID','Verify Persisted Container','Record Publish Attempt','Verify Publish Attempt','Publish to Threads','Validate Published ID','Mark Draft Published','Verify Published Record'])assert.equal(node(name).retryOnFail,false,name);
 assert.match(node('Record Publish Attempt').parameters.query,/publish_attempted_at=now\(\)/);
 assert.equal(w.connections['Verify Publish Attempt'].main[0][0].node,'Publish to Threads');
 assert.equal(w.connections['Publish to Threads'].main[1][0].node,'Record Uncertain Publication');
 assert.equal(w.connections['Validate Published ID'].main[1][0].node,'Record Uncertain Publication');
 assert.equal(w.connections['Mark Draft Published'].main[1][0].node,'Record Uncertain Publication');
 assert(w.connections['Verify Published Record'].main[0].some(e=>e.node==='Send Publish Confirmation'));
 assert.match(node('Send Publish Confirmation').parameters.text,/Published to @robot\.people/);
 assert.match(node('Record Uncertain Publication').parameters.query,/publish_status='PUBLISH_UNKNOWN'/);
 assert.match(node('Record Uncertain Publication').parameters.query,/publish_attempted_at IS NOT NULL/);
 assert.match(node('Record Prepublish Failure').parameters.query,/publish_attempted_at IS NULL/);
});
test('manual edit is the only way to enable an older blocked draft',()=>{
 const query=node('Store Manual Edit').parameters.query;
 assert.match(query,/review_status='EDIT_REQUESTED'/);
 assert.match(query,/draft_text=\$1/);
 assert.match(query,/publish_enabled=true/);
 assert.match(query,/publish_status='UNPUBLISHED'/);
 assert.equal(node('Send Edited Draft for Review').parameters.replyMarkup,'inlineKeyboard');
 assert.match(JSON.stringify(node('Send Edited Draft for Review').parameters.inlineKeyboard),/Approve & publish/);
 assert.equal(w.connections['Answer Non-Publish Review'].main[0][0].node,'Is Edit Requested');
 assert.equal(w.connections['Is Edit Requested'].main[0][0].node,'Send Edit Instructions');
 assert.match(node('Send Edit Instructions').parameters.text,/next normal message/);
 assert.match(query,/count\(\*\)=1/);
});
test('callback parser accepts only the trusted reviewer, chat and action format',()=>{
 const valid={body:{callback_query:{id:'cb-1',data:'rp_approve_12',from:{id:765967664},message:{message_id:44,chat:{id:765967664}}}}};
 assert.deepEqual(runParser(valid)[0].json,{kind:'callback',action:'approve',draftId:'12',reviewerId:'765967664',chatId:'765967664',messageId:44,callbackQueryId:'cb-1',threadsUserId:'28448492461400993'});
 for(const bad of [{body:{callback_query:{...valid.body.callback_query,data:'approve_log_12'}}},{body:{callback_query:{...valid.body.callback_query,from:{id:1}}}},{body:{callback_query:{...valid.body.callback_query,message:{message_id:44,chat:{id:1}}}}}])assert.deepEqual(runParser(bad),[]);
});
test('trusted reply becomes a bounded manual edit request',()=>{
 const update={body:{message:{text:'Ayat yang saya sudah baiki.',from:{id:765967664},chat:{id:765967664},reply_to_message:{message_id:44}}}};
 assert.deepEqual(runParser(update)[0].json,{kind:'edit_reply',reviewerId:'765967664',chatId:'765967664',replyToMessageId:44,editedText:'Ayat yang saya sudah baiki.'});
 assert.deepEqual(runParser({body:{message:{...update.body.message,text:'x'.repeat(501)}}}),[]);
 const plain={body:{message:{text:'Teks biasa untuk menggantikan draf.',from:{id:765967664},chat:{id:765967664}}}};
 assert.deepEqual(runParser(plain)[0].json,{kind:'edit_reply',reviewerId:'765967664',chatId:'765967664',replyToMessageId:null,editedText:'Teks biasa untuk menggantikan draf.'});
 assert.deepEqual(runParser({body:{message:{...plain.body.message,text:'/cancel'}}}),[]);
});
