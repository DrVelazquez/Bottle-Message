import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, UserPlus, LogIn, RefreshCw, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface AuthProps {
  onSuccess: (user: any) => void;
}

export default function Auth({ onSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Captcha state
  const [captcha, setCaptcha] = useState({ a: 0, b: 0, result: 0 });
  const [captchaInput, setCaptchaInput] = useState('');

  const generateCaptcha = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    setCaptcha({ a, b, result: a + b });
    setCaptchaInput('');
  };

  useEffect(() => {
    generateCaptcha();
  }, [isLogin]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate Captcha
    if (parseInt(captchaInput) !== captcha.result) {
      setError("Incorrect captcha answer.");
      generateCaptcha();
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onSuccess(data.user);
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) onSuccess(data.user);
      }
    } catch (err: any) {
      setError(err.message);
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F5F2ED]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 md:p-12 rounded-[2rem] shadow-xl border border-[#DED7C9]"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-light text-[#3D3D2D] mb-2">
            {isLogin ? 'Welcome Back' : 'Join the Ocean'}
          </h2>
          <p className="text-sm text-[#7A7A6A] italic">
            {isLogin ? 'Continue your journey' : 'Start casting your thoughts'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AFA99B]" />
              <input
                type="email"
                required
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#F9F8F6] border border-[#DED7C9] rounded-2xl focus:outline-none focus:border-[#5A5A40] transition-all font-light"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#AFA99B]" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-[#F9F8F6] border border-[#DED7C9] rounded-2xl focus:outline-none focus:border-[#5A5A40] transition-all font-light"
              />
            </div>
          </div>

          {/* Math Captcha */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#AFA99B]">Human Verification</span>
              <button type="button" onClick={generateCaptcha} className="text-[#AFA99B] hover:text-[#5A5A40] transition-colors p-1">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-stretch space-x-3 h-14">
              <div className="flex-1 flex items-center justify-center bg-[#F5F2ED] border border-[#DED7C9] rounded-xl text-lg font-serif text-[#3D3D2D] select-none">
                {captcha.a} + {captcha.b}
              </div>
              <div className="flex items-center justify-center text-[#AFA99B] font-light">=</div>
              <input
                type="number"
                required
                placeholder="?"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-24 px-4 bg-white border border-[#DED7C9] rounded-xl focus:outline-none focus:border-[#5A5A40] text-center text-lg transition-all"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center space-x-2 text-xs text-red-600 font-medium italic"
              >
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#3D3D2D] text-[#F5F2ED] rounded-2xl font-medium uppercase tracking-widest text-sm hover:bg-[#5A5A40] transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-[#7A7A6A] hover:text-[#3D3D2D] transition-colors underline underline-offset-4"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
