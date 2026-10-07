export function plain(doc, { keepUserId = true } = {}) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = obj._id ? String(obj._id) : obj.id;
  delete obj._id;
  delete obj.__v;
  if (obj.userId) obj.userId = String(obj.userId);
  if (obj.user_id) { obj.user_id = String(obj.user_id); if (!obj.userId) obj.userId = obj.user_id; }
  if (obj.created_at && !obj.createdAt) obj.createdAt = obj.created_at;
  if (obj.updated_at && !obj.updatedAt) obj.updatedAt = obj.updated_at;
  if (!keepUserId) { delete obj.userId; delete obj.user_id; }
  return { id, ...obj };
}

export function publicUser(doc) {
  const u = typeof doc?.toObject === 'function' ? doc.toObject() : { ...(doc || {}) };
  return {
    id: String(u._id || u.id),
    uid: String(u._id || u.id),
    email: u.email || '',
    role: u.role || 'student',
    active: (u.is_active ?? u.active) !== false,
    is_active: (u.is_active ?? u.active) !== false,
    name: u.profile?.name || '',
    profile: u.profile || {},
    createdAt: u.created_at || u.createdAt,
    created_at: u.created_at || u.createdAt,
    updatedAt: u.updated_at || u.updatedAt,
    lastLoginAt: u.last_login_at || u.lastLoginAt,
    lastSeenAt: u.last_seen_at || u.lastSeenAt,
    lastActivityAt: u.last_activity_at || u.lastActivityAt,
    lastActivityType: u.last_activity_type || u.lastActivityType,
    currentPage: u.current_page || u.currentPage,
  };
}
