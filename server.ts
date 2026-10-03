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
  const res = await axios.get('https://lottery.hk/zh-hk/mark-six/results/', {
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

interface SyncResult {
  success: boolean;
  updatedCount: number;
  totalDraws: number;
  latestDraw?: Draw;
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
  lastSyncTimestamp = Date.now();
  console.log(`Sync completed: ${updatedCount} draws updated. Latest: ${cachedDraws[0]?.draw_number} (${cachedDraws[0]?.date})`);

  return {
    success: true,
    updatedCount,
    totalDraws: cachedDraws.length,
    latestDraw: cachedDraws[0],
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
      nextDraw: {
        draw_number: "26/105",
        nameZh: "多寶攪珠",
        nameEn: "Rollover Draw",
        date: "2026-10-03",
        time: "21:30 HKT",
        estimatedFirstPrize: "HK$98,000,000",
        noteZh: "因中秋金多寶多寶累積，原定9月29日 (星期二) 及10月1日之常規攪珠暫停，累積至10月3日 (今晚) 攪珠。",
        noteEn: "Due to Mid-Autumn Snowball rollover, draws on 29 Sept & 1 Oct were postponed to 3 Oct with estimated HK$98M first prize."
      }
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
