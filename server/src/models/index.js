import mongoose from 'mongoose';

const { Schema, model, models } = mongoose;
const timestamps = { createdAt: 'createdAt', updatedAt: 'updatedAt' };
const loose = { strict: false, minimize: false };
const objectId = Schema.Types.ObjectId;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
  is_active: { type: Boolean, default: true },
  token_version: { type: Number, default: 0 },
  profile: {
    name: { type: String, default: '' },
    grade: { type: String, default: '' },
    school: { type: String, default: '' },
    favorite_subject: { type: String, default: '' },
    dream_job: { type: String, default: '' },
    hobbies: { type: String, default: '' },
  },
  last_login_at: Date,
  last_seen_at: Date,
  last_activity_at: Date,
  last_activity_type: String,
  current_page: String,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'users' });

const ChapterProgressSchema = new Schema({ userId: { type: objectId, ref: 'User', required: true, index: true }, chapterId: { type: String, required: true } }, { timestamps, collection: 'chapter_progress', ...loose });
ChapterProgressSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
const SkillProgressSchema = new Schema({ userId: { type: objectId, ref: 'User', required: true, index: true }, skillId: { type: String, required: true } }, { timestamps, collection: 'skill_progress', ...loose });
SkillProgressSchema.index({ userId: 1, skillId: 1 }, { unique: true });
const MockTestSchema = new Schema({ userId: { type: objectId, ref: 'User', required: true, index: true }, date: { type: String, index: true } }, { timestamps, collection: 'mock_tests', ...loose });
const StudyActivitySchema = new Schema({ userId: { type: objectId, ref: 'User', required: true, index: true }, deterministicId: { type: String, index: true }, scheduledDate: { type: String, index: true } }, { timestamps, collection: 'study_activities', ...loose });
StudyActivitySchema.index({ userId: 1, deterministicId: 1 }, { unique: true, sparse: true });
const VocabularySchema = new Schema({ userId: { type: objectId, ref: 'User', required: true, index: true }, learnedOn: { type: String, index: true } }, { timestamps, collection: 'vocabulary', ...loose });
const AppConfigSchema = new Schema({ key: { type: String, required: true, unique: true } }, { timestamps, collection: 'app_config', ...loose });

const StudentProgressSchema = new Schema({ user_id: { type: objectId, ref: 'User', required: true, index: true } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'student_progress', ...loose });
const TestResultSchema = new Schema({ user_id: { type: objectId, ref: 'User', required: true, index: true } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'test_results', ...loose });
const ChatHistorySchema = new Schema({ user_id: { type: objectId, ref: 'User', required: true, index: true } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'chat_history', ...loose });
const ActivityLogSchema = new Schema({ user_id: { type: objectId, ref: 'User', required: true, index: true }, action: String, page: String, metadata: { type: Schema.Types.Mixed, default: {} } }, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, collection: 'activity_log', ...loose });

export const User = models.User || model('User', UserSchema);
export const ChapterProgress = models.ChapterProgress || model('ChapterProgress', ChapterProgressSchema);
export const SkillProgress = models.SkillProgress || model('SkillProgress', SkillProgressSchema);
export const MockTest = models.MockTest || model('MockTest', MockTestSchema);
export const StudyActivity = models.StudyActivity || model('StudyActivity', StudyActivitySchema);
export const Vocabulary = models.Vocabulary || model('Vocabulary', VocabularySchema);
export const AppConfig = models.AppConfig || model('AppConfig', AppConfigSchema);
export const StudentProgress = models.StudentProgress || model('StudentProgress', StudentProgressSchema);
export const TestResult = models.TestResult || model('TestResult', TestResultSchema);
export const ChatHistory = models.ChatHistory || model('ChatHistory', ChatHistorySchema);
export const ActivityLog = models.ActivityLog || model('ActivityLog', ActivityLogSchema);
