// Generate the canonical inactive n8n template. Never include deployment credentials.
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(__dirname,'../workflows/fahmi_bot/approvals/robot-people-review-handler.json');
const nodes=[];
const add=(name,type,parameters,version=2)=>nodes.push({id:`rpr-${nodes.length+1}`,name,type:`n8n-nodes-base.${type}`,typeVersion:version,position:[nodes.length*240,300],parameters});
add('Telegram Review Webhook','webhook',{httpMethod:'POST',path:'robot-people-review',authentication:'headerAuth',responseMode:'onReceived',options:{}},2);
nodes.at(-1).webhookId='c9f689d0-0ccb-470f-a95f-5bc01a52b39c';
add('Parse Telegram Review Update','code',{jsCode:`const raw=$input.first().json;
const update=raw.body||raw;
const expectedReviewerId='YOUR_TELEGRAM_REVIEWER_ID';
const expectedChatId='YOUR_TELEGRAM_CHAT_ID';
const cb=update.callback_query;
if(cb){
 const match=/^rp_(approve|reject|edit)_([1-9]\\d*)$/.exec(cb.data||'');
 const reviewerId=String(cb.from?.id||''),chatId=String(cb.message?.chat?.id||''),messageId=Number(cb.message?.message_id);
 if(!match||!cb.id||reviewerId!==expectedReviewerId||chatId!==expectedChatId||!Number.isSafeInteger(messageId)||messageId<1)return [];
 return [{json:{kind:'callback',action:match[1],draftId:match[2],reviewerId,chatId,messageId,callbackQueryId:cb.id}}];
}
const message=update.message;
if(message){
 const reviewerId=String(message.from?.id||''),chatId=String(message.chat?.id||''),replyToMessageId=Number(message.reply_to_message?.message_id),editedText=String(message.text||'').trim();
 if(reviewerId!==expectedReviewerId||chatId!==expectedChatId||!Number.isSafeInteger(replyToMessageId)||replyToMessageId<1||!editedText||[...editedText].length>500)return [];
 return [{json:{kind:'edit_reply',reviewerId,chatId,replyToMessageId,editedText}}];
}
return [];`});
add('Is Callback','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'rpr-callback-condition',leftValue:'={{ $json.kind }}',rightValue:'callback',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},2.2);
add('Record Review Decision','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET review_status=CASE $1 WHEN 'approve' THEN 'APPROVED' WHEN 'reject' THEN 'REJECTED' WHEN 'edit' THEN 'EDIT_REQUESTED' END,
 reviewed_by_telegram_user_id=$2,
 reviewed_at=now(),
 updated_at=now()
WHERE id=$3::bigint
 AND telegram_message_id=$4::bigint
 AND status='REVIEW_SENT'
 AND review_status='PENDING'
 AND $1 IN ('approve','reject','edit')
RETURNING id,review_status;`,options:{queryReplacement:"={{ [ $('Parse Telegram Review Update').first().json.action, $('Parse Telegram Review Update').first().json.reviewerId, $('Parse Telegram Review Update').first().json.draftId, $('Parse Telegram Review Update').first().json.messageId ] }}"}},2.6);
nodes.at(-1).alwaysOutputData=true;
add('Verify Review Decision','code',{jsCode:`const request=$('Parse Telegram Review Update').first().json;
const row=$input.first()?.json||{};
const expected={approve:'APPROVED',reject:'REJECTED',edit:'EDIT_REQUESTED'}[request.action];
if(String(row.id||'')!==String(request.draftId)||row.review_status!==expected)throw new Error('Review decision is invalid, stale or already used');
return [{json:{...request,reviewStatus:row.review_status}}];`});
add('Answer Telegram Review','telegram',{resource:'callback',operation:'answerQuery',queryId:'={{ $json.callbackQueryId }}',additionalFields:{text:"={{ $json.action === 'approve' ? '✅ Draft approved and recorded. Nothing was published.' : ($json.action === 'reject' ? '❌ Draft rejected and recorded.' : '✏️ Edit requested. Reply to the draft with your revised wording.') }}",show_alert:true}},1.2);
add('Store Manual Edit','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET draft_text=$1,
 review_status='PENDING',
 telegram_message_id=NULL,
 reviewed_by_telegram_user_id=$2,
 reviewed_at=now(),
 updated_at=now()
WHERE telegram_message_id=$3::bigint
 AND status='REVIEW_SENT'
 AND review_status='EDIT_REQUESTED'
RETURNING id,draft_text;`,options:{queryReplacement:"={{ [ $('Parse Telegram Review Update').first().json.editedText, $('Parse Telegram Review Update').first().json.reviewerId, $('Parse Telegram Review Update').first().json.replyToMessageId ] }}"}},2.6);
nodes.at(-1).alwaysOutputData=true;
add('Verify Manual Edit','code',{jsCode:`const request=$('Parse Telegram Review Update').first().json;
const row=$input.first()?.json||{};
if(!row.id||row.draft_text!==request.editedText)throw new Error('Edit request is invalid, stale or already used');
return [{json:{...request,draftId:row.id,draftText:row.draft_text}}];`});
add('Send Edited Draft for Review','telegram',{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:"={{ 'Hafeez_bot | Robot People | Edited draft #' + $json.draftId + '\\n\\n' + $json.draftText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') + '\\n\\nYour exact edit is stored. Nothing will be published until a separate publishing workflow is approved.' }}",additionalFields:{parse_mode:'HTML',appendAttribution:false},replyMarkup:'inlineKeyboard',inlineKeyboard:{rows:[{row:{buttons:[{text:'✅ Approve draft',additionalFields:{callback_data:"=rp_approve_{{ $json.draftId }}"}},{text:'❌ Reject',additionalFields:{callback_data:"=rp_reject_{{ $json.draftId }}"}}]}},{row:{buttons:[{text:'✏️ Request edit',additionalFields:{callback_data:"=rp_edit_{{ $json.draftId }}"}}]}}]}},1.2);
add('Record Edited Message','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET telegram_message_id=$1::bigint,updated_at=now()
WHERE id=$2::bigint AND status='REVIEW_SENT' AND review_status='PENDING' AND telegram_message_id IS NULL
RETURNING id,telegram_message_id;`,options:{queryReplacement:"={{ [ $json.result.message_id, $('Verify Manual Edit').first().json.draftId ] }}"}},2.6);
const edge=name=>({node:name,type:'main',index:0});
const connections={
 'Telegram Review Webhook':{main:[[edge('Parse Telegram Review Update')]]},
 'Parse Telegram Review Update':{main:[[edge('Is Callback')]]},
 'Is Callback':{main:[[edge('Record Review Decision')],[edge('Store Manual Edit')]]},
 'Record Review Decision':{main:[[edge('Verify Review Decision')]]},
 'Verify Review Decision':{main:[[edge('Answer Telegram Review')]]},
 'Store Manual Edit':{main:[[edge('Verify Manual Edit')]]},
 'Verify Manual Edit':{main:[[edge('Send Edited Draft for Review')]]},
 'Send Edited Draft for Review':{main:[[edge('Record Edited Message')]]},
};
const workflow={name:'Fahmi_bot | Robot People | Review Decisions',nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Asia/Kuala_Lumpur'}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(workflow,null,2)+'\n');
