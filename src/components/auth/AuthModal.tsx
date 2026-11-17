import { useEffect, useState, type FormEvent } from 'react';
import { AVATAR_OPTIONS, AvatarBadge } from '@/src/components/common/AvatarBadge';
import type { AvatarId } from '@/src/types/platform';
import { Eye, EyeOff, Link2, ShieldCheck, X } from 'lucide-react';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  initialReferralCode?: string;
  isFirstAccount?: boolean;
  onClose: () => void;
  onLogin: (identifier: string, password: string) => Promise<string | null>;
  onRegister: (params: {
    email: string;
    password: string;
    confirmPassword: string;
    username: string;
    fullName: string;
    phone: string;
    referralCode?: string;
    displayName: string;
    avatarId: AvatarId;
  }) => Promise<string | null>;
}

export function AuthModal({
  initialMode = 'login',
  initialReferralCode = '',
  isFirstAccount = false,
  onClose,
  onLogin,
  onRegister,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(
    initialReferralCode ? 'register' : isFirstAccount && initialMode === 'login' ? 'register' : initialMode
  );
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [avatarId, setAvatarId] = useState<AvatarId>('lion');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialReferralCode) {
      setReferralCode(initialReferralCode.toUpperCase());
      setMode('register');
    }
  }, [initialReferralCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setErrorMsg('Password confirmation does not match.');
        return;
      }
      if (fullName.trim().length < 2) {
        setErrorMsg('Enter your full name.');
        return;
      }
      if (!phone.trim()) {
        setErrorMsg('Enter your Ethiopian phone number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const err =
        mode === 'login'
          ? await onLogin(identifier, password)
          : await onRegister({
              email,
              password,
              confirmPassword,
              username,
              fullName: fullName.trim(),
              phone: phone.trim(),
              referralCode: referralCode.trim() || undefined,
              displayName: fullName.trim(),
              avatarId,
            });
      if (err) {
        setErrorMsg(err);
      } else {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Abyssinia Games Sign In and Player Registration"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0F1324] border border-white/12 p-6 sm:p-7 my-auto relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 min-h-[40px] min-w-[40px] rounded-xl bg-[#161B33] hover:bg-[#1E2544] text-slate-300 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <h2 className="text-2xl font-display font-bold text-white">
            {mode === 'login' ? 'Sign In to Abyssinia Games' : 'Player Registration'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'login'
              ? 'Sign in with your email, username, or phone number.'
              : 'Every account starts as a verified player. Eligible players may later apply to become agents.'}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#080B15] border border-white/8 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`min-h-[40px] rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-violet-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register as Player
          </button>
        </div>

        {isFirstAccount && mode === 'register' && (
          <div className="mb-4 rounded-xl bg-amber-500/10 border border-amber-400/35 px-4 py-3 text-xs text-amber-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
            <span>
              Initial setup: the first registered account receives Administrator access.
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-400/35 px-4 py-3 text-xs sm:text-sm text-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Abebe Bikila"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="abebe_play"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0911223344"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 chars"
                      className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 pl-3.5 pr-10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Referral Code (Optional)
                </label>
                <div className="relative">
                  <Link2 className="w-4 h-4 text-amber-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. ABYAGENT12"
                    className="w-full min-h-[42px] rounded-xl bg-[#090C18] border border-white/12 pl-9 pr-3.5 text-sm font-mono uppercase text-amber-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Choose Player Emblem
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAvatarId(opt.id)}
                      className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                        avatarId === opt.id
                          ? 'bg-violet-600/20 border-amber-400'
                          : 'bg-[#090C18] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <AvatarBadge avatarId={opt.id} size="sm" />
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email, Username, or Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or 0911223344"
                  className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 pl-3.5 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[46px] rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign In'
                : 'Create Player Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
