import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from "fs";
import cors from "cors";

// Load Firebase Config
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

interface Draw {
  date: string;
  draw_number: string;
  n1: number;
  n2: number;
  n3: number;
  n4: number;
  n5: number;
  n6: number;
  extra_number: number;
}



let cachedDraws: Draw[] = [];
let isFetchingDraws = false;
let isSyncing = false;
let lastSyncTimestamp = 0;

async function refreshCache() {
  if (isFetchingDraws) return;
  isFetchingDraws = true;
  try {
    const drawsCol = collection(db, 'draws');
    const q = query(drawsCol, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    const newDraws: Draw[] = [];
    snapshot.forEach(docSnap => {
      newDraws.push(docSnap.data() as Draw);
    });
    cachedDraws = newDraws;
    console.log(`Cache refreshed with ${cachedDraws.length} draws from Firestore.`);
  } catch (err: any) {
    console.error("Error fetching draws from firestore", err.message);
  } finally {
    isFetchingDraws = false;
  }
}

// Scraper 1: Lottery.hk English (Fast, up to ~130 recent draws)
async function scrapeFromLotteryHk(): Promise<Draw[]> {
  const res = await axios.get('https://lottery.hk/en/mark-six/results/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    timeout: 10000,
    maxRedirects: 5
  });

  const $ = cheerio.load(res.data);
  const results: Draw[] = [];

  $('table tbody tr').each((_, row) => {
    const tds = $(row).find('td');
    if (tds.length >= 3) {
      const drawNum = $(tds[0]).text().trim();
      const rawDate = $(tds[1]).text().trim(); // e.g. "22/09/2026"
      const balls = $(tds[2]).find('li')
        .map((__, li) => parseInt($(li).text().trim()))
        .get()
        .filter(n => !isNaN(n) && n >= 1 && n <= 49);

      const dateParts = rawDate.split('/');
      if (dateParts.length === 3 && balls.length === 7 && drawNum) {
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        const mainBalls = balls.slice(0, 6).sort((a, b) => a - b);
        results.push({
          date: isoDate,
          draw_number: drawNum,
          n1: mainBalls[0],
          n2: mainBalls[1],
          n3: mainBalls[2],
          n4: mainBalls[3],
          n5: mainBalls[4],
          n6: mainBalls[5],
          extra_number: balls[6]
        });
      }
    }
  });

  return results;
}

// Scraper 2: Lottery.hk Traditional Chinese mirror
async function scrapeFromLotteryHkZh(): Promise<Draw[]> {
  const res = await axios.get('https://lottery.hk/liuhecai/jieguo/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    timeout: 10000,
    maxRedirects: 5
  });

  const $ = cheerio.load(res.data);
  const results: Draw[] = [];

  $('table tbody tr').each((_, row) => {
    const tds = $(row).find('td');
    if (tds.length >= 3) {
      const drawNum = $(tds[0]).text().trim();
      const rawDate = $(tds[1]).text().trim();
      const balls = $(tds[2]).find('li')
        .map((__, li) => parseInt($(li).text().trim()))
        .get()
        .filter(n => !isNaN(n) && n >= 1 && n <= 49);

      const dateParts = rawDate.split('/');
      if (dateParts.length === 3 && balls.length === 7 && drawNum) {
        const isoDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        const mainBalls = balls.slice(0, 6).sort((a, b) => a - b);
        results.push({
          date: isoDate,
          draw_number: drawNum,
          n1: mainBalls[0],
          n2: mainBalls[1],
          n3: mainBalls[2],
          n4: mainBalls[3],
          n5: mainBalls[4],
          n6: mainBalls[5],
          extra_number: balls[6]
        });
      }
    }
  });

  return results;
}

