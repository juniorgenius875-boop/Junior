import React, { useState, useEffect } from 'react';
import { profileApi } from '../api/client';
import { 
    Edit3, Save, Smile, Star, Book, Briefcase, 
    Trophy, Zap, Medal
} from 'lucide-react';

function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  
  // Profile Data
  const [profile, setProfile] = useState({ 
    name: '', grade: '', school: '', favorite_subject: '', dream_job: '', hobbies: '' 
  });
  
  // Stats Data
  const [stats, setStats] = useState({ 
    totalTests: 0, bestScore: 0, averageScore: 0, level: 1 
  });

  useEffect(() => { fetchProfileData(); }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const [profileData, statsData] = await Promise.all([profileApi.get(), profileApi.stats()]);
      if (profileData) setProfile(profileData);
      if (statsData) setStats(statsData);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await profileApi.update(profile);
      setProfile(updated);
      setEditing(false);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });

  // --- HELPER: GET ANIMAL AVATAR ---
  const getAvatar = (name) => {
    const animals = ['🦁', '🦊', '🐼', '🐨', '🐯', '🐵', '🦄', '🐸', '🦉', '🦋', '🦖', '🐙', '🐬'];
    if (!name) return '🐣'; 
    const charSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return animals[charSum % animals.length];
  };

  // --- BADGE LOGIC ---
  const getBadges = () => {
    let badges = [];
    if (stats.totalTests >= 1) badges.push({ icon: "🐣", label: "Hatching", color: "#f0fdf4", border: "#4ade80" });
    if (stats.totalTests >= 5) badges.push({ icon: "🐢", label: "Slow & Steady", color: "#ecfccb", border: "#84cc16" });
    if (stats.totalTests >= 10) badges.push({ icon: "🏃", label: "Sprinter", color: "#fef08a", border: "#eab308" });
    if (stats.totalTests >= 25) badges.push({ icon: "🏋️", label: "Gym Rat", color: "#fed7aa", border: "#f97316" });
    if (stats.totalTests >= 50) badges.push({ icon: "🦾", label: "Iron Will", color: "#e7e5e4", border: "#78716c" });
    
    if (stats.bestScore >= 50) badges.push({ icon: "🥉", label: "Bronze Age", color: "#fff7ed", border: "#c2410c" });
    if (stats.bestScore >= 75) badges.push({ icon: "🥈", label: "Silver Star", color: "#f8fafc", border: "#94a3b8" });
    if (stats.bestScore >= 90) badges.push({ icon: "🥇", label: "Gold Rush", color: "#fef9c3", border: "#ca8a04" });
    if (stats.bestScore === 100) badges.push({ icon: "💎", label: "Perfectionist", color: "#eff6ff", border: "#2563eb" });
    
    if (stats.level >= 5) badges.push({ icon: "⚔️", label: "Warrior", color: "#f3e8ff", border: "#9333ea" });
    if (stats.level >= 10) badges.push({ icon: "🧙", label: "Wizard", color: "#e0e7ff", border: "#4f46e5" });
    
    if (profile.dream_job) badges.push({ icon: "🚀", label: "Visionary", color: "#f0fdfa", border: "#0d9488" });
    if (profile.favorite_subject) badges.push({ icon: "🤓", label: "Scholar", color: "#f5f3ff", border: "#7c3aed" });
    
    return badges;
  };

  if (loading) return <div style={{textAlign:'center', padding:'50px', fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif"}}><h2>Loading ID... 💳</h2></div>;

  return (
    <div style={{
        maxWidth: '1000px', 
        margin: '0 auto', 
        padding: '20px',
        paddingBottom: '80px', 
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif",
        backgroundColor: '#FFFBEB',
        minHeight: '100vh'
    }}>
      
      {/* --- ID CARD SECTION --- */}
      <div className="card" style={{
          padding: 0, overflow: 'hidden', border: 'none', position: 'relative', marginBottom: '25px',
          boxShadow: '0 8px 0 rgba(0, 0, 0, 0.1)',
          borderRadius: '25px', background: 'white',
          border: '3px solid #E0E7FF'
      }}>
        {/* Banner */}
        <div style={{height: '140px', background: 'linear-gradient(135deg, #818CF8 0%, #C084FC 100%)', position: 'relative'}}>
            <button 
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={saving}
                style={{
                    position: 'absolute', top: '15px', right: '15px',
                    background: 'rgba(255,255,255,0.3)', border: '2px solid rgba(255,255,255,0.5)',
                    color: 'white', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
                    backdropFilter: 'blur(4px)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px',
                    boxShadow: '0 3px 0 rgba(0,0,0,0.1)'
                }}
            >
                {saving ? "Saving..." : (editing ? <><Save size={18}/> Save</> : <><Edit3 size={18}/> Edit</>)}
            </button>
        </div>

        {/* Profile Content */}
        <div style={{padding: '0 20px 25px', marginTop: '-60px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            
            {/* ANIMAL AVATAR */}
            <div style={{
                width: '120px', height: '120px', background: 'white', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4.5rem',
                border: '6px solid white', boxShadow: '0 6px 12px rgba(0,0,0,0.1)', zIndex: 2
            }}>
                {getAvatar(profile.name)}
            </div>

            {/* Inputs or Display Text */}
            {editing ? (
                <div style={{width: '100%', maxWidth: '350px', marginTop: '15px', display:'flex', flexDirection:'column', gap:'12px'}}>
                    <input className="input-field" name="name" value={profile.name || ''} onChange={handleChange} placeholder="Your Name" 
                        style={{textAlign:'center', fontWeight:'bold', fontSize: '1.2rem', padding: '12px', borderRadius: '15px', border: '2px solid #CBD5E1', width: '100%', boxSizing: 'border-box'}}/>
                    <input className="input-field" name="grade" value={profile.grade || ''} onChange={handleChange} placeholder="Grade (e.g. 5)" 
                        style={{textAlign:'center', padding: '12px', borderRadius: '15px', border: '2px solid #CBD5E1', width: '100%', boxSizing: 'border-box'}}/>
                    <input className="input-field" name="school" value={profile.school || ''} onChange={handleChange} placeholder="School Name" 
                        style={{textAlign:'center', padding: '12px', borderRadius: '15px', border: '2px solid #CBD5E1', width: '100%', boxSizing: 'border-box'}}/>
                </div>
            ) : (
                <div style={{textAlign: 'center', marginTop: '15px'}}>
                    <h1 style={{margin: '0', fontSize: '2rem', color: '#1E293B', fontWeight: '800'}}>{profile.name || "Student"}</h1>
                    <p style={{margin: '5px 0 20px', color: '#64748B', fontSize: '1rem', fontWeight: '600'}}>
                        {profile.grade ? `Grade ${profile.grade}` : ""} {profile.school ? `• ${profile.school}` : ""}
                    </p>
                </div>
            )}
            
            {/* Stats Row */}
            <div style={{
                display: 'flex', justifyContent: 'space-around', width: '100%', maxWidth: '600px', 
                marginTop: '10px', background: '#F8FAFC', padding: '20px 10px', 
                borderRadius: '20px', border: '2px solid #E2E8F0',
                boxShadow: '0 4px 0 #E2E8F0'
            }}>
                <div style={{textAlign: 'center', flex:1}}>
                    <Zap size={24} color="#EAB308" style={{display:'block', margin:'0 auto 6px'}}/>
                    <strong style={{display:'block', fontSize:'1.4rem', color: '#0F172A'}}>{stats.level}</strong>
                    <span style={{fontSize:'0.8rem', color:'#64748B', textTransform:'uppercase', fontWeight: 'bold'}}>Level</span>
                </div>
                <div style={{width: '2px', background: '#E2E8F0'}}></div>
                <div style={{textAlign: 'center', flex:1}}>
                    <Trophy size={24} color="#3B82F6" style={{display:'block', margin:'0 auto 6px'}}/>
                    <strong style={{display:'block', fontSize:'1.4rem', color: '#0F172A'}}>{stats.totalTests}</strong>
                    <span style={{fontSize:'0.8rem', color:'#64748B', textTransform:'uppercase', fontWeight: 'bold'}}>Tests</span>
                </div>
                <div style={{width: '2px', background: '#E2E8F0'}}></div>
                <div style={{textAlign: 'center', flex:1}}>
                    <Medal size={24} color="#EC4899" style={{display:'block', margin:'0 auto 6px'}}/>
                    <strong style={{display:'block', fontSize:'1.4rem', color: '#0F172A'}}>{stats.bestScore}</strong>
                    <span style={{fontSize:'0.8rem', color:'#64748B', textTransform:'uppercase', fontWeight: 'bold'}}>Best</span>
                </div>
            </div>
        </div>
      </div>

      {/* --- INFO & BADGES GRID --- */}
      <div style={{
          display: 'flex', 
          flexDirection: 'row', 
          flexWrap: 'wrap',     
          gap: '20px'
      }}>
        
        {/* ABOUT ME CARD */}
        <div style={{
            flex: '1 1 300px', 
            background: 'white', padding: '25px', borderRadius: '25px',
            boxShadow: '0 6px 0 rgba(0, 0, 0, 0.05)',
            border: '2px solid #F1F5F9'
        }}>
            <h3 style={{display:'flex', alignItems:'center', gap:'10px', marginTop:0, color:'#334155', borderBottom: '2px solid #F1F5F9', paddingBottom: '15px', marginBottom: '20px', fontWeight: '800'}}>
                <Smile className="text-blue-500" size={24}/> About Me
            </h3>
            
            {editing ? (
                <div style={{display:'grid', gap:'15px'}}>
                    <div>
                        <label style={{fontSize:'0.9rem', fontWeight:'bold', color:'#64748B'}}>Dream Job</label>
                        <input name="dream_job" value={profile.dream_job || ''} onChange={handleChange} placeholder="e.g. Astronaut" 
                            style={{width: '100%', padding: '12px', marginTop: '5px', borderRadius: '12px', border: '2px solid #CBD5E1', boxSizing:'border-box'}}/>
                    </div>
                    <div>
                        <label style={{fontSize:'0.9rem', fontWeight:'bold', color:'#64748B'}}>Fav Subject</label>
                        <input name="favorite_subject" value={profile.favorite_subject || ''} onChange={handleChange} placeholder="e.g. Math" 
                            style={{width: '100%', padding: '12px', marginTop: '5px', borderRadius: '12px', border: '2px solid #CBD5E1', boxSizing:'border-box'}}/>
                    </div>
                    <div>
                        <label style={{fontSize:'0.9rem', fontWeight:'bold', color:'#64748B'}}>Hobbies</label>
                        <input name="hobbies" value={profile.hobbies || ''} onChange={handleChange} placeholder="e.g. Lego" 
                            style={{width: '100%', padding: '12px', marginTop: '5px', borderRadius: '12px', border: '2px solid #CBD5E1', boxSizing:'border-box'}}/>
                    </div>
                </div>
            ) : (
                <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                    <div style={{background: '#EFF6FF', padding: '15px', borderRadius: '15px', display:'flex', alignItems:'center', gap:'12px', border: '2px solid #DBEAFE'}}>
                        <Briefcase size={20} color="#3B82F6"/> 
                        <span style={{fontWeight:'600', color: '#1E3A8A', fontSize: '1.1rem'}}>{profile.dream_job || "Thinking..."}</span>
                    </div>
                    <div style={{background: '#FDF2F8', padding: '15px', borderRadius: '15px', display:'flex', alignItems:'center', gap:'12px', border: '2px solid #FCE7F3'}}>
                        <Book size={20} color="#EC4899"/> 
                        <span style={{fontWeight:'600', color: '#831843', fontSize: '1.1rem'}}>{profile.favorite_subject || "Recess"}</span>
                    </div>
                    <div style={{background: '#FFFBEB', padding: '15px', borderRadius: '15px', display:'flex', alignItems:'center', gap:'12px', border: '2px solid #FEF3C7'}}>
                        <Star size={20} color="#EAB308"/> 
                        <span style={{fontWeight:'600', color: '#78350F', fontSize: '1.1rem'}}>{profile.hobbies || "Exploring"}</span>
                    </div>
                </div>
            )}
        </div>

        {/* TROPHY CARD */}
        <div style={{
            flex: '2 1 300px', 
            background: 'white', padding: '25px', borderRadius: '25px',
            boxShadow: '0 6px 0 rgba(0, 0, 0, 0.05)',
            border: '2px solid #F1F5F9'
        }}>
            <h3 style={{display:'flex', alignItems:'center', gap:'10px', marginTop:0, color:'#334155', borderBottom: '2px solid #F1F5F9', paddingBottom: '15px', marginBottom: '20px', fontWeight: '800'}}>
                <Trophy size={24} color="#EAB308"/> Trophy Shelf
            </h3>
            
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '15px', 
                justifyContent: 'center' 
            }}>
                {getBadges().length > 0 ? getBadges().map((b, i) => (
                    <div key={i} style={{
                        background: `linear-gradient(to bottom right, ${b.color}, white)`,
                        border: `2px solid ${b.border}`,
                        borderRadius: '20px', width: '90px', height: '110px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 0 rgba(0,0,0,0.05)',
                        transition: 'transform 0.1s'
                    }}
                    >
                        <span style={{fontSize: '2.5rem', marginBottom: '5px'}}>{b.icon}</span>
                        <span style={{fontSize: '0.75rem', fontWeight: 'bold', color: '#334155', textAlign: 'center', lineHeight:'1.2', padding: '0 5px'}}>{b.label}</span>
                    </div>
                )) : (
                    <div style={{padding:'30px', textAlign:'center', color:'#94A3B8', fontStyle:'italic', width:'100%', fontSize: '1.1rem'}}>
                        No trophies yet! 🏆 <br/> Start a test to earn one!
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}

export default Profile;