import { useEffect, useRef, useState } from 'react';
import { GameStakeBar } from '@/src/components/games/GameStakeBar';
import {
  cashoutWagerOnServer,
  formatBirr,
  MIN_STAKE_BIRR,
  settleWagerOnServer,
  startWagerOnServer,
} from '@/src/services/platformService';
import type {
  ActiveWagerSession,
  GameCatalogItem,
  PlatformSnapshot,
  UserProfile,
} from '@/src/types/platform';
import { soundFx } from '@/src/utils/sound';
import { Banknote, CheckCircle2, Clock, Heart, Trophy, XCircle } from 'lucide-react';

interface TriviaQuizGameProps {
  game: GameCatalogItem;
  currentUser: UserProfile | null;
  onSnapshotSync: (snapshot: PlatformSnapshot) => void;
  onPromptSignIn: () => void;
  onPromptDeposit: () => void;
}

type TopicPack = 'All Topics' | 'Abyssinian Heritage' | 'Science & Logic' | 'World & Strategy';

interface TriviaQuestion {
  id: string;
  topic: Exclude<TopicPack, 'All Topics'>;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUESTION_BANK: TriviaQuestion[] = [
  {
    id: 'q1',
    topic: 'Abyssinian Heritage',
    prompt: 'Which ancient Ethiopian kingdom minted its own gold, silver, and bronze coins as early as the 3rd century CE?',
    options: ['Kingdom of Aksum', 'Zagwe Dynasty', 'Sultanate of Harar', 'Kingdom of Kaffa'],
    correctIndex: 0,
    explanation: 'The Aksumite Empire was among the earliest African civilizations to issue its own coinage.',
  },
  {
    id: 'q2',
    topic: 'Abyssinian Heritage',
    prompt: 'How many rock-hewn monolithic churches form the famous UNESCO complex in Lalibela?',
    options: ['7 churches', '11 churches', '14 churches', '9 churches'],
    correctIndex: 1,
    explanation: 'Lalibela is renowned for its 11 medieval monolithic churches carved downward from solid volcanic rock.',
  },
  {
    id: 'q3',
    topic: 'Abyssinian Heritage',
    prompt: 'In traditional Ethiopian chess (Senterej), how do both players open the match?',
    options: [
      'Simultaneously moving pieces until the first capture',
      'Always moving the central king first',
      'Rolling two wooden dice',
      'Drawing terrain cards before turn one',
    ],
    correctIndex: 0,
    explanation: 'Senterej features a fast-paced "werera" opening phase where players move simultaneously until the first capture.',
  },
  {
    id: 'q4',
    topic: 'Abyssinian Heritage',
    prompt: 'Which river feeds the dramatic Tis Abay waterfalls near Lake Tana?',
    options: ['Awash River', 'Blue Nile (Abay)', 'Omo River', 'Tekezé River'],
    correctIndex: 1,
    explanation: 'Tis Abay ("Great Smoke") sits along the Blue Nile shortly after it exits Lake Tana.',
  },
  {
    id: 'q5',
    topic: 'Science & Logic',
    prompt: 'If a fair 6-sided die is rolled twice, what is the probability that the sum of both rolls equals 7?',
    options: ['1/12', '1/6', '1/9', '5/36'],
    correctIndex: 1,
    explanation: 'Six of the 36 possible pairs (1+6, 2+5, 3+4, 4+3, 5+2, 6+1) sum to 7, which simplifies to 1/6.',
  },
  {
    id: 'q6',
    topic: 'Science & Logic',
    prompt: 'Which planet in our solar system rotates on its side with an axial tilt of roughly 98 degrees?',
    options: ['Neptune', 'Saturn', 'Uranus', 'Mars'],
    correctIndex: 2,
    explanation: 'Uranus has an extreme 98-degree axial tilt, causing it to roll along its orbital path.',
  },
  {
    id: 'q7',
    topic: 'Science & Logic',
    prompt: 'In algorithmic game theory, what algorithm guarantees optimal play in zero-sum games like Tic-Tac-Toe?',
    options: ['Minimax', 'Dijkstra', 'K-Means', 'Bubble Sort'],
    correctIndex: 0,
    explanation: 'Minimax evaluates future game states by minimizing the opponent’s maximum possible advantage.',
  },
  {
    id: 'q8',
    topic: 'Science & Logic',
    prompt: 'Which gas makes up approximately 78% of Earth’s atmosphere?',
    options: ['Oxygen', 'Argon', 'Nitrogen', 'Carbon Dioxide'],
    correctIndex: 2,
    explanation: 'Earth’s dry atmosphere is roughly 78% nitrogen and 21% oxygen.',
  },
  {
    id: 'q9',
    topic: 'World & Strategy',
    prompt: 'What is the maximum number of squares a knight can threaten from the center of an empty 8×8 chessboard?',
    options: ['4 squares', '6 squares', '8 squares', '10 squares'],
    correctIndex: 2,
    explanation: 'From any central square, a knight’s L-shaped jump reaches up to 8 distinct squares.',
  },
  {
    id: 'q10',
    topic: 'World & Strategy',
    prompt: 'Which African highland plateau is commonly called the "Roof of Africa"?',
    options: ['Drakensberg Range', 'Ethiopian Highlands', 'Atlas Mountains', 'Tibesti Massif'],
    correctIndex: 1,
    explanation: 'The Ethiopian Highlands contain the largest continuous area of high-altitude terrain in Africa.',
  },
  {
    id: 'q11',
    topic: 'World & Strategy',
    prompt: 'In traditional Mancala-style board games such as Gebeta, what is the primary mechanic?',
    options: [
      'Sowing seeds one-by-one around pits',
      'Rolling dice to climb ladders',
      'Matching hidden color tiles',
      'Bidding cards by suit',
    ],
    correctIndex: 0,
    explanation: 'Gebeta is a classic Ethiopian count-and-capture game played by sowing seeds sequentially across carved pits.',
  },
  {
    id: 'q12',
    topic: 'World & Strategy',
    prompt: 'Which ancient script is still actively used today for Amharic and Tigrinya?',
    options: ['Geʽez (Fidel)', 'Linear B', 'Cuneiform', 'Runic Futhark'],
    correctIndex: 0,
    explanation: 'The Geʽez abugida (Fidel) evolved in the Horn of Africa and remains widely used today.',
  },
];

function selectRoundQuestions(topic: TopicPack): TriviaQuestion[] {
  const pool =
    topic === 'All Topics'
      ? QUESTION_BANK
      : QUESTION_BANK.filter((q) => q.topic === topic);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(8, shuffled.length));
}

