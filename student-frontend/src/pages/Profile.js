import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { profileApi, progressApi, testsApi } from '../api/client';
import { PageLoader } from '../components/Loading';

const emptyProfile = { name: '', grade: '', school: '', favorite_subject: '', dream_job: '', hobbies: '' };

function Profile() {
  const [profile, setProfile] = useState(emptyProfile);
  const [stats, setStats] = useState({ totalTests: 0, bestScore: 0, averageScore: 0, level: 1 });
  const [latest, setLatest] = useState(null);
  const [tests, setTests] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([profileApi.get(), profileApi.stats(), progressApi.latest(), testsApi.listResults(8)])
      .then(([p, s, l, t]) => { setProfile({ ...emptyProfile, ...(p || {}) }); setStats(s || {}); setLatest(l || null); setTests(t || []); })
      .catch(err => toast.error(err.message || 'Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await profileApi.update(profile);
      setProfile({ ...emptyProfile, ...(updated || {}) });
      setEditing(false);
      toast.success('Profile updated');
    } catch (error) { toast.error(error.message || 'Could not save profile'); }
    finally { setSaving(false); }
  };

  if (loading) return <PageLoader rows={2} />;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div><h1>Profile</h1></div>
        <div className="page-actions">
          {editing && <button className="button secondary" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>}
          <button className="button primary" onClick={editing ? save : () => setEditing(true)} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Edit profile'}</button>
        </div>
      </div>

      <section className="content-grid wide-side">
        <div className="stack">
          <div className="panel">
            <div className="panel-body">
              <div className="profile-identity">
                <div className="profile-avatar">{(profile.name || 'S').slice(0, 2).toUpperCase()}</div>
                <div><h2>{profile.name || 'Student'}</h2><p>{profile.grade ? `Grade ${profile.grade}` : 'Grade not set'}{profile.school ? ` · ${profile.school}` : ''}</p></div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Learning summary</h2></div>
            <div className="info-list">
              <Info label="Tests completed" value={stats.totalTests || 0} />
              <Info label="Average score" value={`${stats.averageScore || 0}%`} />
              <Info label="Best score" value={`${stats.bestScore || 0}%`} />
              <Info label="Level" value={stats.level || 1} />
              <Info label="Predicted marks" value={latest?.total_predicted_marks ?? '—'} />
              <Info label="Risk" value={latest?.risk_level || '—'} />
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head"><h2>Student information</h2></div>
            <div className="panel-body">
              {editing ? (
                <div className="form-grid">
                  <Field label="Name"><input name="name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></Field>
                  <Field label="Grade"><input name="grade" value={profile.grade} onChange={e => setProfile({ ...profile, grade: e.target.value })} /></Field>
                  <Field label="School" full><input name="school" value={profile.school} onChange={e => setProfile({ ...profile, school: e.target.value })} /></Field>
                  <Field label="Favorite subject"><input name="favorite_subject" value={profile.favorite_subject} onChange={e => setProfile({ ...profile, favorite_subject: e.target.value })} /></Field>
                  <Field label="Dream job"><input name="dream_job" value={profile.dream_job} onChange={e => setProfile({ ...profile, dream_job: e.target.value })} /></Field>
                  <Field label="Hobbies" full><input name="hobbies" value={profile.hobbies} onChange={e => setProfile({ ...profile, hobbies: e.target.value })} /></Field>
                </div>
              ) : (
                <div className="info-list">
                  <Info label="Name" value={profile.name || '—'} />
                  <Info label="Grade" value={profile.grade || '—'} />
                  <Info label="School" value={profile.school || '—'} />
                  <Info label="Favorite subject" value={profile.favorite_subject || '—'} />
                  <Info label="Dream job" value={profile.dream_job || '—'} />
                  <Info label="Hobbies" value={profile.hobbies || '—'} />
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Recent assessments</h2></div>
            {tests.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Assessment</th><th>Difficulty</th><th>Score</th></tr></thead><tbody>{tests.map(t => <tr key={t.id}><td>{new Date(t.created_at).toLocaleDateString()}</td><td className="cell-main">{t.test_type}</td><td>{t.difficulty}</td><td>{t.score}/{t.total_marks}</td></tr>)}</tbody></table></div> : <div className="empty-state">No assessments completed.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, full, children }) { return <div className={`field ${full ? 'full' : ''}`}><label>{label}</label>{children}</div>; }
function Info({ label, value }) { return <div className="info-item"><span>{label}</span><strong>{value}</strong></div>; }

export default Profile;
