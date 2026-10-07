import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { StudentProgress, TestResult, ChatHistory, ActivityLog } from '../models/index.js';
import { predict, recommend } from '../services/prediction.js';
import { tutorReply, providerStatus } from '../services/tutor.js';
import { plain } from '../utils/serialize.js';
import { recordActivity } from '../services/activity.js';

const router = Router();
router.use(requireAuth);

router.post('/predictions/predict', (req,res,next)=>{try{res.json(predict(req.body||{}));}catch(e){next(e);}});
router.post('/predictions/recommend', (req,res,next)=>{try{res.json(recommend(req.body||{}));}catch(e){next(e);}});

router.post('/progress', async (req,res,next)=>{try{const row=await StudentProgress.create({user_id:req.user._id,...req.body});await recordActivity(req.user,'prediction_saved','/prediction',{risk_level:req.body.risk_level,total_predicted_marks:req.body.total_predicted_marks});res.status(201).json(plain(row,{keepUserId:false}));}catch(e){next(e);}});
router.get('/progress', async (req,res,next)=>{try{const limit=Math.min(500,Math.max(1,Number(req.query.limit||100)));const rows=await StudentProgress.find({user_id:req.user._id}).sort({created_at:-1}).limit(limit).lean();res.json(rows.map(x=>plain(x,{keepUserId:false})));}catch(e){next(e);}});
router.get('/progress/latest', async (req,res,next)=>{try{const row=await StudentProgress.findOne({user_id:req.user._id}).sort({created_at:-1}).lean();res.json(row?plain(row,{keepUserId:false}):null);}catch(e){next(e);}});

router.post('/tests/results', async (req,res,next)=>{try{const row=await TestResult.create({user_id:req.user._id,...req.body});await recordActivity(req.user,'test_completed','/test-corner',{test_type:req.body.test_type,difficulty:req.body.difficulty,score:req.body.score,total_marks:req.body.total_marks});res.status(201).json(plain(row,{keepUserId:false}));}catch(e){next(e);}});
router.get('/tests/results', async (req,res,next)=>{try{const limit=Math.min(200,Math.max(1,Number(req.query.limit||50)));const rows=await TestResult.find({user_id:req.user._id}).sort({created_at:-1}).limit(limit).lean();res.json(rows.map(x=>plain(x,{keepUserId:false})));}catch(e){next(e);}});

router.post('/activity/track', async (req,res,next)=>{try{const action=String(req.body.action||'').slice(0,50);if(!action)return res.status(400).json({message:'Action is required'});await recordActivity(req.user,action,req.body.page||null,req.body.metadata||{},action!=='heartbeat');res.json({ok:true});}catch(e){next(e);}});

router.get('/ai/providers', (_req,res)=>res.json(providerStatus()));
router.post('/ai/chat', async (req,res,next)=>{try{const message=String(req.body.message||'').trim();if(!message)return res.status(400).json({message:'Message is required'});const latest=await StudentProgress.findOne({user_id:req.user._id}).sort({created_at:-1}).lean();const profile=req.user.profile||{};const context=`Grade: ${profile.grade||'unknown'}; favorite subject: ${profile.favorite_subject||'unknown'}; latest risk: ${latest?.risk_level||'unknown'}; predicted marks: ${latest?.total_predicted_marks??'unknown'}.`;const answer=await tutorReply(message,context);const row=await ChatHistory.create({user_id:req.user._id,question:message,reply:answer.reply,provider:answer.provider,latency_ms:answer.latency_ms});await recordActivity(req.user,'ai_question','/ai-tutor',{question_preview:message.slice(0,120),provider:answer.provider});res.json({...answer,id:String(row._id),multi_agent:false,agents:[answer.provider]});}catch(e){next(e);}});

