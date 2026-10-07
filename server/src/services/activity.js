import { ActivityLog, User } from '../models/index.js';

export async function recordActivity(user, action, page = null, metadata = {}, createEvent = true) {
  const now = new Date();
  await User.updateOne({ _id: user._id }, { $set: { last_seen_at: now, last_activity_at: now, last_activity_type: action, current_page: page || user.current_page || null, updated_at: now } });
  if (createEvent) await ActivityLog.create({ user_id: user._id, action, page, metadata });
}
