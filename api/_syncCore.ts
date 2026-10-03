import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit } from "firebase/firestore";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

export interface Draw {
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

export interface SyncResult {
  success: boolean;
  updatedCount: number;
  totalDraws: number;
  latestDraw?: Draw;
  message: string;
  timestamp: number;
}

// Helper to get or initialize Firebase in serverless or node environments
export function getFirebaseDb() {
  if (getApps().length > 0) {
    const app = getApp();
    return getFirestore(app);
  }

  let firebaseConfig: any = null;

  // 1. Try reading firebase-applet-config.json from project root or cwd
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    // Ignore fs error on edge/serverless if path is restricted
  }

  // 2. Try environment variables
  if (!firebaseConfig) {
    if (process.env.FIREBASE_CONFIG) {
      try {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch (err) {
        console.warn("Failed to parse FIREBASE_CONFIG env");
      }
    } else if (process.env.VITE_FIREBASE_PROJECT_ID) {
      firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "ai-studio-e8b582c3-5d98-4e4c-83a1-ac01c6f5feb2",
      };
    }
  }

  // Default hardcoded fallback based on applet config if both above fail
  if (!firebaseConfig) {
    firebaseConfig = {
      projectId: "gen-lang-client-0857108717",
      appId: "1:534829867244:web:d45eef78802642bd38c5c9",
      apiKey: "AIzaSyDxv-uPZcJ1hiRMGNnab7gfdOaHOXtHVHU",
      authDomain: "gen-lang-client-0857108717.firebaseapp.com",
      firestoreDatabaseId: "ai-studio-e8b582c3-5d98-4e4c-83a1-ac01c6f5feb2",
      storageBucket: "gen-lang-client-0857108717.firebasestorage.app",
      messagingSenderId: "534829867244"
    };
  }

  const app = initializeApp(firebaseConfig);
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// Scraper 1: Lottery.hk English
export async function scrapeLotteryHkEn(): Promise<Draw[]> {
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
      const rawDate = $(tds[1]).text().trim(); // e.g. "26/09/2026"
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

// Scraper 2: Lottery.hk Traditional Chinese
export async function scrapeLotteryHkZh(): Promise<Draw[]> {
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

// Scraper 3: LotteryExtreme backup
export async function scrapeLotteryExtreme(): Promise<Draw[]> {
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

export async function fetchLiveDraws(): Promise<Draw[]> {
  // Try source 1
  try {
    const list = await scrapeLotteryHkEn();
    if (list.length > 0) return list;
  } catch (e: any) {
    console.warn("LotteryHkEn failed:", e.message);
  }

  // Try source 2
  try {
    const list = await scrapeLotteryHkZh();
    if (list.length > 0) return list;
  } catch (e: any) {
    console.warn("LotteryHkZh failed:", e.message);
  }

  // Try source 3
  try {
    const list = await scrapeLotteryExtreme();
    if (list.length > 0) return list;
  } catch (e: any) {
    console.warn("LotteryExtreme failed:", e.message);
  }

  return [];
}

export async function performDrawsSync(): Promise<SyncResult> {
  const db = getFirebaseDb();
  const scraped = await fetchLiveDraws();

  if (scraped.length === 0) {
    throw new Error("All external draw sources failed or returned empty results.");
  }

  // Fetch recent 30 draws from Firestore to check diff
  const drawsCol = collection(db, 'draws');
  const q = query(drawsCol, orderBy('date', 'desc'), limit(30));
  const snap = await getDocs(q);
  const existingMap = new Map<string, Draw>();
  snap.forEach(docSnap => {
    const d = docSnap.data() as Draw;
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

  // Get latest draw from Firestore
  const topQ = query(drawsCol, orderBy('date', 'desc'), limit(1));
  const topSnap = await getDocs(topQ);
  let latestDraw: Draw | undefined = undefined;
  topSnap.forEach(d => {
    latestDraw = d.data() as Draw;
  });

  return {
    success: true,
    updatedCount,
    totalDraws: scraped.length,
    latestDraw,
    message: updatedCount > 0 
      ? `Successfully updated ${updatedCount} new draw(s). Latest: Draw ${latestDraw?.draw_number || ''} (${latestDraw?.date || ''})` 
      : `Records are up to date. Latest: Draw ${latestDraw?.draw_number || ''} (${latestDraw?.date || ''})`,
    timestamp: Date.now()
  };
}

export function getUpcomingDrawInfo() {
  return {
    draw_number: "26/105",
    nameZh: "六合彩多寶攪珠",
    nameEn: "Mark Six Rollover Draw",
    date: "2026-10-03",
    time: "21:30 HKT",
    estimatedFirstPrize: "HK$98,000,000",
    noteZh: "因中秋金多寶頭獎無人中多寶累積，原定9月29日 (星期二) 及10月1日之常規攪珠暫停，累積至10月3日 (今晚) 攪珠。",
    noteEn: "Due to the Mid-Autumn Snowball rollover, draws on 29 Sept and 1 Oct were postponed to 3 Oct with estimated HK$98M first prize."
  };
}