// Scraper 3: LotteryExtreme (Reliable independent backup source)
async function scrapeFromLotteryExtreme(): Promise<Draw[]> {
  const response = await axios.get('https://www.lotteryextreme.com/marksix/results', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    timeout: 12000
  });

  const $ = cheerio.load(response.data);
  const results: Draw[] = [];

  $('tr.cy').each((_, el) => {
    const text = $(el).text().trim();
    // e.g. "22/09/2026 Tuesday (26/103) Winners"
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})[^\(]+\(([\d\/]+)\)/);
    if (!match) return;

    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    const drawNum = match[4];

    const nextRow = $(el).next();
    const balls = nextRow.find('.displayball li')
      .map((__, li) => parseInt($(li).text().trim()))
      .get()
      .filter(n => !isNaN(n) && n >= 1 && n <= 49);

    if (balls.length === 7) {
      const mainBalls = balls.slice(0, 6).sort((a, b) => a - b);
      results.push({
        date: isoDate,
        draw_number: drawNum,
        n1: mainBalls[0],
        n2: mainBalls[1],
        n3: mainBalls[2],
        n4: mainBalls[3],
        n5: mainBalls[4],
        n6: mainBalls[5],
        extra_number: balls[6]
      });
    }
  });

  return results;
}

interface LatestPrizeMeta {
  drawDate: string;
  firstPrizeWinners: number;
  firstPrizeAmount: string;
  totalFund: string;
}

let cachedLatestPrizeMeta: LatestPrizeMeta | null = null;