export function TriviaQuizGame({
  game,
  currentUser,
  onSnapshotSync,
  onPromptSignIn,
  onPromptDeposit,
}: TriviaQuizGameProps) {
  const minStake = Math.max(MIN_STAKE_BIRR, game.minStakeBirr || MIN_STAKE_BIRR);
  const [stakeBirr, setStakeBirr] = useState<number>(minStake);
  const [topic, setTopic] = useState<TopicPack>('All Topics');
  const [phase, setPhase] = useState<'MENU' | 'PLAYING' | 'SUMMARY'>('MENU');
  const [questions, setQuestions] = useState<TriviaQuestion[]>(() =>
    selectRoundQuestions('All Topics')
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [questionSeconds, setQuestionSeconds] = useState(18);
  const [timeLeft, setTimeLeft] = useState(18);
  const [correctCount, setCorrectCount] = useState(0);
  const [livesLeft, setLivesLeft] = useState(2);
  const [activeWager, setActiveWager] = useState<ActiveWagerSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState('');

  const wagerRef = useRef<ActiveWagerSession | null>(null);
  const settledRef = useRef(false);

  const currentQuestion = questions[currentIdx];
  const currentMultiplier =
    correctCount === 0
      ? 0.5
      : Math.min(
          game.maxMultiplier || 5,
          Math.round((0.5 + correctCount * 0.42) * 100) / 100
        );

  const startQuiz = async (chosenTopic: TopicPack = topic) => {
    setError(null);
    setBusy(true);
    try {
      const res = await startWagerOnServer({
        gameSlug: game.slug,
        stakeBirr,
      });
      onSnapshotSync(res.snapshot);
      wagerRef.current = res.wager;
      setActiveWager(res.wager);
      settledRef.current = false;

      const winPct = game.playerWinPercent ?? 30;
      const startingLives =
        res.wager.aiFavored && winPct < 65
          ? 1
          : winPct >= 55 || !res.wager.aiFavored
            ? 3
            : 2;
      const perQuestionSeconds = res.wager.aiFavored && winPct < 65 ? 12 : 20;

      setTopic(chosenTopic);
      setQuestions(selectRoundQuestions(chosenTopic));
      setCurrentIdx(0);
      setSelectedOption(null);
      setQuestionSeconds(perQuestionSeconds);
      setTimeLeft(perQuestionSeconds);
      setCorrectCount(0);
      setLivesLeft(startingLives);
      setSummaryText('');
      setPhase('PLAYING');
      soundFx.move();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start Trivia round.');
    } finally {
      setBusy(false);
    }
  };

  const handleLossOut = async (reason: string, finalCorrect: number) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    setPhase('SUMMARY');
    setSummaryText(`${reason} · Stake settled (0 Birr)`);
    if (wager) {
      const res = await settleWagerOnServer({
        wagerId: wager.id,
        outcome: 'loss',
        score: finalCorrect,
        challengeUpdates: { triviaCorrect: finalCorrect },
      });
      onSnapshotSync(res.snapshot);
    }
  };

  useEffect(() => {
    if (phase !== 'PLAYING' || selectedOption !== null) return;
    if (timeLeft <= 0) {
      setSelectedOption(-1);
      soundFx.error();
      const nextLives = livesLeft - 1;
      setLivesLeft(nextLives);
      if (nextLives <= 0) {
        void handleLossOut('Time expired & out of lives', correctCount);
      }
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, selectedOption, timeLeft]);

  const handleOptionSelect = (optionIdx: number) => {
    if (selectedOption !== null || !currentQuestion || phase !== 'PLAYING') return;
    setSelectedOption(optionIdx);
    if (optionIdx === currentQuestion.correctIndex) {
      setCorrectCount((c) => c + 1);
      soundFx.match();
    } else {
      soundFx.error();
      const nextLives = livesLeft - 1;
      setLivesLeft(nextLives);
      if (nextLives <= 0) {
        window.setTimeout(() => {
          void handleLossOut('Out of Trivia lives', correctCount);
        }, 700);
      }
    }
  };

  const handleCashout = async () => {
    const wager = wagerRef.current;
    if (!wager || settledRef.current || correctCount < 1) return;
    settledRef.current = true;
    setBusy(true);
    wagerRef.current = null;
    setActiveWager(null);
    soundFx.win();

    try {
      const res = await cashoutWagerOnServer({
        wagerId: wager.id,
        multiplier: currentMultiplier,
        score: correctCount,
        challengeUpdates: { triviaCorrect: correctCount },
      });
      onSnapshotSync(res.snapshot);
      setPhase('SUMMARY');
      setSummaryText(
        `Cashed out at ${res.multiplier.toFixed(2)}x with ${correctCount} correct! Won ${formatBirr(res.payoutBirr)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cashout failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleNextQuestion = async () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setTimeLeft(questionSeconds);
      soundFx.move();
      return;
    }

    if (settledRef.current) return;
    settledRef.current = true;
    const wager = wagerRef.current;
    wagerRef.current = null;
    setActiveWager(null);
    const wonRound = correctCount >= Math.ceil(questions.length * 0.5);

    if (wager) {
      const res = await settleWagerOnServer({
        wagerId: wager.id,
        outcome: wonRound ? 'win' : 'loss',
        score: correctCount,
        multiplier: currentMultiplier,
        challengeUpdates: { triviaCorrect: correctCount },
      });
      onSnapshotSync(res.snapshot);
      if (wonRound) {
        soundFx.win();
        setSummaryText(
          `Completed quiz with ${correctCount}/${questions.length} correct! Won ${formatBirr(res.payoutBirr)}`
        );
      } else {
        soundFx.error();
        setSummaryText(`Scored ${correctCount}/${questions.length}. Below passing threshold (0 Birr).`);
      }
    }
    setPhase('SUMMARY');
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-xl mx-auto">
      <GameStakeBar
        game={game}
        currentUser={currentUser}
        stakeBirr={stakeBirr}
        onChangeStake={setStakeBirr}
        activeWager={activeWager}
        isRoundRunning={phase === 'PLAYING'}
        isBusy={busy}
        currentMultiplier={currentMultiplier}
        canCashout={phase === 'PLAYING' && correctCount >= 1}
        cashoutDisabledReason="Answer 1+ question right to unlock Cash Out"
        onStartRound={() => void startQuiz(topic)}
        onCashout={() => void handleCashout()}
        onPromptSignIn={onPromptSignIn}
        onPromptDeposit={onPromptDeposit}
        startLabel="Start Quiz"
        error={error}
      />

      {phase === 'MENU' && (
        <div className="flex flex-col items-center gap-5 text-center py-2">
          <div className="space-y-1.5">
            <h4 className="text-xl font-display font-bold text-white">
              Select a Trivia Pack
            </h4>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
              Each correct answer boosts your multiplier (+0.42x). Cash Out between questions anytime before losing your lives!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {(
              ['All Topics', 'Abyssinian Heritage', 'Science & Logic', 'World & Strategy'] as TopicPack[]
            ).map((pack) => (
              <button
                key={pack}
                type="button"
                onClick={() => setTopic(pack)}
                className={`min-h-[52px] px-4 py-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  topic === pack
                    ? 'bg-violet-600/20 border-violet-400 text-white'
                    : 'bg-[#101426] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="text-sm font-semibold">{pack}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {pack === 'All Topics' ? '8 mixed questions' : 'Focused 4-question sprint'}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'SUMMARY' && (
        <div className="flex flex-col items-center gap-5 text-center py-4 rounded-2xl bg-[#101426] border border-white/10 p-6">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Trophy className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xl font-display font-bold text-white">Trivia Settled</h4>
            <p className="text-sm text-amber-200 font-semibold">{summaryText}</p>
          </div>
          <button
            type="button"
            onClick={() => setPhase('MENU')}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-[#171E3A] hover:bg-[#1E2648] border border-white/10 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Choose Another Pack
          </button>
        </div>
      )}

      {phase === 'PLAYING' && currentQuestion && (
        <>
          {/* Progress, Lives & Timer */}
          <div className="flex items-center justify-between gap-4 bg-[#101426] border border-white/10 rounded-xl px-4 py-3 text-sm tabular-nums">
            <div className="text-slate-300">
              Q{' '}
              <span className="font-mono font-bold text-white">
                {currentIdx + 1}/{questions.length}
              </span>
              <span className="mx-2 text-slate-500">·</span>
              <span className="text-xs text-violet-300">{currentQuestion.topic}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-rose-300 text-xs font-semibold">
                <Heart className="w-3.5 h-3.5" />
                <span>{livesLeft} lives</span>
              </div>
              <div
                className={`flex items-center gap-1.5 font-mono font-bold ${
                  timeLeft <= 5 ? 'text-rose-400' : 'text-blue-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{timeLeft}s</span>
              </div>
            </div>
          </div>

          {/* Prompt */}
          <div className="rounded-2xl bg-[#101426] border border-white/10 p-5 sm:p-6">
            <h4 className="text-lg sm:text-xl font-display font-semibold text-white leading-snug">
              {currentQuestion.prompt}
            </h4>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-2.5">
            {currentQuestion.options.map((opt, idx) => {
              const isAnswered = selectedOption !== null;
              const isCorrect = idx === currentQuestion.correctIndex;
              const isSelected = idx === selectedOption;

              let btnStyle =
                'bg-[#101426] border-white/10 text-slate-200 hover:border-violet-400/50 hover:bg-[#161C34]';
              if (isAnswered) {
                if (isCorrect) {
                  btnStyle = 'bg-emerald-500/15 border-emerald-400/60 text-emerald-100';
                } else if (isSelected) {
                  btnStyle = 'bg-rose-500/15 border-rose-400/60 text-rose-100';
                } else {
                  btnStyle = 'bg-[#0D1020] border-white/5 text-slate-500';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAnswered}
                  onClick={() => handleOptionSelect(idx)}
                  className={`min-h-[52px] w-full px-4 py-3 rounded-xl border text-left text-sm sm:text-base font-medium flex items-center justify-between gap-3 transition-colors cursor-pointer disabled:cursor-default ${btnStyle}`}
                >
                  <span>{opt}</span>
                  {isAnswered && isCorrect && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  {isAnswered && isSelected && !isCorrect && (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedOption !== null && livesLeft > 0 && (
            <div className="rounded-xl bg-[#12172E] border border-blue-400/25 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {selectedOption === -1 ? 'Time expired. ' : ''}
                {currentQuestion.explanation}
              </p>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {correctCount >= 1 && game.cashoutEnabled && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCashout()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash Out {currentMultiplier.toFixed(2)}x</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void handleNextQuestion()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
                >
                  {currentIdx + 1 < questions.length ? 'Next Question' : 'Finish Quiz'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
