// Generate the canonical inactive n8n template. Never include deployment credentials.
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../workflows/hafeez_bot/robot-people/robot-people-daily-draft.json');
const nodes = [];
const add = (name,type,parameters,version=2) => nodes.push({id:`rp-${nodes.length+1}`,name,type:`n8n-nodes-base.${type}`,typeVersion:version,position:[nodes.length*220,300],parameters});
add('Daily 9 AM Kuala Lumpur','scheduleTrigger',{rule:{interval:[{field:'cronExpression',expression:'0 9 * * *'}]}},1.2);
add('Manual Controlled Run','webhook',{httpMethod:'POST',path:'robot-people-daily-draft',authentication:'headerAuth',responseMode:'onReceived',options:{}},2);
nodes[nodes.length-1].webhookId='332baf74-a9dc-4499-babf-8b00c9d21fc3';
add('Prepare Robot People Brief','code',{jsCode:`const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const topics = ['Organising incoming business enquiries','Preparing follow-up drafts for human review','Keeping customer handoffs clear','Starting with one measurable workflow pilot','Why human approval matters in business automation','Tracking tasks so commitments are visible','Documenting and testing a business workflow'];
const day = Math.floor(Date.parse(today+'T00:00:00Z')/86400000);
return [{json:{brand:'Robot People Industries',channel:'threads',draftDate:today,topic:topics[day%topics.length],chatId:'YOUR_TELEGRAM_CHAT_ID'}}];`});
add('Ensure Draft Store','postgres',{operation:'executeQuery',query:`CREATE TABLE IF NOT EXISTS public.robot_people_content_drafts (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 draft_date DATE NOT NULL UNIQUE,
 brand TEXT NOT NULL CHECK (brand = 'Robot People Industries'),
 channel TEXT NOT NULL CHECK (channel = 'threads'),
 topic TEXT NOT NULL,
 draft_text TEXT,
 status TEXT NOT NULL CHECK (status IN ('GENERATING','PENDING_REVIEW','REVIEW_SENT','FAILED')),
 execution_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.robot_people_content_drafts
 ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING','APPROVED','REJECTED','EDIT_REQUESTED')),
 ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT,
 ADD COLUMN IF NOT EXISTS reviewed_by_telegram_user_id TEXT,
 ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS publish_enabled BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'UNPUBLISHED' CHECK (publish_status IN ('UNPUBLISHED','PUBLISHING','PUBLISHED','FAILED','PUBLISH_UNKNOWN')),
 ADD COLUMN IF NOT EXISTS publish_execution_id TEXT,
 ADD COLUMN IF NOT EXISTS threads_container_id TEXT,
 ADD COLUMN IF NOT EXISTS threads_post_id TEXT,
 ADD COLUMN IF NOT EXISTS publish_attempted_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS publish_error_code TEXT,
 ADD COLUMN IF NOT EXISTS publish_error_message TEXT;
SELECT current_database() AS database_name;`,options:{}},2.6);
add('Claim Daily Draft','postgres',{operation:'executeQuery',query:`INSERT INTO public.robot_people_content_drafts(draft_date,brand,channel,topic,status,execution_id,publish_enabled)
VALUES ($1::date,$2,$3,$4,'GENERATING',$5,true)
ON CONFLICT (draft_date) DO UPDATE SET
 topic=EXCLUDED.topic,
 draft_text=NULL,
 status='GENERATING',
 review_status='PENDING',
 telegram_message_id=NULL,
 reviewed_by_telegram_user_id=NULL,
 reviewed_at=NULL,
 publish_enabled=true,
 publish_status='UNPUBLISHED',
 publish_execution_id=NULL,
 threads_container_id=NULL,
 threads_post_id=NULL,
 publish_attempted_at=NULL,
 published_at=NULL,
 publish_error_code=NULL,
 publish_error_message=NULL,
 execution_id=EXCLUDED.execution_id,
 updated_at=now()
WHERE robot_people_content_drafts.status='FAILED'
RETURNING id,draft_date;`,options:{queryReplacement:"={{ [ $('Prepare Robot People Brief').first().json.draftDate, $('Prepare Robot People Brief').first().json.brand, 'threads', $('Prepare Robot People Brief').first().json.topic, $execution.id ] }}"}},2.6);
add('Generate Robot People Draft','httpRequest',{method:'POST',url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:`={{ {systemInstruction:{parts:[{text:'You are Hafeez_bot, marketing assistant for Robot People Industries. Follow the Hafeez marketing policy: factual accuracy and human approval come before commercial pressure. This workflow has no supplied audience research, customer quotes, performance data, approved offer or landing page. Treat the topic as an educational idea to validate; never imply it is a proven customer pain point. The purpose is awareness, so give a useful idea and end with a helpful question rather than a sales pitch. Write one short Threads draft as a Malaysian small-business owner would speak to another owner. Use conversational Bahasa Melayu Malaysia, not formal translated Malay. Use short, natural sentences and everyday Malay words. Use anda rather than korang. Use at most two familiar English terms when no simple Malay phrase is clearer. Never use markdown, asterisks, bullets, headings or hashtags. Avoid technical and corporate jargon such as deploy, process, lead triage, classify, intent, priority, PIC, logic, edge cases, execute, standardize, agentic system, commitments, action items, assign owner, due date, dashboard, chase updates and team. If the supplied topic is technical, translate it into a familiar business outcome instead of repeating the technical phrase. Avoid stiff brochure phrases such as terlepas pandang, rekod yang jelas, senarai rapi, untuk kepastian, secara automatik and cara ini. Prefer natural phrases such as kerja tercicir, semak dulu and senang nampak apa yang belum siap. Do not assume the reader runs a shop; refer to a business or bisnes. Stay directly on the supplied topic and do not introduce software, communication channels or integrations that the topic does not mention. Start with a relatable business situation, explain one practical workflow plainly, mention human checking where relevant, and end with one natural question. Keep it between 300 and 430 characters. Robot People develops business AI systems, but describe every workflow only as a possibility using wording such as satu sistem boleh dibina or contohnya. Never say AI kami, sistem kami, kami boleh, sudah tersedia or imply that an integration is live. Do not invent customers, testimonials, prices, quantified savings, guarantees or case studies. No farming or insurance content. Do not promise autonomous publishing or payments. Before returning, silently read the draft aloud and rewrite it once if it sounds like a brochure, technical manual or direct translation. Return only the draft text.'}]},contents:[{role:'user',parts:[{text:$('Prepare Robot People Brief').first().json.topic}]}],generationConfig:{temperature:0.5,maxOutputTokens:4096} } }}`,options:{timeout:60000}},4.2);
add('Validate Generated Draft','code',{jsCode:`const r=$input.first().json;
if(r.promptFeedback?.blockReason) throw new Error('Model blocked the draft');
const c=r.candidates?.[0];
if(c?.finishReason!=='STOP') throw new Error('Draft generation incomplete');
const text=(c.content?.parts||[]).filter(p=>!p.thought && typeof p.text==='string').map(p=>p.text).join('').trim();
if(!text || [...text].length>500) throw new Error('Draft empty or exceeds 500 characters');
if(/[*_\`#]/.test(text)) throw new Error('Draft contains markdown formatting');
if(/\\b(commitments?|action items?|assign owner|due date|chase updates?)\\b/i.test(text)) throw new Error('Draft contains avoidable corporate jargon');
if(/\\b(AI|sistem) kami\\b/i.test(text)) throw new Error('Draft implies an unverified live capability');
if(/\\b(terlepas pandang|rekod yang jelas|senarai rapi|untuk kepastian|secara automatik|cara ini)\\b/i.test(text)) throw new Error('Draft contains stiff brochure language');
if(/\\b(deploy|lead triage|classify|intent|priority|PIC|edge cases|execute|standardize|agentic system)\\b/i.test(text)) throw new Error('Draft contains public-facing technical jargon');
return [{json:{text}}];`});
add('Store Exact Draft','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts SET draft_text=$1,status='PENDING_REVIEW',updated_at=now()
WHERE id=$2::bigint AND execution_id=$3 AND status='GENERATING' RETURNING id,draft_text,draft_date;`,options:{queryReplacement:"={{ [ $json.text, $('Claim Daily Draft').first().json.id, $execution.id ] }}"}},2.6);
add('Send Draft for Human Review','telegram',{resource:'message',operation:'sendMessage',chatId:"={{ $('Prepare Robot People Brief').first().json.chatId }}",text:"={{ 'Hafeez_bot | Robot People | Draft #' + $json.id + '\\n\\n' + $json.draft_text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') + '\\n\\nReview only. Approve to publish this exact text once to @robot.people.' }}",additionalFields:{parse_mode:'HTML',appendAttribution:false},replyMarkup:'inlineKeyboard',inlineKeyboard:{rows:[{row:{buttons:[{text:'✅ Approve & publish',additionalFields:{callback_data:"=rp_approve_{{ $json.id }}"}},{text:'❌ Reject',additionalFields:{callback_data:"=rp_reject_{{ $json.id }}"}}]}},{row:{buttons:[{text:'✏️ Request edit',additionalFields:{callback_data:"=rp_edit_{{ $json.id }}"}}]}}]}},1.2);
add('Record Review Delivery','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts SET status='REVIEW_SENT',review_status='PENDING',telegram_message_id=$3::bigint,updated_at=now()
WHERE id=$1::bigint AND execution_id=$2 AND status='PENDING_REVIEW' RETURNING id,status,review_status,telegram_message_id;`,options:{queryReplacement:"={{ [ $('Claim Daily Draft').first().json.id, $execution.id, $json.result.message_id ] }}"}},2.6);
add('Record Failure','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts SET status='FAILED',updated_at=now()
WHERE id=$1::bigint AND execution_id=$2 AND status IN ('GENERATING','PENDING_REVIEW') RETURNING id;`,options:{queryReplacement:"={{ [ $('Claim Daily Draft').first().json.id, $execution.id ] }}"}},2.6);
add('Stop Failed Run','stopAndError',{errorMessage:'Robot People daily draft failed. Inspect the stored draft and execution before any manual retry.'},1);
const connections={};
const edge=name=>({node:name,type:'main',index:0});
const link=(from,to)=>connections[from]={main:[[edge(to)]]};
link(nodes[0].name,nodes[2].name); link(nodes[1].name,nodes[2].name);
for(let i=2;i<9;i++)link(nodes[i].name,nodes[i+1].name);
link('Record Failure','Stop Failed Run');
for(const n of nodes.filter(n=>['Generate Robot People Draft','Validate Generated Draft','Store Exact Draft','Send Draft for Human Review'].includes(n.name))){n.onError='continueErrorOutput';connections[n.name].main.push([edge('Record Failure')]);}
const workflow={name:'Hafeez_bot | Robot People | Daily Draft Review',nodes,connections,active:false,settings:{executionOrder:'v1',timezone:'Asia/Kuala_Lumpur'}};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(workflow,null,2)+'\n');
