import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Search, BarChart3, History, TrendingUp, Trophy, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Draw, Stat, CheckResult } from './types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const API_BASE_URL = window.location.hostname.includes('hkmarksixrecord.com') || window.location.hostname.includes('vercel.app')
  ? 'https://ais-pre-324afruy6prucldyh27tq6-496705720933.asia-northeast1.run.app'
  : '';

const prizeValues: Record<string, number> = {
  "1st Prize": 8000000,
  "2nd Prize": 500000,
  "3rd Prize": 50000,
  "4th Prize": 9600,
  "5th Prize": 640,
  "6th Prize": 320,
  "7th Prize": 40
};

const getBallColor = (num: number) => {
  const red = [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46];
  const blue = [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48];
  if (red.includes(num)) return "#d92027";
  if (blue.includes(num)) return "#1f65cc";
  return "#109b4d"; // green
};

const Ball: React.FC<{ num: number, size?: string, highlight?: boolean, extraClasses?: string, key?: React.Key }> = ({ num, size = "w-[30px] h-[30px]", highlight = false, extraClasses = "" }) => {
  const color = getBallColor(num);
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${size} ${extraClasses}`}>
      {highlight && (
        <div className="absolute inset-0 bg-yellow-300 rounded-full scale-[1.45] blur-[3px] opacity-100 z-0 shadow-[0_0_12px_4px_#facc15]" />
      )}
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm relative z-10" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill={color} />
        <circle cx="50" cy="50" r="44" fill="none" stroke="white" strokeWidth="8" strokeDasharray="30 50" transform="rotate(22 50 50)" />
        <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="4" />
        <circle cx="50" cy="50" r="28" fill="white" />
        <text x="50" y="66" fontFamily="Arial, Helvetica, sans-serif" fontSize="42" fontWeight="900" textAnchor="middle" fill="black" transform="rotate(-5 50 50)" style={{ letterSpacing: '-2px' }}>{num}</text>
      </svg>
    </div>
  );
};

const t = {
  en: {
    title: "HK Mark Six Historical Data",
    subtitle: "Historical Data Analysis",
    sync: "Sync Latest",
    updating: "Updating...",
    checkTab: "Check Numbers",
    statsTab: "Statistics",
    historyTab: "Recent Draws",
    checkTitle: "History Win Checker",
    checkDesc: "Enter your numbers to check if they have won in the past. Selection size: exactly 6 numbers.",
    clear: "Clear",
    checkWins: "Check Wins",
    results: "Results",
    priorWins: "Prior Wins",
    noWin: "This combination has never won a prize in our recorded history.",
    found: "Found!",
    wonOn: "This combination won the",
    onDraw: "on Draw",
    estTotal: "Total Estimated Winnings",
    estValue: "Est.",
    statsTitle: "Frequency Statistics (Top 15)",
    totalDraws: "TOTAL DRAWS",
    forecastTitle: "Highly Forecasted Draw",
    forecastDesc: "These 6 numbers have historically appeared the most across all drawn prizes.",
    recentTitle: "Recent Results",
    colDate: "Draw / Date",
    colNums: "Winning Numbers",
    colExtra: "Extra",
    prize: {
      "1st Prize": "1st Prize",
      "2nd Prize": "2nd Prize",
      "3rd Prize": "3rd Prize",
      "4th Prize": "4th Prize",
      "5th Prize": "5th Prize",
      "6th Prize": "6th Prize",
      "7th Prize": "7th Prize"
    }
  },
  'zh-HK': {
    title: "六合彩歷史數據",
    subtitle: "歷史數據分析",
    sync: "同步最新",
    updating: "更新中...",
    checkTab: "號碼核對",
    statsTab: "統計數據",
    historyTab: "近期攪珠",
    checkTitle: "歷史中獎核對",
    checkDesc: "輸入號碼以核對是否曾在過去中獎。請選擇剛好 6 個號碼。",
    clear: "清除",
    checkWins: "核對號碼",
    results: "結果",
    priorWins: "次記錄",
    noWin: "此組合在我們的記錄中從未中獎。",
    found: "！",
    wonOn: "此組合獲得",
    onDraw: "於 第",
    estTotal: "估計總獎金",
    estValue: "大約",
    statsTitle: "出現頻率統計（首15名）",
    totalDraws: "總期數",
    forecastTitle: "高頻預測組合",
    forecastDesc: "這 6 個號碼在所有歷史中獎結果中出現次數最高。",
    recentTitle: "近期攪珠結果",
    colDate: "期數 / 日期",
    colNums: "中獎號碼",
    colExtra: "特別號碼",
    prize: {
      "1st Prize": "頭獎",
      "2nd Prize": "二獎",
      "3rd Prize": "三獎",
      "4th Prize": "四獎",
      "5th Prize": "五獎",
      "6th Prize": "六獎",
      "7th Prize": "七獎"
    }
  }
};

const AppIcon = () => (
  <svg viewBox="0 0 100 100" className="w-12 h-12 shrink-0 drop-shadow-md" xmlns="http://www.w3.org/2000/svg">
    {/* Blue ball (8) */}
    <g transform="translate(5, 5)">
      <circle cx="28" cy="28" r="28" fill="#00bfff" />
      <circle cx="28" cy="28" r="25" fill="none" stroke="white" strokeWidth="6" strokeDasharray="15 24.2" transform="rotate(22 28 28)" />
      <circle cx="28" cy="28" r="28" fill="none" stroke="#00bfff" strokeWidth="4" />
      <circle cx="28" cy="28" r="15" fill="white" />
      <text x="28" y="36" fontFamily="Arial, Helvetica, sans-serif" fontSize="24" fontWeight="900" fontStyle="italic" textAnchor="middle" fill="black" transform="rotate(-15 28 28)">8</text>
    </g>
    
    {/* Red ball (1) */}
    <g transform="translate(50, 0)">
      <circle cx="22" cy="22" r="22" fill="#ff0000" />
      <circle cx="22" cy="22" r="19" fill="none" stroke="white" strokeWidth="5" strokeDasharray="10 19.8" transform="rotate(45 22 22)" />
      <circle cx="22" cy="22" r="22" fill="none" stroke="#ff0000" strokeWidth="3" />
      <circle cx="22" cy="22" r="13" fill="white" />
      <text x="22" y="28" fontFamily="Arial, Helvetica, sans-serif" fontSize="18" fontWeight="900" fontStyle="italic" textAnchor="middle" fill="black" transform="rotate(15 22 22)">1</text>
    </g>

    {/* Green ball (6) */}
    <g transform="translate(18, 30)">
      <circle cx="34" cy="34" r="34" fill="#00b050" />
      <circle cx="34" cy="34" r="30" fill="none" stroke="white" strokeWidth="7" strokeDasharray="20 27.1" transform="rotate(10 34 34)" />
      <circle cx="34" cy="34" r="34" fill="none" stroke="#00b050" strokeWidth="5" />
      <circle cx="34" cy="34" r="18" fill="white" />
      <text x="34" y="44" fontFamily="Arial, Helvetica, sans-serif" fontSize="30" fontWeight="900" textAnchor="middle" fill="black">6</text>
    </g>
  </svg>
);

const NumberSelector = ({ selected, onToggle, max, disabled }: { selected: number[], onToggle: (num: number) => void, max: number, disabled?: boolean }) => {
  return (
    <div className={`w-full flex flex-col items-center transition-all duration-300 ${disabled ? 'blur-[5px] opacity-60 pointer-events-none' : ''}`}>
      <div className={`flex gap-1.5 sm:gap-2 mb-6 min-h-12 bg-white p-3 rounded border border-[#e2e8f0] w-full max-w-md ${max === 6 ? 'justify-between' : 'justify-center'}`}>
        {Array.from({ length: max }).map((_, i) => {
          const displayNum = selected[i];
          return displayNum ? (
            <Ball key={`selected-${i}`} num={displayNum} size="w-9 h-9 sm:w-10 sm:h-10" />
          ) : (
            <div key={`empty-${i}`} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded flex items-center justify-center font-semibold text-lg bg-white border border-[#e2e8f0] text-slate-300">
              -
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2 max-w-sm w-full">
        {Array.from({ length: 49 }, (_, i) => i + 1).map(num => {
          const isSelected = selected.includes(num);
          return (
            <button
              key={`num-${num}`}
              onClick={() => onToggle(num)}
              disabled={(!isSelected && selected.length >= max) || disabled}
              className={`aspect-square w-full sm:w-10 sm:h-10 rounded flex items-center justify-center text-sm font-semibold transition-all ${isSelected ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-[#f8fafc] text-[#334155] hover:bg-[#e2e8f0] border border-[#e2e8f0]'} disabled:opacity-30`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState<'en' | 'zh-HK'>('zh-HK');
  const txt = t[lang];
  const [activeTab, setActiveTab] = useState<'check' | 'stats' | 'history' | 'secret'>('check');
  const [stats, setStats] = useState<{ main: Stat[], extra: Stat[], totalDraws: number } | null>(null);
  const [history, setHistory] = useState<Draw[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  // Checker State
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[] | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [secretTrigger, setSecretTrigger] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('secretTriggerV2') || '[10,20]'); } catch(e) { return [10,20]; }
  });
  const [secretForce, setSecretForce] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('secretForceV4') || '[9,12,17,23,33,41]'); } catch(e) { return [9,12,17,23,33,41]; }
  });
  const [secretPhase, setSecretPhase] = useState<number>(0);

  useEffect(() => {
    fetchHistory();
    fetchStats();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/history`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateMessage('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/update`, { method: 'POST' });
      const data = await res.json();
      setUpdateMessage(data.message);
      if (data.success) {
        fetchHistory();
        fetchStats();
      }
    } catch (e) {
      setUpdateMessage('Failed to connect to the server.');
    } finally {
      setIsUpdating(false);
      setTimeout(() => setUpdateMessage(''), 5000);
    }
  };

  const toggleNumber = (num: number) => {
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < 6) {
      setSelectedNumbers([...selectedNumbers, num].sort((a,b) => a - b));
    }
  };

  const toggleSecretTrigger = (num: number) => {
    if (secretTrigger.includes(num)) {
      const newVal = secretTrigger.filter(n => n !== num);
      setSecretTrigger(newVal);
      localStorage.setItem('secretTriggerV2', JSON.stringify(newVal));
    } else if (secretTrigger.length < 2) {
      const newVal = [...secretTrigger, num].sort((a,b) => a - b);
      setSecretTrigger(newVal);
      localStorage.setItem('secretTriggerV2', JSON.stringify(newVal));
    }
  };

  const toggleSecretForce = (num: number) => {
    if (secretForce.includes(num)) {
      const newVal = secretForce.filter(n => n !== num);
      setSecretForce(newVal);
      localStorage.setItem('secretForceV4', JSON.stringify(newVal));
    } else if (secretForce.length < 6) {
      const newVal = [...secretForce, num].sort((a,b) => a - b);
      setSecretForce(newVal);
      localStorage.setItem('secretForceV4', JSON.stringify(newVal));
    }
  };

  const handleClear = () => {
    if (selectedNumbers.length === 2 && secretTrigger.length === 2 && 
        selectedNumbers.includes(secretTrigger[0]) && selectedNumbers.includes(secretTrigger[1])) {
      setSecretPhase(1);
    }
    setSelectedNumbers([]);
    setCheckResults(null);
  };

  const handleCheck = () => {
    if (selectedNumbers.length !== 6) return;

    if (selectedNumbers.join(',') === '5,6,7,8,9,10') {
      setActiveTab('secret');
      setSecretPhase(0);
      setSelectedNumbers([]);
      setCheckResults(null);
      return;
    }

    let numbersToCheck = selectedNumbers;

    if (secretPhase === 2) {
      numbersToCheck = [...secretForce];
      setSecretPhase(0);
    } else if (secretPhase === 1) {
      setSecretPhase(2);
    }

    setIsChecking(true);
    
    setTimeout(() => {
      
      // Perform the API call after blur delay
      fetch(`${API_BASE_URL}/api/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: numbersToCheck })
      })
        .then(res => res.json())
        .then(data => {
          setCheckResults(data.wins || []);
          setTimeout(() => {
            setSelectedNumbers(numbersToCheck);
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        })
        .catch(e => {
          console.error(e);
          setCheckResults([]);
        })
        .finally(() => {
          setIsChecking(false);
        });
    }, 400);
  };

  const getForecast = () => {
    if (!stats || stats.main.length < 6) return [];
    return stats.main.slice(0, 6).map(s => s.num).sort((a,b) => a - b);
  };

  const totalWinnings = checkResults ? checkResults.reduce((sum, res) => sum + (prizeValues[res.prize] || 0), 0) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-slate-700 font-[Helvetica_Neue,Arial,sans-serif]">
      <header className="bg-[#1e293b] text-white px-6 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between border-b-4 border-[#b45309] gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <AppIcon />
          <div>
            <h1 className="text-[18px] font-bold m-0 leading-tight tracking-tight">{txt.title}</h1>
            <p className="text-[11px] opacity-80 m-0">{txt.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLang(l => l === 'en' ? 'zh-HK' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-transparent rounded text-xs font-semibold cursor-pointer transition-colors"
          >
            <Languages className="w-3 h-3" />
            {lang === 'en' ? '中文' : 'English'}
          </button>
          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-transparent rounded text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? txt.updating : txt.sync}
          </button>
        </div>
      </header>
      
      {updateMessage && (
        <div className="max-w-6xl mx-auto w-full pt-6 px-4 md:px-6">
          <div className="p-3 bg-[#f0fdf4] text-[#166534] rounded border border-[#bcf0da] text-sm font-medium shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {updateMessage}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 items-start pb-24 md:pb-6">
        
        {/* Sidebar Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#e2e8f0] flex flex-row justify-around p-2 pb-[env(safe-area-inset-bottom,0.5rem)] shadow-[0_-4px_10px_rgba(0,0,0,0.03)] md:shadow-none md:p-0 md:pb-0 md:bg-transparent md:border-none md:static md:col-span-3 md:flex-col md:gap-2 md:justify-start">
          <TabButton 
            active={activeTab === 'check'} 
            onClick={() => setActiveTab('check')}
            icon={<Search className="w-4 h-4" />}
            label={txt.checkTab}
          />
          <TabButton 
            active={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')}
            icon={<BarChart3 className="w-4 h-4" />}
            label={txt.statsTab}
          />
          <TabButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History className="w-4 h-4" />}
            label={txt.historyTab}
          />
        </nav>

        {/* Content Area */}
        <section className="md:col-span-9 bg-white border border-slate-200 rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col min-h-[600px]">
          <AnimatePresence mode="wait">
            
            {activeTab === 'check' && (
              <motion.div
                key="check"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full"
              >
                <div className="px-4 py-4 border-b border-slate-200 bg-[#f1f5f9] font-semibold text-sm uppercase tracking-[0.05em] text-[#64748b] flex justify-between">
                  <span>{txt.checkTitle}</span>
                </div>
                <div className="p-5 md:p-6">
                  <p className="text-[#64748b] text-[13px] mb-6">
                    {secretPhase > 0 ? txt.checkDesc.replace(/[。.]$/, '') : txt.checkDesc}
                  </p>
                  
                  <div className="flex flex-col items-center">
                    <NumberSelector 
                      selected={selectedNumbers} 
                      onToggle={toggleNumber} 
                      max={6} 
                      disabled={isChecking} 
                    />

                    <div className="flex gap-3 mt-6 w-full max-w-sm">
                      <button
                        onClick={handleClear}
                        disabled={selectedNumbers.length === 0}
                        className="px-4 py-3.5 bg-white border border-[#e2e8f0] text-[#64748b] rounded font-semibold cursor-pointer hover:bg-[#f8fafc] hover:text-[#1e293b] transition-colors flex items-center justify-center gap-2 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {txt.clear}
                      </button>
                      <button
                        onClick={handleCheck}
                        disabled={selectedNumbers.length !== 6 || isChecking}
                        className="px-4 py-3.5 bg-[#1e293b] text-white border-none rounded font-semibold cursor-pointer hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 flex-[2]"
                      >
                        {isChecking ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                        {txt.checkWins}
                      </button>
                    </div>
                  </div>
                </div>

                {checkResults !== null && (
                  <div ref={resultsRef} className="px-5 md:px-6 pb-6 pt-4 mt-6 border-t border-[#e2e8f0]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
                      <div>
                        <h3 className="text-[14px] font-semibold text-[#334155] mb-3">{txt.results} ({checkResults.length} {txt.priorWins})</h3>
                        <div className="flex gap-2">
                          {selectedNumbers.map(n => (
                            <div key={n} className="w-8 h-8 md:w-10 md:h-10 rounded flex items-center justify-center font-semibold text-[14px] md:text-lg bg-[#1e293b] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
                              {n}
                            </div>
                          ))}
                        </div>
                      </div>
                      {checkResults.length > 0 && (
                        <div className="text-left md:text-right">
                          <div className="text-[11px] text-[#64748b]">{txt.estTotal}</div>
                          <div className="text-[16px] font-bold text-[#b45309]">HK${totalWinnings.toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                    {checkResults.length === 0 ? (
                      <div className="text-center py-6 bg-[#f8fafc] rounded border border-[#e2e8f0]">
                        <p className="text-[#64748b] text-[13px]">{txt.noWin}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {checkResults.map((res, idx) => (
                          <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-[#f0fdf4] rounded border border-[#bcf0da] gap-4">
                            <div>
                              <div className="font-semibold text-[#15803d] mb-1 text-[14px] flex items-center justify-between md:justify-start gap-2">
                                <span>{(txt.prize as any)[res.prize] || res.prize} {txt.found}</span>
                                <span className="text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded text-[11px]">
                                  {txt.estValue} HK${(prizeValues[res.prize] || 0).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-[12px] text-[#166534] leading-snug">{txt.wonOn} {(txt.prize as any)[res.prize] || res.prize} {txt.onDraw} #{res.draw_number} ({res.date})</div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap shrink-0">
                              {res.drawNumbers.map((n, i) => (
                                <Ball key={i} num={n} size="w-[28px] h-[28px]" highlight={selectedNumbers.includes(n)} />
                              ))}
                              <div className="w-px h-6 bg-[#cbd5e1] mx-1"></div>
                              <Ball num={res.extra} size="w-[28px] h-[28px]" highlight={selectedNumbers.includes(res.extra)} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'stats' && stats && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full"
              >
                <div className="px-4 py-4 border-b border-[#e2e8f0] bg-[#f1f5f9] font-semibold text-sm uppercase tracking-[0.05em] text-[#64748b] flex justify-between">
                  <span>{txt.statsTitle}</span>
                  <span className="text-[10px]">{txt.totalDraws}: {stats.totalDraws}</span>
                </div>
                <div className="p-5 md:p-6 overflow-y-auto space-y-8">
                  <div className="p-5 bg-[#f8fafc] border border-[#e2e8f0] rounded mb-8 flex flex-col md:flex-row items-center gap-6 justify-between">
                    <div>
                      <h3 className="text-[#1e293b] font-semibold mb-1 flex items-center gap-2 text-[14px]">
                        <TrendingUp className="w-4 h-4 text-[#b45309]" /> {txt.forecastTitle}
                      </h3>
                      <p className="text-[#64748b] text-[12px]">
                        {txt.forecastDesc}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {getForecast().map((num, i) => (
                        <Ball key={i} num={num} size="w-8 h-8" />
                      ))}
                    </div>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.main.slice(0, 15)} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="num" tickLine={false} axisLine={false} fontSize={12} tickMargin={10} stroke="#64748b" />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#64748b" />
                        <Tooltip 
                          cursor={{ fill: '#f1f5f9' }} 
                          contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', fontSize: '13px' }}
                        />
                        <Bar dataKey="frequency" radius={[4, 4, 0, 0]}>
                          {stats.main.slice(0, 15).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index < 6 ? '#1e293b' : '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full"
              >
                <div className="px-4 py-4 border-b border-[#e2e8f0] bg-[#f1f5f9] font-semibold text-sm uppercase tracking-[0.05em] text-[#64748b] flex justify-between">
                  <span>{txt.recentTitle}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px] border-collapse">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0]">{txt.colDate}</th>
                        <th className="px-5 py-3 bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0]">{txt.colNums}</th>
                        <th className="px-5 py-3 bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#e2e8f0]">{txt.colExtra}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((draw, i) => (
                        <tr key={draw.draw_number} className="border-b border-[#e2e8f0] hover:bg-[#f8fafc]">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-medium text-[#1e293b]">{draw.draw_number}</div>
                            <div className="text-[11px] text-[#64748b] mt-0.5">{draw.date}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2 flex-wrap">
                              {[draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6].map((n, idx) => (
                                <Ball key={idx} num={n} size="w-[28px] h-[28px]" />
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <Ball num={draw.extra_number} size="w-[28px] h-[28px]" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'secret' && (
              <motion.div
                key="secret"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full bg-[#f8fafc]"
              >
                <div className="px-4 py-4 border-b border-[#e2e8f0] bg-[#f1f5f9] font-semibold text-sm uppercase tracking-[0.05em] text-[#64748b] flex justify-between">
                  <span>Secret Settings</span>
                </div>
                <div className="p-5 md:p-6 text-sm">
                  <div className="mb-6 bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col items-center">
                    <label className="block text-[#1e293b] font-semibold mb-4 w-full max-w-sm text-center">Trigger Numbers (2 numbers)</label>
                    <NumberSelector 
                      selected={secretTrigger} 
                      onToggle={toggleSecretTrigger} 
                      max={2} 
                    />
                    <p className="text-xs text-slate-500 mt-4 text-center max-w-sm">Input these 2 numbers in the main screen and press the Clear button to arm the exploit stealthily.</p>
                  </div>
                  <div className="mb-6 bg-white p-4 rounded border border-slate-200 shadow-sm flex flex-col items-center">
                    <label className="block text-[#1e293b] font-semibold mb-4 w-full max-w-sm text-center">Force Number Set (6 numbers)</label>
                    <NumberSelector 
                      selected={secretForce} 
                      onToggle={toggleSecretForce} 
                      max={6} 
                    />
                    <p className="text-xs text-slate-500 mt-4 text-center max-w-sm">After arming, the second time the target presses "Check Wins", their input will be forcefully swapped to this set.</p>
                  </div>
                  <div className="flex justify-center mt-8">
                    <button 
                      onClick={() => setActiveTab('check')} 
                      className="w-full max-w-sm px-6 py-3.5 bg-[#1e293b] text-white rounded font-semibold hover:bg-slate-800 transition-colors text-center text-base shadow-sm"
                    >
                      Save & Exit
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}

function TabButton({ active, label, icon, onClick }: { active: boolean, label: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-3 px-2 py-2 md:px-4 md:py-3 rounded md:font-semibold transition-all text-[11px] md:text-sm whitespace-nowrap flex-1 md:flex-none ${
        active 
        ? 'text-[#b45309] md:bg-[#1e293b] md:text-white md:shadow-[0_1px_3px_rgba(0,0,0,0.1)]' 
        : 'text-[#64748b] bg-transparent hover:bg-[#f8fafc] md:hover:bg-white md:hover:text-[#1e293b] md:border md:border-transparent md:hover:border-[#e2e8f0]'
      }`}
    >
      <span className="md:w-5 md:h-5 w-6 h-6 flex items-center justify-center md:*:w-5 md:*:h-5 *:w-6 *:h-6">{icon}</span>
      {label}
    </button>
  );
}
