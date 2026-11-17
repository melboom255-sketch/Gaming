import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  MIN_DEPOSIT_BIRR,
  MIN_WITHDRAWAL_BIRR,
  formatBirr,
} from '@/src/services/platformService';
import type {
  DepositRequest,
  TelebirrAgent,
  UserProfile,
  WithdrawalRequest,
} from '@/src/types/platform';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface WalletModalProps {
  initialTab?: 'deposit' | 'withdraw';
  currentUser: UserProfile | null;
  agents: TelebirrAgent[];
  minDepositEtb?: number;
  minWithdrawalEtb?: number;
  onClose: () => void;
  onSubmitDeposit: (params: {
    amountBirr: number;
    agentId: string;
    telebirrReference?: string;
    senderPhone?: string;
    screenshotDataUrl?: string;
    screenshotFileName?: string;
  }) => Promise<{ request?: DepositRequest; error?: string }>;
  onSubmitWithdrawal: (params: {
    amountBirr: number;
    telebirrPhone: string;
    recipientName: string;
  }) => Promise<{ request?: WithdrawalRequest; error?: string }>;
  onPromptSignIn: () => void;
}

const DEPOSIT_PRESETS = [5, 25, 100, 250];
const WITHDRAW_PRESETS = [10, 50, 100, 250];

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const maxDim = 920;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.74));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function WalletModal({
  initialTab = 'deposit',
  currentUser,
  agents,
  minDepositEtb = MIN_DEPOSIT_BIRR,
  minWithdrawalEtb = MIN_WITHDRAWAL_BIRR,
  onClose,
  onSubmitDeposit,
  onSubmitWithdrawal,
  onPromptSignIn,
}: WalletModalProps) {
  const effectiveMinDeposit = Math.max(1, minDepositEtb || MIN_DEPOSIT_BIRR);
  const effectiveMinWithdrawal = Math.max(1, minWithdrawalEtb || MIN_WITHDRAWAL_BIRR);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(initialTab);

  const activeAgents = agents.filter((a) => a.isActive);
  const selectableAgents = activeAgents.length > 0 ? activeAgents : agents;
  const defaultAgent =
    selectableAgents.find((a) => a.isPrimary) || selectableAgents[0] || null;

  // Deposit state
  const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgent?.id || '');
  const [amountBirr, setAmountBirr] = useState<number>(Math.max(effectiveMinDeposit, 25));
  const [telebirrReference, setTelebirrReference] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | undefined>();
  const [screenshotFileName, setScreenshotFileName] = useState<string | undefined>();
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [submittedDeposit, setSubmittedDeposit] = useState<DepositRequest | null>(null);

  // Withdrawal state
  const [withdrawAmountBirr, setWithdrawAmountBirr] = useState<number>(Math.max(effectiveMinWithdrawal, 50));
  const [withdrawPhone, setWithdrawPhone] = useState(currentUser?.phone || '');
  const [recipientName, setRecipientName] = useState(currentUser?.fullName || currentUser?.displayName || '');
  const [submittedWithdrawal, setSubmittedWithdrawal] =
    useState<WithdrawalRequest | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectableAgents.some((a) => a.id === selectedAgentId) && defaultAgent) {
      setSelectedAgentId(defaultAgent.id);
    }
  }, [selectableAgents, selectedAgentId, defaultAgent]);

  const chosenAgent =
    selectableAgents.find((a) => a.id === selectedAgentId) || defaultAgent;

  const copyAgentPhone = () => {
    if (!chosenAgent) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(chosenAgent.phone).catch(() => {});
    }
    setCopiedPhone(true);
    window.setTimeout(() => setCopiedPhone(false), 1800);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (PNG, JPG, or WEBP) of your Telebirr receipt.');
      return;
    }
    setProcessingFile(true);
    try {
      const compressed = await compressImageToDataUrl(file);
      setScreenshotDataUrl(compressed);
      setScreenshotFileName(file.name);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setProcessingFile(false);
    }
  };

  const handleDepositSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosenAgent) {
      setErrorMsg('No active Telebirr deposit agent available right now.');
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onSubmitDeposit({
        amountBirr,
        agentId: chosenAgent.id,
        telebirrReference,
        senderPhone,
        screenshotDataUrl,
        screenshotFileName,
      });
      if (res.error) setErrorMsg(res.error);
      else if (res.request) setSubmittedDeposit(res.request);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdrawalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await onSubmitWithdrawal({
        amountBirr: withdrawAmountBirr,
        telebirrPhone: withdrawPhone,
        recipientName,
      });
      if (res.error) setErrorMsg(res.error);
      else if (res.request) setSubmittedWithdrawal(res.request);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Telebirr Birr Wallet Deposit and Withdrawal"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#0F1324] border border-white/12 p-6 sm:p-7 my-auto relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close wallet modal"
          className="absolute top-4 right-4 min-h-[40px] min-w-[40px] rounded-xl bg-[#161B33] hover:bg-[#1E2544] text-slate-300 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {!currentUser ? (
          <div className="py-6 text-center space-y-4">
            <h2 className="text-2xl font-display font-bold text-white">
              Sign In to Access Wallet
            </h2>
            <p className="text-sm text-slate-300">
              Sign in or create an account to deposit Birr via Telebirr agents or withdraw winnings.
            </p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onPromptSignIn();
              }}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
            >
              Sign In / Register
            </button>
          </div>
        ) : submittedDeposit ? (
          <div className="py-4 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-300 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-display font-bold text-white">
                Deposit Proof Submitted
              </h2>
              <p className="text-sm text-slate-300">
                Your Telebirr receipt has been sent for verification. Once approved by an administrator,{' '}
                <span className="font-mono font-bold text-amber-300">
                  +{formatBirr(submittedDeposit.amountBirr)}
                </span>{' '}
                will be credited to your wallet.
              </p>
            </div>
            <div className="rounded-xl bg-[#090C18] border border-white/10 p-4 text-left text-xs space-y-2 tabular-nums">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Agent</span>
                <span className="text-white font-medium">
                  {submittedDeposit.agentName} ({submittedDeposit.agentPhone})
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Deposit Amount</span>
                <span className="font-mono text-white">
                  {formatBirr(submittedDeposit.amountBirr)}
                </span>
              </div>
              {submittedDeposit.telebirrReference && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Reference No.</span>
                  <span className="font-mono text-amber-300">
                    {submittedDeposit.telebirrReference}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Status</span>
                <span className="text-amber-300 font-semibold">Pending Verification</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : submittedWithdrawal ? (
          <div className="py-4 space-y-5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-400/40 flex items-center justify-center text-blue-300 mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-display font-bold text-white">
                Withdrawal Request Created
              </h2>
              <p className="text-sm text-slate-300">
                Your withdrawal of{' '}
                <span className="font-mono font-bold text-amber-300">
                  {formatBirr(submittedWithdrawal.amountBirr)}
                </span>{' '}
                is queued for Telebirr payout to{' '}
                <span className="font-mono text-white">{submittedWithdrawal.telebirrPhone}</span>.
              </p>
            </div>
            <div className="rounded-xl bg-[#090C18] border border-white/10 p-4 text-left text-xs space-y-2 tabular-nums">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Recipient</span>
                <span className="text-white font-medium">{submittedWithdrawal.recipientName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Telebirr Number</span>
                <span className="font-mono text-blue-300">{submittedWithdrawal.telebirrPhone}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Payout Amount</span>
                <span className="font-mono text-amber-300">
                  {formatBirr(submittedWithdrawal.amountBirr)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400">Status</span>
                <span className="text-amber-300 font-semibold">Pending Payout</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[44px] rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-xs text-amber-300 font-mono font-semibold tabular-nums">
                Available Balance: {formatBirr(currentUser.balanceBirr)}
              </div>
              <h2 className="text-2xl font-display font-bold text-white mt-1">
                Telebirr Birr Wallet
              </h2>
            </div>

            {/* Deposit / Withdraw Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#080B15] border border-white/8">
              <button
                type="button"
                onClick={() => {
                  setTab('deposit');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'deposit'
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Deposit Birr</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('withdraw');
                  setErrorMsg(null);
                }}
                className={`min-h-[40px] rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  tab === 'withdraw'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Withdraw Birr</span>
              </button>
            </div>

            {tab === 'deposit' ? (
              <form onSubmit={handleDepositSubmit} className="space-y-4">
                {/* Telebirr Agent Selector */}
                <div className="rounded-xl bg-[#0A0E1C] border border-amber-400/30 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-amber-300">
                      Step 1 · Choose Telebirr Agent
                    </span>
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      Min {effectiveMinDeposit} ETB · 1:1 ETB
                    </span>
                  </div>

                  {selectableAgents.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {selectableAgents.map((ag) => (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => setSelectedAgentId(ag.id)}
                          className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                            chosenAgent?.id === ag.id
                              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                              : 'bg-[#12172D] border-white/10 text-slate-300 hover:border-white/25'
                          }`}
                        >
                          {ag.name}
                          {ag.isPrimary ? ' (Primary)' : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  {chosenAgent ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#12172D] border border-white/8 px-3.5 py-2.5">
                        <div className="text-[11px] text-slate-400">Agent Name</div>
                        <div className="text-base font-display font-bold text-white mt-0.5">
                          {chosenAgent.name}
                        </div>
                        {chosenAgent.note && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {chosenAgent.note}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg bg-[#12172D] border border-white/8 px-3.5 py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] text-slate-400">Telebirr Number</div>
                          <div className="text-base font-mono font-bold text-amber-300 tabular-nums mt-0.5">
                            {chosenAgent.phone}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={copyAgentPhone}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#1A2140] hover:bg-[#232D56] text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedPhone ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-300">
                      No active Telebirr deposit agent configured. Please contact admin.
                    </div>
                  )}
                </div>

                {/* Amount in Birr */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-300">
                      Deposit Amount (Birr)
                    </label>
                    <span className="text-xs font-mono font-semibold text-amber-300 tabular-nums">
                      Credit: +{formatBirr(amountBirr || 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {Array.from(new Set([effectiveMinDeposit, ...DEPOSIT_PRESETS.filter((p) => p >= effectiveMinDeposit)])).slice(0, 4).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmountBirr(preset)}
                        className={`min-h-[38px] rounded-xl border text-xs font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
                          amountBirr === preset
                            ? 'bg-violet-600 border-violet-400 text-white'
                            : 'bg-[#090C18] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        {preset} ETB
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={effectiveMinDeposit}
                    max={100000}
                    step="0.5"
                    required
                    value={amountBirr}
                    onChange={(e) => setAmountBirr(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white tabular-nums focus:outline-none focus:border-violet-400"
                  />
                </div>

                {/* Reference or Screenshot */}
                <div className="space-y-3 pt-1 border-t border-white/10">
                  <div className="text-xs font-medium text-blue-300">
                    Step 2 · Upload Screenshot or Enter Reference No.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1.5">
                        Telebirr Reference No.
                      </label>
                      <input
                        type="text"
                        value={telebirrReference}
                        onChange={(e) => setTelebirrReference(e.target.value)}
                        placeholder="e.g. CEK8392014"
                        className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1.5">
                        Sender Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        placeholder="09xxxxxxxx"
                        className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-400"
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {screenshotDataUrl ? (
                      <div className="rounded-xl bg-[#090C18] border border-blue-400/35 p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={screenshotDataUrl}
                            alt="Uploaded Telebirr payment receipt"
                            className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {screenshotFileName || 'Payment Screenshot'}
                            </div>
                            <div className="text-[11px] text-emerald-300 mt-0.5">
                              Attached
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setScreenshotDataUrl(undefined);
                            setScreenshotFileName(undefined);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="min-h-[36px] min-w-[36px] rounded-lg bg-[#161B33] hover:bg-rose-500/20 text-slate-300 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processingFile}
                        className="w-full min-h-[76px] rounded-xl border border-dashed border-white/20 hover:border-violet-400/60 bg-[#090C18] hover:bg-[#0D1122] px-4 py-3 flex flex-col items-center justify-center gap-1 text-center transition-colors cursor-pointer"
                      >
                        {processingFile ? (
                          <Upload className="w-5 h-5 text-violet-300 animate-pulse" />
                        ) : (
                          <ImagePlus className="w-5 h-5 text-blue-300" />
                        )}
                        <span className="text-xs font-semibold text-slate-200">
                          {processingFile
                            ? 'Optimizing screenshot...'
                            : 'Tap to upload Telebirr receipt screenshot'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-400/35 px-4 py-3 text-xs text-rose-200">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || processingFile || !chosenAgent}
                  className="w-full min-h-[46px] rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Deposit Proof'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div className="rounded-xl bg-[#0A0E1C] border border-blue-400/25 p-4 text-xs text-slate-300 leading-relaxed">
                  Request a payout directly to your Ethiopian Telebirr account. Minimum withdrawal is{' '}
                  <span className="font-mono font-semibold text-white">
                    {formatBirr(effectiveMinWithdrawal)}
                  </span>
                  . Held ETB balances are refunded automatically if a request is rejected.
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-slate-300">
                      Amount to Withdraw (ETB)
                    </label>
                    <span className="text-xs font-mono font-semibold text-blue-300 tabular-nums">
                      Payout: {formatBirr(withdrawAmountBirr || 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {Array.from(new Set([effectiveMinWithdrawal, ...WITHDRAW_PRESETS.filter((p) => p >= effectiveMinWithdrawal)])).slice(0, 4).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWithdrawAmountBirr(preset)}
                        className={`min-h-[38px] rounded-xl border text-xs font-mono font-semibold tabular-nums transition-colors cursor-pointer ${
                          withdrawAmountBirr === preset
                            ? 'bg-blue-600 border-blue-400 text-white'
                            : 'bg-[#090C18] border-white/10 text-slate-300 hover:border-white/25'
                        }`}
                      >
                        {preset} ETB
                      </button>
                    ))}
                  </div>

                  <input
                    type="number"
                    min={effectiveMinWithdrawal}
                    max={Math.max(effectiveMinWithdrawal, Math.floor(currentUser.balanceBirr))}
                    step="0.5"
                    required
                    value={withdrawAmountBirr}
                    onChange={(e) => setWithdrawAmountBirr(Number(e.target.value))}
                    className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white tabular-nums focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Your Telebirr Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={withdrawPhone}
                    onChange={(e) => setWithdrawPhone(e.target.value)}
                    placeholder="0911223344"
                    className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Telebirr Account Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Full name registered on Telebirr"
                    className="w-full min-h-[44px] rounded-xl bg-[#090C18] border border-white/12 px-3.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-400"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-400/35 px-4 py-3 text-xs text-rose-200">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || currentUser.balanceBirr < effectiveMinWithdrawal}
                  className="w-full min-h-[46px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Submitting Request...'
                    : currentUser.balanceBirr < effectiveMinWithdrawal
                      ? `Need at least ${formatBirr(effectiveMinWithdrawal)} to withdraw`
                      : `Request ${formatBirr(withdrawAmountBirr || 0)} Withdrawal`}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
