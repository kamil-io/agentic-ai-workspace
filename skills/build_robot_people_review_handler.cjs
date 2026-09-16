// Generate the canonical inactive n8n template. Never include deployment credentials.
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(__dirname,'../workflows/fahmi_bot/approvals/robot-people-review-handler.json');
const nodes=[];
const add=(name,type,parameters,version=2)=>nodes.push({id:`rpr-${nodes.length+1}`,name,type:`n8n-nodes-base.${type}`,typeVersion:version,position:[nodes.length*240,300],parameters});
add('Telegram Review Webhook','webhook',{httpMethod:'POST',path:'robot-people-review',authentication:'headerAuth',responseMode:'onReceived',options:{}},2);
nodes.at(-1).webhookId='c9f689d0-0ccb-470f-a95f-5bc01a52b39c';
add('Validate Telegram Review','code',{jsCode:`const raw=$input.first().json;
const cb=(raw.body||raw).callback_query;
const match=/^rp_(approve|reject|edit)_([1-9]\\d*)$/.exec(cb?.data||'');
const expectedReviewerId='YOUR_TELEGRAM_REVIEWER_ID';
const expectedChatId='YOUR_TELEGRAM_CHAT_ID';
const reviewerId=String(cb?.from?.id||'');
const chatId=String(cb?.message?.chat?.id||'');
const messageId=Number(cb?.message?.message_id);
if(!match||!cb?.id||reviewerId!==expectedReviewerId||chatId!==expectedChatId||!Number.isSafeInteger(messageId)||messageId<1)return [];
return [{json:{action:match[1],draftId:match[2],reviewerId,chatId,messageId,callbackQueryId:cb.id}}];`});
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
RETURNING id,review_status;`,options:{queryReplacement:"={{ [ $('Validate Telegram Review').first().json.action, $('Validate Telegram Review').first().json.reviewerId, $('Validate Telegram Review').first().json.draftId, $('Validate Telegram Review').first().json.messageId ] }}"}},2.6);
nodes.at(-1).alwaysOutputData=true;
add('Verify Review Decision','code',{jsCode:`const request=$('Validate Telegram Review').first().json;
const row=$input.first()?.json||{};
const expected={approve:'APPROVED',reject:'REJECTED',edit:'EDIT_REQUESTED'}[request.action];
if(String(row.id||'')!==String(request.draftId)||row.review_status!==expected)throw new Error('Review decision is invalid, stale or already used');
return [{json:{...request,reviewStatus:row.review_status}}];`});
add('Answer Telegram Review','telegram',{resource:'callback',operation:'answerQuery',queryId:'={{ $json.callbackQueryId }}',additionalFields:{text:"={{ $json.action === 'approve' ? '✅ Draft approved and recorded. Nothing was published.' : ($json.action === 'reject' ? '❌ Draft rejected and recorded.' : '✏️ Edit requested. Reply to the draft with your revised wording.') }}",show_alert:true}},1.2);
const edge=name=>({node:name,type:'main',index:0});
const connections={};
for(let i=0;i<nodes.length-1;i++)connections[nodes[i].name]={main:[[edge(nodes[i+1].name)]]};
const workflow={name:'Fahmi_bot | Robot People | Review Decisions',nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Asia/Kuala_Lumpur'}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(workflow,null,2)+'\n');
