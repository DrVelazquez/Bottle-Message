import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Waves, MapPin, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  content: string;
  status: 'pending' | 'delivered';
  created_at: string;
  delivered_at?: string;
  delivered_location?: string;
}

export default function App() {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userId] = useState(() => {
    const saved = localStorage.getItem('bottle_user_id');
    if (saved) return saved;
    const newId = crypto.randomUUID();
    localStorage.setItem('bottle_user_id', newId);
    return newId;
  });

  useEffect(() => {
    fetchLastMessage();
  }, [userId]);

  const fetchLastMessage = async () => {
    try {
      const res = await fetch(`/api/my-last-message?userId=${userId}`);
      const data = await res.json();
      if (data.message) {
        setLastMessage(data.message);
      }
    } catch (err) {
      console.error('Failed to fetch last message', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message, userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSuccess(true);
      setMessage('');
      fetchLastMessage();
      
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#2C2C2C] font-serif selection:bg-[#E6E0D4]">
      {/* Background Waves Decoration */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] overflow-hidden">
        <svg className="absolute bottom-0 w-full h-64" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path fill="#2D5A27" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <main className="max-w-xl mx-auto px-6 py-16 md:py-24 relative z-10">
        {/* Header */}
        <header className="mb-20 text-center">
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block mb-6"
          >
            <Waves className="w-12 h-12 text-[#5A5A40] opacity-60" />
          </motion.div>
          <h1 className="text-4xl font-light tracking-tight mb-4 text-[#3D3D2D]">Message in a Bottle</h1>
          <p className="text-sm text-[#7A7A6A] font-light italic max-w-xs mx-auto leading-relaxed">
            "Throw your thoughts into the digital ocean. It will be read sometime, somewhere..."
          </p>
        </header>

        {/* Submission Form */}
        <section className="space-y-16">
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-[#E6E0D4] to-transparent rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here..."
                maxLength={140}
                disabled={isSubmitting}
                className={cn(
                  "relative w-full h-48 p-8 bg-white/80 backdrop-blur-sm border border-[#DED7C9] rounded-[1.5rem] resize-none focus:outline-none focus:border-[#5A5A40] transition-all duration-500 font-light leading-relaxed text-lg shadow-inner",
                  isSubmitting && "opacity-50 cursor-not-allowed"
                )}
              />
              <div className="absolute bottom-6 right-8 text-[10px] uppercase tracking-[0.2em] text-[#AFA99B] font-medium">
                {message.length} / 140
              </div>
            </div>

            <div className="flex flex-col items-center space-y-6">
              <button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className={cn(
                  "group relative flex items-center justify-center px-12 py-4 bg-[#3D3D2D] text-[#F5F2ED] rounded-full overflow-hidden transition-all duration-500 hover:bg-[#5A5A40] disabled:bg-[#D1CDC4] disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-95",
                )}
              >
                <span className="relative z-10 flex items-center space-x-3 text-sm tracking-[0.15em] uppercase font-medium">
                  {isSubmitting ? 'Casting...' : 'Cast Bottle'}
                  {!isSubmitting && <Send className="w-4 h-4 opacity-70 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />}
                </span>
              </button>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center space-x-2 text-xs text-[#8B4513] font-medium italic"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{error}</span>
                  </motion.div>
                )}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center space-x-2 text-xs text-[#5A5A40] font-medium italic"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Your message has been cast into the ocean.</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>

          {/* Status Section */}
          <div className="pt-16 border-t border-[#DED7C9]/50">
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-[#AFA99B] font-bold mb-12 text-center">Your Last Bottle</h2>
            
            {lastMessage ? (
              <div className="relative group">
                {/* Parchment Effect */}
                <motion.div 
                  initial={{ rotate: -1, scale: 0.98 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="relative bg-[#FFFDF7] border border-[#E8E2D5] p-10 md:p-14 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] rounded-sm overflow-hidden"
                  style={{
                    backgroundImage: 'radial-gradient(#E8E2D5 0.5px, transparent 0.5px)',
                    backgroundSize: '20px 20px'
                  }}
                >
                  {/* Torn Edge Effect (CSS only) */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E8E2D5] to-transparent opacity-20"></div>
                  
                  <div className="relative z-10 space-y-8">
                    <p className="text-2xl font-light leading-relaxed italic text-[#4A4A3A] text-center font-serif">
                      "{lastMessage.content}"
                    </p>
                    
                    <div className="flex flex-col items-center space-y-6 pt-8 border-t border-[#F0EBE0]">
                      {lastMessage.status === 'delivered' ? (
                        <div className="flex flex-col items-center space-y-3">
                          <div className="p-3 bg-[#F5F2ED] rounded-full">
                            <MapPin className="w-5 h-5 text-[#5A5A40]" />
                          </div>
                          <span className="text-xs font-medium tracking-widest uppercase text-[#5A5A40]">Received in {lastMessage.delivered_location}</span>
                          <span className="text-[10px] text-[#AFA99B] uppercase tracking-tighter">
                            {new Date(lastMessage.delivered_at!).toLocaleDateString()}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-4">
                          {/* Floating Bottle Illustration */}
                          <motion.div
                            animate={{ 
                              rotate: [0, 5, -5, 0],
                              y: [0, -8, 0]
                            }}
                            transition={{ 
                              duration: 5, 
                              repeat: Infinity, 
                              ease: "easeInOut" 
                            }}
                            className="relative"
                          >
                            <svg width="60" height="90" viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60 drop-shadow-md">
                              {/* Bottle Body */}
                              <path 
                                d="M20 15V8C20 6.89543 20.8954 6 22 6H38C39.1046 6 40 6.89543 40 8V15C40 16.1046 40.8954 17 42 17H45C50.5228 17 55 21.4772 55 27V75C55 80.5228 50.5228 85 45 85H15C9.47715 85 5 80.5228 5 75V27C5 21.4772 9.47715 17 15 17H18C19.1046 17 20 16.1046 20 15Z" 
                                stroke="#5A5A40" 
                                strokeWidth="2"
                                fill="white"
                                fillOpacity="0.3"
                              />
                              
                              {/* Water inside */}
                              <path 
                                d="M5.5 60C5.5 60 15 55 30 60C45 65 54.5 60 54.5 60V75C54.5 80.5228 50.0228 85 44.5 85H15.5C9.97715 85 5.5 80.5228 5.5 75V60Z" 
                                fill="#2D5A27" 
                                fillOpacity="0.15"
                              />
                              
                              {/* Cork */}
                              <rect x="22" y="2" width="16" height="6" rx="1" fill="#8B4513" fillOpacity="0.6" />
                              
                              {/* Paper inside */}
                              <motion.rect 
                                x="18" y="35" width="24" height="35" rx="2" 
                                fill="#FFFDF7" 
                                stroke="#5A5A40" 
                                strokeWidth="0.5"
                                animate={{ rotate: [-2, 2, -2] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                              />
                              <line x1="22" y1="45" x2="38" y2="45" stroke="#5A5A40" strokeWidth="0.5" strokeOpacity="0.3" />
                              <line x1="22" y1="52" x2="38" y2="52" stroke="#5A5A40" strokeWidth="0.5" strokeOpacity="0.3" />
                              <line x1="22" y1="59" x2="38" y2="59" stroke="#5A5A40" strokeWidth="0.5" strokeOpacity="0.3" />
                            </svg>
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-2 bg-[#5A5A40] blur-lg opacity-10"></div>
                          </motion.div>
                          <div className="flex items-center space-x-2 text-[#AFA99B]">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Waiting to be found...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
                
                {/* Shadow/Depth */}
                <div className="absolute -bottom-2 -right-2 w-full h-full bg-[#E8E2D5] -z-10 rounded-sm opacity-50"></div>
              </div>
            ) : (
              <div className="text-center py-20 border-2 border-dashed border-[#DED7C9] rounded-[2rem]">
                <p className="text-sm text-[#AFA99B] italic font-light">The horizon is empty.</p>
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-40 text-center space-y-6">
          <div className="w-12 h-px bg-[#DED7C9] mx-auto"></div>
          <p className="text-[10px] text-[#AFA99B] tracking-[0.4em] uppercase font-bold">
            Slow Tech &bull; Anonymous &bull; ephemeral
          </p>
        </footer>
      </main>
    </div>
  );
}
