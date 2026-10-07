import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { StudentProgress, TestResult, ChatHistory } from '../models/index.js';
import { plain, publicUser } from '../utils/serialize.js';
import { studentPdf } from '../services/pdf.js';

const router=Router(); router.use(requireAuth);
async function build(user){const [progress,tests,chats]=await Promise.all([StudentProgress.find({user_id:user._id}).sort({created_at:-1}).limit(200).lean(),TestResult.find({user_id:user._id}).sort({created_at:-1}).limit(200).lean(),ChatHistory.find({user_id:user._id}).sort({created_at:-1}).limit(100).lean()]);const p=tests.filter(x=>Number(x.total_marks)>0).map(x=>Number(x.score||0)/Number(x.total_marks)*100);const latest=progress[0];return{user:publicUser(user),summary:{total_tests:p.length,best_score:p.length?Number(Math.max(...p).toFixed(1)):0,average_score:p.length?Number((p.reduce((a,b)=>a+b,0)/p.length).toFixed(1)):0,total_predictions:progress.length,ai_questions:chats.length,latest_risk:latest?.risk_level||null,latest_predicted_marks:latest?.total_predicted_marks??null,latest_attendance:latest?.attendance??null,latest_study_hours:latest?.study_hours??null},progress:progress.map(x=>plain(x,{keepUserId:false})),tests:tests.map(x=>plain(x,{keepUserId:false})),chats:chats.map(x=>plain(x,{keepUserId:false}))};}
router.get('/me',async(req,res,next)=>{try{res.json(await build(req.user));}catch(e){next(e);}});
router.get('/me.pdf',async(req,res,next)=>{try{const data=await build(req.user);const pdf=await studentPdf(data);const name=(req.user.profile?.name||'student').trim().replace(/\s+/g,'-').toLowerCase();res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename="${name}-learning-report.pdf"`);res.send(pdf);}catch(e){next(e);}});
export { build as buildStudentReport };
export default router;
