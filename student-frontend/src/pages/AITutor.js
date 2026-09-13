// AITutor.js

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, Sparkles } from 'lucide-react'; 
import { aiApi } from '../api/client';
import { toast } from 'react-hot-toast'; 

function AITutor() {
  // Initialize messages from localStorage or use default
  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem('ai_tutor_chat');
    return savedMessages ? JSON.parse(savedMessages) : [
      { 
        content: "Hi there! 🦁 I'm your AI Study Buddy! Ask me anything about Math, Science, or History and I'll explain it simply! ✏️",
        role: 'assistant'
      }
    ];
  });
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('ai_tutor_chat', JSON.stringify(messages));
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const data = await aiApi.chat(userMsg.content);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error('RAG tutor error:', error);
      toast.error(error.message || 'AI tutor is unavailable right now.');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I could not reach my learning library just now. Please try again in a moment. 📚'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
      const defaultMsg = [{ role: 'assistant', content: "Chat cleared! What shall we learn next? 💡" }];
      setMessages(defaultMsg);
      localStorage.setItem('ai_tutor_chat', JSON.stringify(defaultMsg));
      toast.success("Memory wiped! 🧼");
  };

  return (
    <div className="page-container" style={{
        height: 'calc(100vh - 70px)', // Optimized for mobile viewport
        display: 'flex', 
        flexDirection: 'column', 
        maxWidth: '100%', 
        margin: '0 auto', 
        fontFamily: "'Comic Sans MS', 'Chalkboard SE', 'Comic Neue', sans-serif",
        backgroundColor: '#FFFBEB' // Very light warm background for whole page
    }}>
        
        {/* --- HEADER (Compact & Friendly) --- */}
        <header style={{
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '10px 15px', 
            backgroundColor: '#FFFAE0', 
            borderBottom: '3px solid #FFD700', 
            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
            zIndex: 10
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', 
                    background: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid #FFA500', flexShrink: 0,
                    boxShadow: '0 2px 0 #FFC107'
                }}>
                    <Bot size={24} color="#FFA500"/>
                </div>
                <div>
                    <h1 style={{
                        margin: 0, 
                        fontSize: '1.1rem', 
                        color: '#D97706', 
                        fontWeight: '800',
                        lineHeight: '1',
                        letterSpacing: '0.5px'
                    }}>
                        AI Buddy
                    </h1>
                    <span style={{
                        color: '#92400E', 
                        fontSize: '0.75rem', 
                        fontWeight: '600'
                    }}>
                        Always ready to help! 💡
                    </span>
                </div>
            </div>
            
            <button onClick={clearChat} style={{
                background: '#FFF0F5', 
                border: '2px solid #FF69B4', 
                color: '#FF1493', 
                width: '36px', 
                height: '36px',
                borderRadius: '12px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s',
                boxShadow: '0 3px 0 #FF69B4'
            }} 
            active={{ transform: 'translateY(3px)', boxShadow: 'none' }}
            title="Clear Chat">
                <Trash2 size={18}/>
            </button>
        </header>

        {/* --- CHAT AREA --- */}
        <div style={{
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            position: 'relative',
            background: '#F0F9FF', 
            backgroundImage: 'radial-gradient(#BFDBFE 1.5px, transparent 1.5px)',
            backgroundSize: '20px 20px'
        }}>
            
            {/* MESSAGES LIST */}
            <div style={{
                flex: 1, 
                overflowY: 'auto', 
                padding: '15px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '18px',
                paddingBottom: '20px'
            }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        display: 'flex', 
                        justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-end',
                        gap: '8px'
                    }}>
                        {/* BOT AVATAR/USER AVATAR */}
                        {(m.role === 'assistant') ? (
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: '#FFF', 
                                border: '2px solid #FFA500', flexShrink: 0, boxShadow: '0 2px 0 #FFA500',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px'
                            }}> <Bot size={18} color="#FFA500"/> </div>
                        ) : null}

                        {/* MESSAGE BUBBLE */}
                        <div style={{
                            maxWidth: '80%', 
                            padding: '12px 16px', 
                            borderRadius: '18px',
                            borderBottomLeftRadius: m.role === 'assistant' ? '4px' : '18px',
                            borderBottomRightRadius: m.role === 'user' ? '4px' : '18px',
                            background: m.role === 'user' ? '#38BDF8' : '#FFFFFF', 
                            border: m.role === 'user' ? '2px solid #0EA5E9' : '2px solid #FFA500',
                            color: m.role === 'user' ? '#FFFFFF' : '#333333',
                            boxShadow: '0 3px 0 rgba(0,0,0,0.1)', 
                            fontSize: '1rem', 
                            lineHeight: '1.4',
                            fontWeight: '500',
                            wordBreak: 'break-word',
                        }}>
                            {m.content}
                        </div>

                        {(m.role === 'user') ? (
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '50%', background: '#FFF', 
                                border: '2px solid #0EA5E9', flexShrink: 0, boxShadow: '0 2px 0 #0EA5E9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '4px'
                            }}> <User size={18} color="#0EA5E9"/> </div>
                        ) : null}
                    </div>
                ))}

                {/* LOADING INDICATOR */}
                {loading && (
                    <div style={{display: 'flex', alignItems: 'flex-end', gap: '8px', marginLeft: '5px'}}>
                        <div style={{
                            background: '#FFF', padding: '10px 16px', borderRadius: '20px',
                            borderBottomLeftRadius: '4px',
                            border: '2px solid #FFA500', 
                            color: '#F59E0B', 
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            boxShadow: '0 3px 0 rgba(0,0,0,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            Thinking <Sparkles size={16} className="animate-spin-slow"/>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT AREA */}
            <div style={{
                padding: '10px 15px 15px 15px', 
                background: 'linear-gradient(to bottom, rgba(240,249,255,0), #F0F9FF 20%)', 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center'
            }}>
                <div style={{
                    position: 'relative', 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center',
                    background: '#FFF',
                    borderRadius: '25px',
                    border: '3px solid #E2E8F0',
                    boxShadow: '0 4px 0 #CBD5E1',
                    transition: 'all 0.2s'
                }}>
                    <input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                        placeholder="Type your question here..." 
                        style={{
                            width: '100%', 
                            border: 'none', 
                            background: 'transparent',
                            padding: '12px 15px',
                            fontSize: '1rem', 
                            outline: 'none',
                            color: '#334155',
                            fontWeight: '500',
                            borderRadius: '25px'
                        }}
                        onFocus={(e) => {
                            e.target.parentElement.style.borderColor = '#38BDF8';
                            e.target.parentElement.style.boxShadow = '0 4px 0 #0EA5E9';
                        }}
                        onBlur={(e) => {
                            e.target.parentElement.style.borderColor = '#E2E8F0';
                            e.target.parentElement.style.boxShadow = '0 4px 0 #CBD5E1';
                        }}
                    />
                </div>
                
                <button 
                    onClick={sendMessage} 
                    disabled={!input.trim() || loading}
                    style={{
                        width: '50px', 
                        height: '50px', 
                        borderRadius: '16px', 
                        background: input.trim() ? '#22C55E' : '#E2E8F0', 
                        border: 'none',
                        cursor: input.trim() ? 'pointer' : 'default',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        transition: 'all 0.1s ease', 
                        boxShadow: input.trim() ? '0 4px 0 #15803D' : '0 4px 0 #94A3B8', 
                        transform: 'translateY(0)',
                        flexShrink: 0
                    }}
                    onMouseDown={(e) => {
                        if(input.trim()) {
                            e.currentTarget.style.transform = 'translateY(4px)';
                            e.currentTarget.style.boxShadow = '0 0 0 #15803D';
                        }
                    }}
                    onMouseUp={(e) => {
                        if(input.trim()) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 0 #15803D';
                        }
                    }}
                >
                    <Send size={24} color={input.trim() ? 'white' : '#94A3B8'} strokeWidth={2.5} style={{marginLeft: input.trim() ? '-2px' : '0'}}/>
                </button>
            </div>

        </div>
    </div>
  );
}

export default AITutor;