async function scrapeLatestPrizeMeta(drawDate: string): Promise<LatestPrizeMeta | null> {
  try {
    const res = await axios.get(`https://lottery.hk/en/mark-six/results/${drawDate}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const $ = cheerio.load(res.data);
    let firstPrizeAmount = 'HK$8,000,000';
    let firstPrizeWinners = -1;
    let totalFund = '';

    $('table tr').each((_, tr) => {
      const tds = $(tr).find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (tds.length >= 5 && tds[0] === '1st') {
        firstPrizeAmount = tds[2] || 'HK$8,000,000';
        const parsedWinners = parseFloat(tds[3]?.replace(/,/g, '') || '0');
        if (!isNaN(parsedWinners)) {
          firstPrizeWinners = parsedWinners;
        }
        totalFund = tds[4] || '';
      }
    });

    if (firstPrizeWinners >= 0) {
      const meta = { drawDate, firstPrizeWinners, firstPrizeAmount, totalFund };
      cachedLatestPrizeMeta = meta;
      return meta;
    }
  } catch (e: any) {
    console.warn(`Could not fetch prize details for ${drawDate}:`, e.message);
  }
  return null;
}

function getNextDrawSchedule(latestDraw?: Draw) {
  // Determine current HKT date
  const nowHktStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });
  const nowHkt = new Date(nowHktStr);
  const todayIso = `${nowHkt.getFullYear()}-${String(nowHkt.getMonth() + 1).padStart(2, '0')}-${String(nowHkt.getDate()).padStart(2, '0')}`;

  // Compute next draw number from latest draw (e.g. "26/112" -> "26/113")
  let nextDrawNumber = '26/113';
  if (latestDraw?.draw_number) {
    const parts = latestDraw.draw_number.split('/');
    if (parts.length === 2) {
      const yr = parts[0];
      const seq = parseInt(parts[1], 10);
      if (!isNaN(seq)) {
        nextDrawNumber = `${yr}/${String(seq + 1).padStart(3, '0')}`;
      }
    }
  }

  // Start searching from whichever is later: latestDraw.date or yesterday in HKT
  const baseDateStr = (!latestDraw?.date || latestDraw.date < todayIso) ? todayIso : latestDraw.date;
  const [by, bm, bd] = baseDateStr.split('-').map(Number);
  const cursor = new Date(Date.UTC(by, bm - 1, bd));

  // If cursor is on or before latestDraw.date, or if cursor is today and HKT time is already past 21:35, advance at least 1 day
  const isPastDrawTimeToday = nowHkt.getHours() > 21 || (nowHkt.getHours() === 21 && nowHkt.getMinutes() >= 35);

  for (let i = 0; i < 14; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay(); // 0=Sun, 2=Tue, 4=Thu, 6=Sat
    const isStandardDrawDay = dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6 || dayOfWeek === 0;
    const isAfterLatest = !latestDraw?.date || iso > latestDraw.date;
    const isValidTodayOrFuture = iso > todayIso || (iso === todayIso && !isPastDrawTimeToday);

    // Standard Mark Six draws are Tue (2), Thu (4), and weekend (usually Sat (6), or Sun (0))
    if (isAfterLatest && isValidTodayOrFuture && (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6)) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const nextIso = cursor.toISOString().slice(0, 10);
  const [ny, nm, nd] = nextIso.split('-').map(Number);
  const dayOfWeek = cursor.getUTCDay();
  const weekdaysZh = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const isTonight = nextIso === todayIso;
  const dayLabelZh = `${ny}年${nm}月${nd}日 (${weekdaysZh[dayOfWeek]})${isTonight ? ' (今晚)' : ''}`;
  const dayLabelEn = `${nd} ${monthsEn[nm - 1]} ${ny} (${weekdaysEn[dayOfWeek]})${isTonight ? ' (Tonight)' : ''}`;

  const meta = (latestDraw && cachedLatestPrizeMeta?.drawDate === latestDraw.date) ? cachedLatestPrizeMeta : null;
  const isRollover = meta ? meta.firstPrizeWinners === 0 : false;

  const nameZh = isRollover ? '多寶攪珠' : '常規攪珠';
  const nameEn = isRollover ? 'Rollover Draw' : 'Regular Draw';
  const estimatedFirstPrize = isRollover ? 'HK$12,000,000+' : 'HK$8,000,000';

  const detailsZh = `第 ${nextDrawNumber} 期 ${nameZh} • ${dayLabelZh} 晚上 9:30（估計頭獎基金 ${estimatedFirstPrize}）`;
  const detailsEn = `Draw ${nextDrawNumber} ${nameEn} • ${dayLabelEn}, 21:30 HKT (Est. 1st Prize: ${estimatedFirstPrize})`;

  let noteZh = `截止售票時間：攪珠日晚上 9:15 HKT。`;
  let noteEn = `Ticket sales close at 21:15 HKT on draw day.`;

  if (latestDraw) {
    if (meta && meta.firstPrizeWinners > 0) {
      noteZh = `上期 (${latestDraw.draw_number}) 頭獎有 ${meta.firstPrizeWinners} 注中（每注派 ${meta.firstPrizeAmount}），下期頭獎基金回復至 HK$8,000,000。截止售票：晚上 9:15。`;
      noteEn = `Previous draw (${latestDraw.draw_number}) had ${meta.firstPrizeWinners} winning unit(s) (${meta.firstPrizeAmount}/unit). Next draw 1st prize resets to HK$8,000,000. Sales close at 21:15 HKT.`;
    } else if (meta && meta.firstPrizeWinners === 0) {
      noteZh = `上期 (${latestDraw.draw_number}) 無人中頭獎，多寶彩池累積滾存至下期攪珠！截止售票：晚上 9:15。`;
      noteEn = `No 1st Prize winner in Draw ${latestDraw.draw_number}; jackpot rolls over to the next draw! Sales close at 21:15 HKT.`;
    }
  }

  return {
    draw_number: nextDrawNumber,
    nameZh,
    nameEn,
    date: nextIso,
    time: "21:30 HKT",
    estimatedFirstPrize,
    detailsZh,
    detailsEn,
    noteZh,
    noteEn
  };
}

interface SyncResult {
  success: boolean;
  updatedCount: number;
  totalDraws: number;
  latestDraw?: Draw;
  nextDraw?: any;
  message: string;
  timestamp: number;
}

let activeSyncPromise: Promise<SyncResult> | null = null;

async function doSync(): Promise<SyncResult> {
  console.log("Starting Mark Six recent draws sync...");
  let scraped: Draw[] = [];
  
  // Try primary source 1: Lottery.hk EN
  try {
    scraped = await scrapeFromLotteryHk();
    if (scraped.length > 0) {
      console.log(`Lottery.hk EN returned ${scraped.length} draws.`);
    }
  } catch (e: any) {
    console.warn("Lottery.hk EN scrape failed:", e.message);
  }

  // Try primary source 2: Lottery.hk ZH
  if (scraped.length === 0) {
    try {
      scraped = await scrapeFromLotteryHkZh();
      if (scraped.length > 0) {
        console.log(`Lottery.hk ZH returned ${scraped.length} draws.`);
      }
    } catch (e: any) {
      console.warn("Lottery.hk ZH scrape failed:", e.message);
    }
  }

  // Fallback to LotteryExtreme
  if (scraped.length === 0) {
    try {
      scraped = await scrapeFromLotteryExtreme();
      if (scraped.length > 0) {
        console.log(`LotteryExtreme returned ${scraped.length} draws.`);
      }
    } catch (e: any) {
      console.warn("LotteryExtreme scrape failed:", e.message);
    }
  }

  if (scraped.length === 0) {
    throw new Error("All external draw sources failed or returned empty results.");
  }

  // Quick map of current cached draws
  const existingMap = new Map<string, Draw>();
  cachedDraws.forEach(d => {
    existingMap.set(d.draw_number, d);
  });

  let updatedCount = 0;
  for (const draw of scraped) {
    const existing = existingMap.get(draw.draw_number);
    const isNewOrDifferent = !existing || 
      existing.date !== draw.date ||
      existing.n1 !== draw.n1 ||
      existing.n2 !== draw.n2 ||
      existing.n3 !== draw.n3 ||
      existing.n4 !== draw.n4 ||
      existing.n5 !== draw.n5 ||
      existing.n6 !== draw.n6 ||
      existing.extra_number !== draw.extra_number;

    if (isNewOrDifferent) {
      const docId = draw.draw_number.replace(/\//g, "-");
      await setDoc(doc(db, 'draws', docId), draw, { merge: true });
      existingMap.set(draw.draw_number, draw);
      updatedCount++;
    }
  }

  await refreshCache();
  if (cachedDraws[0]?.date) {
    await scrapeLatestPrizeMeta(cachedDraws[0].date);
  }
  lastSyncTimestamp = Date.now();
  const nextDraw = getNextDrawSchedule(cachedDraws[0]);
  console.log(`Sync completed: ${updatedCount} draws updated. Latest: ${cachedDraws[0]?.draw_number} (${cachedDraws[0]?.date}), Next: ${nextDraw.draw_number} (${nextDraw.date})`);

  return {
    success: true,
    updatedCount,
    totalDraws: cachedDraws.length,
    latestDraw: cachedDraws[0],
    nextDraw,
    message: updatedCount > 0 
      ? `Successfully updated ${updatedCount} new draw(s). Latest: Draw ${cachedDraws[0]?.draw_number} (${cachedDraws[0]?.date})` 
      : `Records are up to date. Latest: Draw ${cachedDraws[0]?.draw_number} (${cachedDraws[0]?.date})`,
    timestamp: lastSyncTimestamp
  };
}

async function syncRecentDraws(): Promise<SyncResult> {
  if (activeSyncPromise) {
    // If a sync is already running, wait for it so all callers receive the freshly synced data
    return activeSyncPromise;
  }

  activeSyncPromise = doSync()
    .catch((err: any) => {
      console.error("Sync error:", err.message);
      return {
        success: false,
        updatedCount: 0,
        totalDraws: cachedDraws.length,
        latestDraw: cachedDraws[0],
        nextDraw: getNextDrawSchedule(cachedDraws[0]),
        message: `Failed to sync: ${err.message}`,
        timestamp: Date.now()
      };
    })
    .finally(() => {
      activeSyncPromise = null;
    });

  return activeSyncPromise;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/history", (req, res) => {
    const limitCount = req.query.limit ? parseInt(req.query.limit as string) : 50;
    // If cache hasn't synced in over 10 minutes, trigger background check
    if (Date.now() - lastSyncTimestamp > 10 * 60 * 1000) {
      syncRecentDraws().catch(console.error);
    }
    res.json(cachedDraws.slice(0, isNaN(limitCount) ? 50 : limitCount));
  });

  app.get("/api/stats", (req, res) => {
    const freqMap: Record<number, number> = {};
    const extraFreqMap: Record<number, number> = {};
    
    cachedDraws.forEach(draw => {
      [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6].forEach(n => {
        freqMap[n] = (freqMap[n] || 0) + 1;
      });
      extraFreqMap[draw.extra_number] = (extraFreqMap[draw.extra_number] || 0) + 1;
    });

    const stats = Object.entries(freqMap)
      .map(([num, freq]) => ({ num: parseInt(num), frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency);

    const extraStats = Object.entries(extraFreqMap)
      .map(([num, freq]) => ({ num: parseInt(num), frequency: freq }))
      .sort((a, b) => b.frequency - a.frequency);

    const oldestDrawDate = cachedDraws[cachedDraws.length - 1]?.date;
    const oldestYear = oldestDrawDate ? oldestDrawDate.split('-')[0] : '';

    res.json({
      main: stats,
      extra: extraStats,
      totalDraws: cachedDraws.length,
      oldestYear,
      latestDraw: cachedDraws[0],
      nextDraw: getNextDrawSchedule(cachedDraws[0]),
      lastSyncTimestamp
    });
  });

  app.post("/api/check", (req, res) => {
    const { numbers }: { numbers: number[] } = req.body;
    if (!numbers || numbers.length !== 6) {
      return res.status(400).json({ error: "Please provide exactly 6 numbers." });
    }

    const results = cachedDraws.map(draw => {
      const drawNumbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];
      const matchCount = numbers.filter(n => drawNumbers.includes(n)).length;
      const extraMatch = numbers.includes(draw.extra_number);

      let prize = "No Prize";
      if (matchCount === 6) prize = "1st Prize";
      else if (matchCount === 5 && extraMatch) prize = "2nd Prize";
      else if (matchCount === 5) prize = "3rd Prize";
      else if (matchCount === 4 && extraMatch) prize = "4th Prize";
      else if (matchCount === 4) prize = "5th Prize";
      else if (matchCount === 3 && extraMatch) prize = "6th Prize";
      else if (matchCount === 3) prize = "7th Prize";

      return {
        date: draw.date,
        draw_number: draw.draw_number,
        drawNumbers,
        extra: draw.extra_number,
        matchCount,
        extraMatch,
        prize
      };
    }).filter(r => r.prize !== "No Prize");

    const prizeOrder: Record<string, number> = {
      "1st Prize": 1,
      "2nd Prize": 2,
      "3rd Prize": 3,
      "4th Prize": 4,
      "5th Prize": 5,
      "6th Prize": 6,
      "7th Prize": 7
    };
    results.sort((a, b) => {
      const rankDiff = prizeOrder[a.prize] - prizeOrder[b.prize];
      if (rankDiff !== 0) return rankDiff;
      return b.date.localeCompare(a.date);
    });

    res.json({ wins: results });
  });

  // Explicit sync endpoint (awaited so caller immediately receives fresh state)
  app.post("/api/update", async (req, res) => {
    try {
      const result = await syncRecentDraws();
      res.json(result);
    } catch (err: any) {
      console.error("Update error:", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Background auto-sync endpoint (checks if 8 mins have passed, or if force=true)
  app.post("/api/auto-sync", async (req, res) => {
    try {
      const force = req.query.force === 'true' || req.body?.force === true;
      if (force || Date.now() - lastSyncTimestamp > 8 * 60 * 1000) {
        const result = await syncRecentDraws();
        return res.json(result);
      }
      res.json({
        success: true,
        updatedCount: 0,
        totalDraws: cachedDraws.length,
        latestDraw: cachedDraws[0],
        nextDraw: getNextDrawSchedule(cachedDraws[0]),
        message: "Data was recently synced.",
        timestamp: lastSyncTimestamp
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Status endpoint to check health and latest draw
  app.get("/api/status", (req, res) => {
    res.json({
      totalDraws: cachedDraws.length,
      latestDraw: cachedDraws[0],
      lastSyncTimestamp,
      nextDraw: getNextDrawSchedule(cachedDraws[0])
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-populate / refresh cache and promptly sync on startup
    refreshCache().then(() => {
      console.log("Initial startup sync checking for recent draws...");
      syncRecentDraws().catch(err => {
        console.error("Startup sync error:", err.message);
      });
    });

    // Smart periodic sync:
    // Check every 5 minutes normally.
    // If during HK draw hours (~21:15 to 22:30 HK time, UTC 13:15 to 14:30), check every 60 seconds.
    setInterval(() => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const isDrawWindow = (utcHours === 13 && utcMinutes >= 15) || (utcHours === 14 && utcMinutes <= 30);
      
      const intervalThreshold = isDrawWindow ? 60 * 1000 : 5 * 60 * 1000;
      if (Date.now() - lastSyncTimestamp >= intervalThreshold) {
        console.log(`Periodic scheduled sync running (isDrawWindow=${isDrawWindow})...`);
        syncRecentDraws().catch(err => {
          console.error("Periodic sync error:", err.message);
        });
      }
    }, 60 * 1000);
  });
}

startServer();