function fallbackQuestions(type='Math', difficulty='Hard') {
  const math=[
    ['A shop gives 15% discount on ₹800. What is the selling price?',['₹680','₹720','₹740','₹760'],'₹680'],
    ['If 3x + 7 = 25, what is x?',['4','5','6','7'],'6'],
    ['What is 3/4 of 48?',['32','34','36','40'],'36'],
    ['A rectangle is 12 cm long and 7 cm wide. Its area is:',['19 cm²','38 cm²','84 cm²','96 cm²'],'84 cm²'],
    ['Which number is divisible by both 3 and 4?',['18','24','27','30'],'24'],
  ];
  const reading=[
    ['Which is the best meaning of “brief” in “a brief meeting”?',['Long','Short','Noisy','Secret'],'Short'],
    ['The main idea of a passage tells:',['Every detail','What the passage is mostly about','Only the title','The last sentence'],'What the passage is mostly about'],
    ['A synonym for “rapid” is:',['Slow','Quick','Weak','Quiet'],'Quick'],
    ['An inference is:',['A copied sentence','A conclusion based on clues','A spelling rule','A heading'],'A conclusion based on clues'],
    ['Which word is an antonym of “ancient”?',['Old','Historic','Modern','Past'],'Modern'],
  ];
  const writing=[
    ['Choose the correct sentence.',['She go to school.','She goes to school.','She going school.','She gone to school.'],'She goes to school.'],
    ['Which word is an adjective in “The bright sun rose”?',['The','bright','sun','rose'],'bright'],
    ['Choose the correctly punctuated sentence.',['Where are you going.','Where are you going?','Where are you going!','where are you going?'],'Where are you going?'],
    ['The plural of “child” is:',['childs','childes','children','childrens'],'children'],
    ['Which connector shows contrast?',['because','and','but','so'],'but'],
  ];
  const base=String(type).toLowerCase().includes('read')?reading:String(type).toLowerCase().includes('writ')?writing:math;
  return base.map(([question,options,correct_answer],i)=>({id:i+1,question,options,correct_answer,difficulty}));
}
router.post('/ai/tests/generate', async (req,res,next)=>{try{const type=String(req.body.test_type||'Math');const difficulty=String(req.body.difficulty||'Hard');const context=String(req.body.learning_context||'');const prompt=`Create exactly 5 ${difficulty} ${type} multiple-choice questions for a school student. Return JSON only as an array with question, options (4 strings), and correct_answer. ${context}`;let questions=null;const reply=await tutorReply(prompt,`Assessment generation for ${type}`);try{const match=reply.reply.match(/\[[\s\S]*\]/);if(match){const parsed=JSON.parse(match[0]);if(Array.isArray(parsed)&&parsed.length)questions=parsed.slice(0,5).map((q,i)=>({id:i+1,question:String(q.question),options:Array.isArray(q.options)?q.options.map(String).slice(0,4):[],correct_answer:String(q.correct_answer||q.answer||'')})).filter(q=>q.options.length===4&&q.correct_answer);}}catch{}if(!questions?.length)questions=fallbackQuestions(type,difficulty);res.json({questions,provider:questions===null?'local':reply.provider});}catch(e){next(e);}});
router.post('/ai/tests/analyze', async (req,res)=>{const score=Number(req.body.score||0),total=Math.max(1,Number(req.body.total_marks||1)),pct=Math.round(score/total*100);res.json({percentage:pct,level:pct>=80?'Strong':pct>=60?'Developing':'Needs support',message:pct>=80?'Excellent work. Move to application questions.':pct>=60?'Good progress. Review the missed questions and retry.':'Revisit the fundamentals, then take a shorter practice set.',review_areas:req.body.wrong_answers||[]});});

router.post('/ai/study-plan', async (req,res,next)=>{try{
  const latest=await StudentProgress.findOne({user_id:req.user._id}).sort({created_at:-1}).lean();
  const input=req.body||{};
  const scores={math:Number(input['math score']??input.math_score??latest?.math_score??0),reading:Number(input['reading score']??input.reading_score??latest?.reading_score??0),writing:Number(input['writing score']??input.writing_score??latest?.writing_score??0)};
  const ordered=Object.entries(scores).sort((a,b)=>a[1]-b[1]);
  const priorities=ordered.map(([subject,score])=>({subject,score,priority:score<60?'high':score<75?'medium':'maintenance'}));
  const plan=priorities.map((p,i)=>({day:i+1,focus:p.subject,task:p.score<60?`Review ${p.subject} fundamentals and complete 15 guided questions.`:`Complete a timed ${p.subject} practice set and review mistakes.`}));
  while(plan.length<7){const p=priorities[plan.length%priorities.length];plan.push({day:plan.length+1,focus:p.subject,task:`Practice ${p.subject} for 30 minutes, then write down two mistakes and their corrections.`});}
  res.json({analysis:`Priority is ${priorities[0]?.subject||'core skills'} based on the available scores.`,priority_topics:priorities,seven_day_plan:plan,practice_queries:priorities.slice(0,2).map(p=>`Give me grade-appropriate ${p.subject} practice for my weak areas.`),sources:[]});
}catch(e){next(e);}});

router.post('/ai/evaluate-answer', async (req,res,next)=>{try{
  const question=String(req.body.question||'').trim(),answer=String(req.body.student_answer||'').trim();
  if(!question||!answer)return res.status(400).json({message:'question and student_answer are required'});
  const result=await tutorReply(`Question: ${question}\nStudent answer: ${answer}\nEvaluate the answer. Say whether it is correct, then explain the concept briefly.`,`Grade: ${req.user.profile?.grade||'unknown'}`);
  res.json({feedback:result.reply,sources:result.sources||[],provider:result.provider});
}catch(e){next(e);}});

export default router;
