const test=require('node:test');
const assert=require('node:assert/strict');
const w=require('../workflows/fahmi_bot/approvals/robot-people-review-handler.json');
const node=name=>w.nodes.find(n=>n.name===name);
const runParser=raw=>new Function('$input',node('Parse Telegram Review Update').parameters.jsCode.replace('YOUR_TELEGRAM_REVIEWER_ID','765967664').replace('YOUR_TELEGRAM_CHAT_ID','765967664'))({first:()=>({json:raw})});
test('review handler records decisions but has no publishing capability',()=>{
 const text=JSON.stringify(w);
 assert.equal(w.active,false);
 assert(!text.includes('graph.threads.net'));
 assert(!text.includes('Publish to Threads'));
 assert(!text.includes('access_token'));
 assert.match(node('Record Review Decision').parameters.query,/review_status='PENDING'/);
 assert.match(node('Record Review Decision').parameters.query,/telegram_message_id=\$4::bigint/);
 assert.match(node('Record Review Decision').parameters.query,/status='REVIEW_SENT'/);
 assert.match(node('Store Manual Edit').parameters.query,/review_status='EDIT_REQUESTED'/);
 assert.match(node('Store Manual Edit').parameters.query,/draft_text=\$1/);
 assert.equal(node('Send Edited Draft for Review').parameters.replyMarkup,'inlineKeyboard');
});
test('callback parser accepts only the trusted reviewer, chat and action format',()=>{
 const valid={body:{callback_query:{id:'cb-1',data:'rp_approve_12',from:{id:765967664},message:{message_id:44,chat:{id:765967664}}}}};
 assert.deepEqual(runParser(valid)[0].json,{kind:'callback',action:'approve',draftId:'12',reviewerId:'765967664',chatId:'765967664',messageId:44,callbackQueryId:'cb-1'});
 for(const bad of [
  {body:{callback_query:{...valid.body.callback_query,data:'approve_log_12'}}},
  {body:{callback_query:{...valid.body.callback_query,from:{id:1}}}},
  {body:{callback_query:{...valid.body.callback_query,message:{message_id:44,chat:{id:1}}}}},
 ])assert.deepEqual(runParser(bad),[]);
});
test('trusted reply becomes a bounded manual edit request',()=>{
 const update={body:{message:{text:'Ayat yang saya sudah baiki.',from:{id:765967664},chat:{id:765967664},reply_to_message:{message_id:44}}}};
 assert.deepEqual(runParser(update)[0].json,{kind:'edit_reply',reviewerId:'765967664',chatId:'765967664',replyToMessageId:44,editedText:'Ayat yang saya sudah baiki.'});
 assert.deepEqual(runParser({body:{message:{...update.body.message,text:'x'.repeat(501)}}}),[]);
});
