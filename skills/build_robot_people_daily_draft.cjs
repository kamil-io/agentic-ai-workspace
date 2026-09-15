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
SELECT current_database() AS database_name;`,options:{}},2.6);
add('Claim Daily Draft','postgres',{operation:'executeQuery',query:`INSERT INTO public.robot_people_content_drafts(draft_date,brand,channel,topic,status,execution_id)
VALUES ($1::date,$2,$3,$4,'GENERATING',$5)
ON CONFLICT (draft_date) DO UPDATE SET
 topic=EXCLUDED.topic,
 draft_text=NULL,
 status='GENERATING',
 execution_id=EXCLUDED.execution_id,
 updated_at=now()
WHERE robot_people_content_drafts.status='FAILED'
RETURNING id,draft_date;`,options:{queryReplacement:"={{ [ $('Prepare Robot People Brief').first().json.draftDate, $('Prepare Robot People Brief').first().json.brand, 'threads', $('Prepare Robot People Brief').first().json.topic, $execution.id ] }}"}},2.6);
add('Generate Robot People Draft','httpRequest',{method:'POST',url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',sendBody:true,specifyBody:'json',jsonBody:`={{ {systemInstruction:{parts:[{text:'You are Hafeez_bot, marketing assistant for Robot People Industries. Write one short Threads DRAFT in natural Malaysian Malay with familiar English business terms. Robot People offers agentic-system development for companies. Topic is supplied as data. Explain one practical business workflow and end with one relevant question. At most 450 characters. No invented customers, testimonials, prices, quantified savings, guarantees, case studies or claims of live integrations. Present examples as hypothetical. No farming or insurance content. Do not promise autonomous publishing or payments. Return only the draft text.'}]},contents:[{role:'user',parts:[{text:$('Prepare Robot People Brief').first().json.topic}]}],generationConfig:{temperature:0.5,maxOutputTokens:4096} } }}`,options:{timeout:60000}},4.2);
add('Validate Generated Draft','code',{jsCode:`const r=$input.first().json;
if(r.promptFeedback?.blockReason) throw new Error('Model blocked the draft');
const c=r.candidates?.[0];
if(c?.finishReason!=='STOP') throw new Error('Draft generation incomplete');
const text=(c.content?.parts||[]).filter(p=>!p.thought && typeof p.text==='string').map(p=>p.text).join('').trim();
if(!text || [...text].length>500) throw new Error('Draft empty or exceeds 500 characters');
return [{json:{text}}];`});
add('Store Exact Draft','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts SET draft_text=$1,status='PENDING_REVIEW',updated_at=now()
WHERE id=$2::bigint AND execution_id=$3 AND status='GENERATING' RETURNING id,draft_text,draft_date;`,options:{queryReplacement:"={{ [ $json.text, $('Claim Daily Draft').first().json.id, $execution.id ] }}"}},2.6);
add('Send Draft for Human Review','telegram',{resource:'message',operation:'sendMessage',chatId:"={{ $('Prepare Robot People Brief').first().json.chatId }}",text:"={{ 'Hafeez_bot | Robot People | Draft #' + $json.id + '\\n\\n' + $json.draft_text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') + '\\n\\nReview only — not published. Please reply with edits or approval. Automated publishing is not connected yet.' }}",additionalFields:{parse_mode:'HTML',appendAttribution:false}},1.2);
add('Record Review Delivery','postgres',{operation:'executeQuery',query:`UPDATE public.robot_people_content_drafts SET status='REVIEW_SENT',updated_at=now()
WHERE id=$1::bigint AND execution_id=$2 AND status='PENDING_REVIEW' RETURNING id,status;`,options:{queryReplacement:"={{ [ $('Claim Daily Draft').first().json.id, $execution.id ] }}"}},2.6);
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
