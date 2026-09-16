// Generate the canonical inactive n8n template. Never include deployment credentials.
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(__dirname,'../workflows/fahmi_bot/approvals/robot-people-review-handler.json');
const nodes=[];
const add=(name,type,parameters,version=2,extra={})=>nodes.push({id:`rpr-${nodes.length+1}`,name,type:`n8n-nodes-base.${type}`,typeVersion:version,position:[nodes.length*220,300],parameters,...extra});
add('Telegram Review Webhook','webhook',{httpMethod:'POST',path:'robot-people-review',authentication:'headerAuth',responseMode:'onReceived',options:{}},2,{webhookId:'c9f689d0-0ccb-470f-a95f-5bc01a52b39c'});
add('Parse Telegram Review Update','code',{jsCode:`const raw=$input.first().json;
const update=raw.body||raw;
const expectedReviewerId='YOUR_TELEGRAM_REVIEWER_ID';
const expectedChatId='YOUR_TELEGRAM_CHAT_ID';
const cb=update.callback_query;
if(cb){
 const match=/^rp_(approve|reject|edit)_([1-9]\\d*)$/.exec(cb.data||'');
 const reviewerId=String(cb.from?.id||''),chatId=String(cb.message?.chat?.id||''),messageId=Number(cb.message?.message_id);
 if(!match||!cb.id||reviewerId!==expectedReviewerId||chatId!==expectedChatId||!Number.isSafeInteger(messageId)||messageId<1)return [];
 return [{json:{kind:'callback',action:match[1],draftId:match[2],reviewerId,chatId,messageId,callbackQueryId:cb.id,threadsUserId:'YOUR_THREADS_USER_ID'}}];
}
const message=update.message;
if(message){
 const reviewerId=String(message.from?.id||''),chatId=String(message.chat?.id||''),rawReplyId=Number(message.reply_to_message?.message_id),editedText=String(message.text||'').trim();
 const replyToMessageId=Number.isSafeInteger(rawReplyId)&&rawReplyId>0?rawReplyId:null;
 if(reviewerId!==expectedReviewerId||chatId!==expectedChatId||!editedText||editedText.startsWith('/')||[...editedText].length>500)return [];
 return [{json:{kind:'edit_reply',reviewerId,chatId,replyToMessageId,editedText}}];
}
return [];`});
add('Is Callback','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'rpr-callback-condition',leftValue:'={{ $json.kind }}',rightValue:'callback',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},2.2);
add('Record Review Decision','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET review_status=CASE $1 WHEN 'approve' THEN 'APPROVED' WHEN 'reject' THEN 'REJECTED' WHEN 'edit' THEN 'EDIT_REQUESTED' END,
 publish_status=CASE WHEN $1='approve' THEN 'PUBLISHING' ELSE publish_status END,
 publish_execution_id=CASE WHEN $1='approve' THEN $5 ELSE publish_execution_id END,
 reviewed_by_telegram_user_id=$2,reviewed_at=now(),updated_at=now()
WHERE id=$3::bigint AND telegram_message_id=$4::bigint AND status='REVIEW_SENT' AND review_status='PENDING'
 AND $1 IN ('approve','reject','edit')
 AND ($1<>'approve' OR (publish_enabled=true AND publish_status='UNPUBLISHED' AND draft_text ~ '[^[:space:]]'))
RETURNING id,review_status,draft_text,publish_status,publish_execution_id;`,options:{queryReplacement:"={{ [ $('Parse Telegram Review Update').first().json.action, $('Parse Telegram Review Update').first().json.reviewerId, $('Parse Telegram Review Update').first().json.draftId, $('Parse Telegram Review Update').first().json.messageId, $execution.id ] }}"}},2.6,{alwaysOutputData:true});
add('Verify Review Decision','code',{jsCode:`const request=$('Parse Telegram Review Update').first().json;
const row=$input.first()?.json||{};
const expected={approve:'APPROVED',reject:'REJECTED',edit:'EDIT_REQUESTED'}[request.action];
if(String(row.id||'')!==String(request.draftId)||row.review_status!==expected)throw new Error('Review decision is invalid, stale, blocked or already used');
if(request.action==='approve'){
 if(row.publish_status!=='PUBLISHING'||String(row.publish_execution_id)!==String($execution.id))throw new Error('Publication claim owner mismatch');
 if(typeof row.draft_text!=='string'||!row.draft_text.trim()||[...row.draft_text].length>500)throw new Error('Stored draft is invalid');
}
return [{json:{...request,reviewStatus:row.review_status,publishStatus:row.publish_status,draftText:row.draft_text}}];`});
add('Is Publish Approved','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'rpr-publish-condition',leftValue:'={{ $json.action }}',rightValue:'approve',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},2.2);
add('Answer Non-Publish Review','telegram',{resource:'callback',operation:'answerQuery',queryId:'={{ $json.callbackQueryId }}',additionalFields:{text:"={{ $json.action === 'reject' ? '❌ Draft rejected.' : '✏️ Edit requested. Send your revised wording as your next message.' }}",show_alert:true}},1.2);
add('Is Edit Requested','if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'rpr-edit-instruction-condition',leftValue:"={{ $('Verify Review Decision').first().json.action }}",rightValue:'edit',operator:{type:'string',operation:'equals'}}],combinator:'and'},options:{}},2.2);
add('Send Edit Instructions','telegram',{resource:'message',operation:'sendMessage',chatId:"={{ $('Verify Review Decision').first().json.chatId }}",text:"={{ '✏️ Edit mode opened for draft #' + $('Verify Review Decision').first().json.draftId + '. Send your corrected post text as your next normal message.' }}",additionalFields:{appendAttribution:false}},1.2);
add('Create Threads Text Container','httpRequest',{method:'POST',url:'=https://graph.threads.net/v1.0/{{ $json.threadsUserId }}/threads',sendBody:true,specifyBody:'json',jsonBody:'={{ {media_type:"TEXT",text:$json.draftText} }}',options:{},authentication:'genericCredentialType',genericAuthType:'httpQueryAuth'},4.2,{onError:'continueErrorOutput',retryOnFail:false});
add('Validate Container ID','code',{jsCode:`const d=$input.first().json;if(!/^\\d+$/.test(String(d.id||'')))throw new Error('Missing Threads container ID');return [{json:{id:String(d.id)}}];`},2,{onError:'continueErrorOutput',retryOnFail:false});
add('Persist Container ID','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET threads_container_id=$1,updated_at=now()
WHERE id=$2::bigint AND publish_execution_id=$3 AND review_status='APPROVED'
 AND publish_status='PUBLISHING' AND threads_container_id IS NULL AND publish_attempted_at IS NULL
RETURNING id,threads_container_id;`,options:{queryReplacement:"={{ [ $json.id, $('Verify Review Decision').first().json.draftId, $execution.id ] }}"}},2.6,{alwaysOutputData:true,onError:'continueErrorOutput',retryOnFail:false});
add('Verify Persisted Container','code',{jsCode:`const row=$input.first()?.json||{};const expected=$('Validate Container ID').first().json.id;if(String(row.id||'')!==String($('Verify Review Decision').first().json.draftId)||String(row.threads_container_id||'')!==String(expected))throw new Error('Container state was not persisted');return [{json:{id:String(row.threads_container_id)}}];`},2,{onError:'continueErrorOutput',retryOnFail:false});
add('Wait for Threads Ingestion','wait',{amount:4,unit:'seconds'},1.1,{webhookId:'1f783c64-3754-47e2-aafd-robotpeoplepublish'});
add('Record Publish Attempt','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET publish_attempted_at=now(),updated_at=now()
WHERE id=$2::bigint AND publish_execution_id=$3 AND review_status='APPROVED'
 AND publish_status='PUBLISHING' AND threads_container_id=$1 AND publish_attempted_at IS NULL
RETURNING id,threads_container_id,publish_attempted_at;`,options:{queryReplacement:"={{ [ $json.id, $('Verify Review Decision').first().json.draftId, $execution.id ] }}"}},2.6,{alwaysOutputData:true,onError:'continueErrorOutput',retryOnFail:false});
add('Verify Publish Attempt','code',{jsCode:`const row=$input.first()?.json||{};if(String(row.id||'')!==String($('Verify Review Decision').first().json.draftId)||!/^\\d+$/.test(String(row.threads_container_id||''))||!row.publish_attempted_at)throw new Error('Publish attempt was not recorded');return [{json:{id:String(row.threads_container_id)}}];`},2,{onError:'continueErrorOutput',retryOnFail:false});
add('Publish to Threads','httpRequest',{method:'POST',url:"=https://graph.threads.net/v1.0/{{ $('Verify Review Decision').first().json.threadsUserId }}/threads_publish",sendQuery:true,queryParameters:{parameters:[{name:'creation_id',value:'={{ $json.id }}'}]},options:{},authentication:'genericCredentialType',genericAuthType:'httpQueryAuth'},4.2,{onError:'continueErrorOutput',retryOnFail:false});
add('Validate Published ID','code',{jsCode:`const d=$input.first().json;if(!/^\\d+$/.test(String(d.id||'')))throw new Error('Missing published Threads post ID');return [{json:{id:String(d.id)}}];`},2,{onError:'continueErrorOutput',retryOnFail:false});
add('Mark Draft Published','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET publish_status='PUBLISHED',threads_post_id=$1,published_at=now(),updated_at=now(),publish_error_code=NULL,publish_error_message=NULL
WHERE id=$2::bigint AND publish_execution_id=$3 AND review_status='APPROVED'
 AND publish_status='PUBLISHING' AND publish_attempted_at IS NOT NULL
RETURNING id,threads_post_id,published_at;`,options:{queryReplacement:"={{ [ $json.id, $('Verify Review Decision').first().json.draftId, $execution.id ] }}"}},2.6,{alwaysOutputData:true,onError:'continueErrorOutput',retryOnFail:false});
add('Verify Published Record','code',{jsCode:`const row=$input.first()?.json||{};if(String(row.id||'')!==String($('Verify Review Decision').first().json.draftId)||!/^\\d+$/.test(String(row.threads_post_id||''))||!row.published_at)throw new Error('Published post was not recorded');return [{json:{...$('Verify Review Decision').first().json,threadsPostId:String(row.threads_post_id)}}];`},2,{onError:'continueErrorOutput',retryOnFail:false});
add('Answer Publish Success','telegram',{resource:'callback',operation:'answerQuery',queryId:'={{ $json.callbackQueryId }}',additionalFields:{text:"={{ '✅ Approved and published to @robot.people. Post ID: ' + $json.threadsPostId }}",show_alert:true}},1.2);
add('Send Publish Confirmation','telegram',{resource:'message',operation:'sendMessage',chatId:"={{ $('Verify Review Decision').first().json.chatId }}",text:"={{ '✅ Published to @robot.people.\\n\\nPost ID: ' + $('Verify Published Record').first().json.threadsPostId + '\\nCheck: https://www.threads.com/@robot.people' }}",additionalFields:{appendAttribution:false}},1.2,{onError:'continueRegularOutput'});
add('Record Prepublish Failure','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET publish_status='FAILED',publish_error_code='PREPUBLISH_FAILED',
 publish_error_message='Approval recorded, but publishing did not start. Review the n8n execution before retrying.',updated_at=now()
WHERE id=$1::bigint AND publish_execution_id=$2 AND review_status='APPROVED'
 AND publish_status='PUBLISHING' AND publish_attempted_at IS NULL
RETURNING id;`,options:{queryReplacement:"={{ [ $('Verify Review Decision').first().json.draftId, $execution.id ] }}"}},2.6,{alwaysOutputData:true,retryOnFail:false});
add('Answer Prepublish Failure','telegram',{resource:'callback',operation:'answerQuery',queryId:"={{ $('Verify Review Decision').first().json.callbackQueryId }}",additionalFields:{text:'⚠️ Approval recorded, but publishing did not start. Check the n8n execution.',show_alert:true}},1.2);
add('Record Uncertain Publication','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET publish_status='PUBLISH_UNKNOWN',publish_error_code='MANUAL_RECONCILIATION_REQUIRED',
 publish_error_message='Publication may have reached Threads. Verify @robot.people before any retry.',updated_at=now()
WHERE id=$1::bigint AND publish_execution_id=$2 AND review_status='APPROVED'
 AND publish_status='PUBLISHING' AND publish_attempted_at IS NOT NULL
RETURNING id;`,options:{queryReplacement:"={{ [ $('Verify Review Decision').first().json.draftId, $execution.id ] }}"}},2.6,{alwaysOutputData:true,retryOnFail:false});
add('Answer Uncertain Publication','telegram',{resource:'callback',operation:'answerQuery',queryId:"={{ $('Verify Review Decision').first().json.callbackQueryId }}",additionalFields:{text:'⚠️ Publication outcome is uncertain. Do not retry until @robot.people is checked.',show_alert:true}},1.2);
add('Store Manual Edit','postgres',{operation:'executeQuery',query:`WITH candidates AS (
 SELECT id FROM public.robot_people_content_drafts
 WHERE status='REVIEW_SENT' AND review_status='EDIT_REQUESTED' AND publish_status='UNPUBLISHED'
  AND ($3::bigint IS NULL OR telegram_message_id=$3::bigint)
 ORDER BY reviewed_at DESC
 LIMIT 2
), chosen AS (
 SELECT min(id) AS id FROM candidates HAVING count(*)=1
)
UPDATE public.robot_people_content_drafts AS draft
SET draft_text=$1,review_status='PENDING',telegram_message_id=NULL,reviewed_by_telegram_user_id=$2,reviewed_at=now(),
 publish_enabled=true,publish_status='UNPUBLISHED',publish_execution_id=NULL,threads_container_id=NULL,threads_post_id=NULL,
 publish_attempted_at=NULL,published_at=NULL,publish_error_code=NULL,publish_error_message=NULL,updated_at=now()
FROM chosen WHERE draft.id=chosen.id
RETURNING draft.id,draft.draft_text;`,options:{queryReplacement:"={{ [ $('Parse Telegram Review Update').first().json.editedText, $('Parse Telegram Review Update').first().json.reviewerId, $('Parse Telegram Review Update').first().json.replyToMessageId ] }}"}},2.6,{alwaysOutputData:true});
add('Verify Manual Edit','code',{jsCode:`const request=$('Parse Telegram Review Update').first().json;const row=$input.first()?.json||{};if(!row.id||row.draft_text!==request.editedText)throw new Error('Edit request is invalid, stale or already used');return [{json:{...request,draftId:row.id,draftText:row.draft_text}}];`});
add('Send Edited Draft for Review','telegram',{resource:'message',operation:'sendMessage',chatId:'={{ $json.chatId }}',text:"={{ 'Hafeez_bot | Robot People | Edited draft #' + $json.draftId + '\\n\\n' + $json.draftText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') + '\\n\\nYour exact edit is stored. Approve to publish this text once to @robot.people.' }}",additionalFields:{parse_mode:'HTML',appendAttribution:false},replyMarkup:'inlineKeyboard',inlineKeyboard:{rows:[{row:{buttons:[{text:'✅ Approve & publish',additionalFields:{callback_data:"=rp_approve_{{ $json.draftId }}"}},{text:'❌ Reject',additionalFields:{callback_data:"=rp_reject_{{ $json.draftId }}"}}]}},{row:{buttons:[{text:'✏️ Request edit',additionalFields:{callback_data:"=rp_edit_{{ $json.draftId }}"}}]}}]}},1.2);
add('Record Edited Message','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts
SET telegram_message_id=$1::bigint,updated_at=now()
WHERE id=$2::bigint AND status='REVIEW_SENT' AND review_status='PENDING' AND publish_status='UNPUBLISHED' AND telegram_message_id IS NULL
RETURNING id,telegram_message_id;`,options:{queryReplacement:"={{ [ $json.result.message_id, $('Verify Manual Edit').first().json.draftId ] }}"}},2.6);
const edge=name=>({node:name,type:'main',index:0});
const connections={
 'Telegram Review Webhook':{main:[[edge('Parse Telegram Review Update')]]},'Parse Telegram Review Update':{main:[[edge('Is Callback')]]},
 'Is Callback':{main:[[edge('Record Review Decision')],[edge('Store Manual Edit')]]},'Record Review Decision':{main:[[edge('Verify Review Decision')]]},
 'Verify Review Decision':{main:[[edge('Is Publish Approved')]]},'Is Publish Approved':{main:[[edge('Create Threads Text Container')],[edge('Answer Non-Publish Review')]]},
 'Answer Non-Publish Review':{main:[[edge('Is Edit Requested')]]},'Is Edit Requested':{main:[[edge('Send Edit Instructions')],[]]},
 'Create Threads Text Container':{main:[[edge('Validate Container ID')],[edge('Record Prepublish Failure')]]},
 'Validate Container ID':{main:[[edge('Persist Container ID')],[edge('Record Prepublish Failure')]]},
 'Persist Container ID':{main:[[edge('Verify Persisted Container')],[edge('Record Prepublish Failure')]]},
 'Verify Persisted Container':{main:[[edge('Wait for Threads Ingestion')],[edge('Record Prepublish Failure')]]},
 'Wait for Threads Ingestion':{main:[[edge('Record Publish Attempt')]]},'Record Publish Attempt':{main:[[edge('Verify Publish Attempt')],[edge('Record Prepublish Failure')]]},
 'Verify Publish Attempt':{main:[[edge('Publish to Threads')],[edge('Record Prepublish Failure')]]},
 'Publish to Threads':{main:[[edge('Validate Published ID')],[edge('Record Uncertain Publication')]]},
 'Validate Published ID':{main:[[edge('Mark Draft Published')],[edge('Record Uncertain Publication')]]},
 'Mark Draft Published':{main:[[edge('Verify Published Record')],[edge('Record Uncertain Publication')]]},
 'Verify Published Record':{main:[[edge('Answer Publish Success'),edge('Send Publish Confirmation')],[edge('Record Uncertain Publication')]]},
 'Record Prepublish Failure':{main:[[edge('Answer Prepublish Failure')]]},'Record Uncertain Publication':{main:[[edge('Answer Uncertain Publication')]]},
 'Store Manual Edit':{main:[[edge('Verify Manual Edit')]]},'Verify Manual Edit':{main:[[edge('Send Edited Draft for Review')]]},
 'Send Edited Draft for Review':{main:[[edge('Record Edited Message')]]},
};
const workflow={name:'Fahmi_bot | Robot People | Review & Threads Publisher',nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Asia/Kuala_Lumpur'}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(workflow,null,2)+'\n');
