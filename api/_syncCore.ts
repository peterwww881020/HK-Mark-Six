import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, orderBy, limit, Firestore } from "firebase/firestore";
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
  nextDraw?: any;
  message: string;
  timestamp: number;
}

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "gen-lang-client-0857108717",
  appId: "1:534829867244:web:d45eef78802642bd38c5c9",
  apiKey: "AIzaSyDxv-uPZcJ1hiRMGNnab7gfdOaHOXtHVHU",
  authDomain: "gen-lang-client-0857108717.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-e8b582c3-5d98-4e4c-83a1-ac01c6f5feb2",
  storageBucket: "gen-lang-client-0857108717.firebasestorage.app",
  messagingSenderId: "534829867244"
};

function resolveFirebaseConfig() {
  let firebaseConfig: any = null;

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }
  } catch {
    // Ignore fs error on serverless if path is restricted
  }

  if (!firebaseConfig) {
    if (process.env.FIREBASE_CONFIG) {
      try {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch {
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
        firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
      };
    }
  }

  return firebaseConfig || DEFAULT_FIREBASE_CONFIG;
}

// Helper to get or initialize Firebase in serverless or node environments
export function getFirebaseDb(): Firestore {
  const firebaseConfig = resolveFirebaseConfig();
  const dbId = firebaseConfig.firestoreDatabaseId || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId;
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getFirestore(app, dbId);
}

// Parse Mark Six CSV format: draw_id,DD/MM/YYYY,"n1,n2,n3,n4,n5,n6",extra,...
export function parseMarkSixCsv(content: string): Draw[] {
  const lines = content.trim().split(/\r?\n/);
  const parsed: Draw[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const m = line.match(/^([^,]+),(\d{2})\/(\d{2})\/(\d{4}),"([\d,]+)",(\d+)/);
    if (!m) continue;

    const rawId = m[1].trim();
    const isoDate = `${m[4]}-${m[3]}-${m[2]}`;
    const nums = m[5].split(",").map(Number).sort((a, b) => a - b);
    const extra_number = parseInt(m[6], 10);
    if (nums.length !== 6 || nums.some(isNaN) || isNaN(extra_number)) continue;

    const idMatch = rawId.match(/^(\d{4})(\d{1,3})/);
    const draw_number = idMatch ? `${idMatch[1].slice(2)}/${idMatch[2].padStart(3, "0")}` : rawId;

    parsed.push({
      date: isoDate,
      draw_number,
      n1: nums[0],
      n2: nums[1],
      n3: nums[2],
      n4: nums[3],
      n5: nums[4],
      n6: nums[5],
      extra_number,
    });
  }

  return parsed.sort((a, b) => b.date.localeCompare(a.date));
}

let cachedCsvDraws: Draw[] | null = null;

export function loadBaselineCsvDraws(): Draw[] {
  if (cachedCsvDraws && cachedCsvDraws.length > 0) return cachedCsvDraws;
  try {
    const candidates = [
      path.join(process.cwd(), "public/assets/aistudio/mark6_history_ace94645.csv"),
      path.join(process.cwd(), "dist/assets/aistudio/mark6_history_ace94645.csv"),
    ];
    for (const csvPath of candidates) {
      if (fs.existsSync(csvPath)) {
        const parsed = parseMarkSixCsv(fs.readFileSync(csvPath, "utf8"));
        if (parsed.length > 0) {
          cachedCsvDraws = parsed;
          return parsed;
        }
      }
    }
  } catch (err: any) {
    console.warn("Could not load baseline CSV:", err.message);
  }
  return [];
}

// Fast loader: merges 4,390-draw 1993–2026 baseline CSV with latest 200 Firestore draws.
// Falls back to full Firestore collection query if CSV is unavailable on disk.
export async function loadAllDraws(db: Firestore): Promise<Draw[]> {
  const baseline = loadBaselineCsvDraws();
  const drawMap = new Map<string, Draw>();

  if (baseline.length >= 1000) {
    for (const d of baseline) {
      drawMap.set(d.draw_number, d);
    }
    const q = query(collection(db, "draws"), orderBy("date", "desc"), limit(200));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const d = docSnap.data() as Draw;
      if (d && d.draw_number) {
        drawMap.set(d.draw_number, d);
      }
    });
  } else {
    const q = query(collection(db, "draws"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    snap.forEach((docSnap) => {
      const d = docSnap.data() as Draw;
      if (d && d.draw_number) {
        drawMap.set(d.draw_number, d);
      }
    });
  }

  return Array.from(drawMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function computeStatsSummary(draws: Draw[]) {
  const freqMap: Record<number, number> = {};
  const extraFreqMap: Record<number, number> = {};

  draws.forEach((draw) => {
    [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6].forEach((n) => {
      freqMap[n] = (freqMap[n] || 0) + 1;
    });
    extraFreqMap[draw.extra_number] = (extraFreqMap[draw.extra_number] || 0) + 1;
  });

  const main = Object.entries(freqMap)
    .map(([num, freq]) => ({ num: parseInt(num, 10), frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency);

  const extra = Object.entries(extraFreqMap)
    .map(([num, freq]) => ({ num: parseInt(num, 10), frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency);

  const oldestDrawDate = draws[draws.length - 1]?.date;
  const oldestYear = oldestDrawDate ? oldestDrawDate.split("-")[0] : "1993";

  return {
    main,
    extra,
    totalDraws: draws.length,
    oldestYear,
    latestDraw: draws[0] || null,
  };
}

export async function getOrComputeStatsSummary(db: Firestore) {
  try {
    const summarySnap = await getDoc(doc(db, "meta", "stats"));
    if (summarySnap.exists()) {
      const data = summarySnap.data() as any;
      if (data.main && Array.isArray(data.main) && data.totalDraws >= 1000) {
        return data;
      }
    }
  } catch (err: any) {
    console.warn("Could not read meta/stats:", err.message);
  }

  const allDraws = await loadAllDraws(db);
  const summary = computeStatsSummary(allDraws);
  const nextDraw = getNextDrawSchedule(allDraws[0]);
  const payload = { ...summary, nextDraw, updatedAt: Date.now() };

  if (allDraws.length >= 1000) {
    try {
      await setDoc(doc(db, "meta", "stats"), payload);
    } catch {
      // Non-fatal
    }
  }
  return payload;
}

interface LatestPrizeMeta {
  drawDate: string;
  firstPrizeWinners: number;
  firstPrizeAmount: string;
  totalFund: string;
}

let cachedLatestPrizeMeta: LatestPrizeMeta | null = null;

export async function scrapeLatestPrizeMeta(drawDate: string): Promise<LatestPrizeMeta | null> {
  try {
    const res = await axios.get(`https://lottery.hk/en/mark-six/results/${drawDate}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 8000,
    });
    const $ = cheerio.load(res.data);
    let firstPrizeAmount = "HK$8,000,000";
    let firstPrizeWinners = -1;
    let totalFund = "";

    $("table tr").each((_, tr) => {
      const tds = $(tr)
        .find("td")
        .map((__, td) => $(td).text().trim().replace(/\s+/g, " "))
        .get();
      if (tds.length >= 5 && tds[0] === "1st") {
        firstPrizeAmount = tds[2] || "HK$8,000,000";
        const parsedWinners = parseFloat(tds[3]?.replace(/,/g, "") || "0");
        if (!isNaN(parsedWinners)) {
          firstPrizeWinners = parsedWinners;
        }
        totalFund = tds[4] || "";
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

export function getNextDrawSchedule(latestDraw?: Draw) {
  const nowHktStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" });
  const nowHkt = new Date(nowHktStr);
  const todayIso = `${nowHkt.getFullYear()}-${String(nowHkt.getMonth() + 1).padStart(2, "0")}-${String(nowHkt.getDate()).padStart(2, "0")}`;

  let nextDrawNumber = "26/126";
  if (latestDraw?.draw_number) {
    const parts = latestDraw.draw_number.split("/");
    if (parts.length === 2) {
      const yr = parts[0];
      const seq = parseInt(parts[1], 10);
      if (!isNaN(seq)) {
        nextDrawNumber = `${yr}/${String(seq + 1).padStart(3, "0")}`;
      }
    }
  }

  const baseDateStr = !latestDraw?.date || latestDraw.date < todayIso ? todayIso : latestDraw.date;
  const [by, bm, bd] = baseDateStr.split("-").map(Number);
  const cursor = new Date(Date.UTC(by, bm - 1, bd));
  const isPastDrawTimeToday = nowHkt.getHours() > 21 || (nowHkt.getHours() === 21 && nowHkt.getMinutes() >= 35);

  for (let i = 0; i < 14; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    const dayOfWeek = cursor.getUTCDay();
    const isAfterLatest = !latestDraw?.date || iso > latestDraw.date;
    const isValidTodayOrFuture = iso > todayIso || (iso === todayIso && !isPastDrawTimeToday);

    if (isAfterLatest && isValidTodayOrFuture && (dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 6)) {
      break;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const nextIso = cursor.toISOString().slice(0, 10);
  const [ny, nm, nd] = nextIso.split("-").map(Number);
  const dayOfWeek = cursor.getUTCDay();
  const weekdaysZh = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const weekdaysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const isTonight = nextIso === todayIso;
  const dayLabelZh = `${ny}年${nm}月${nd}日 (${weekdaysZh[dayOfWeek]})${isTonight ? " (今晚)" : ""}`;
  const dayLabelEn = `${nd} ${monthsEn[nm - 1]} ${ny} (${weekdaysEn[dayOfWeek]})${isTonight ? " (Tonight)" : ""}`;

  const meta = latestDraw && cachedLatestPrizeMeta?.drawDate === latestDraw.date ? cachedLatestPrizeMeta : null;
  const isRollover = meta ? meta.firstPrizeWinners === 0 : false;

  const nameZh = isRollover ? "多寶攪珠" : "常規攪珠";
  const nameEn = isRollover ? "Rollover Draw" : "Regular Draw";
  const estimatedFirstPrize = isRollover ? "HK$12,000,000+" : "HK$8,000,000";

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
    noteEn,
  };
}

// Scraper 1: Lottery.hk English
export async function scrapeLotteryHkEn(): Promise<Draw[]> {
  const res = await axios.get("https://lottery.hk/en/mark-six/results/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 10000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(res.data);
  const results: Draw[] = [];

  $("table tbody tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length >= 3) {
      const drawNum = $(tds[0]).text().trim();
      const rawDate = $(tds[1]).text().trim();
      const balls = $(tds[2])
        .find("li")
        .map((__, li) => parseInt($(li).text().trim(), 10))
        .get()
        .filter((n) => !isNaN(n) && n >= 1 && n <= 49);

      const dateParts = rawDate.split("/");
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
          extra_number: balls[6],
        });
      }
    }
  });

  return results;
}

// Scraper 2: Lottery.hk Traditional Chinese
export async function scrapeLotteryHkZh(): Promise<Draw[]> {
  const res = await axios.get("https://lottery.hk/liuhecai/jieguo/", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 10000,
    maxRedirects: 5,
  });

  const $ = cheerio.load(res.data);
  const results: Draw[] = [];

  $("table tbody tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length >= 3) {
      const drawNum = $(tds[0]).text().trim();
      const rawDate = $(tds[1]).text().trim();
      const balls = $(tds[2])
        .find("li")
        .map((__, li) => parseInt($(li).text().trim(), 10))
        .get()
        .filter((n) => !isNaN(n) && n >= 1 && n <= 49);

      const dateParts = rawDate.split("/");
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
          extra_number: balls[6],
        });
      }
    }
  });

  return results;
}

// Scraper 3: LotteryExtreme backup
export async function scrapeLotteryExtreme(): Promise<Draw[]> {
  const response = await axios.get("https://www.lotteryextreme.com/marksix/results", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    timeout: 12000,
  });

  const $ = cheerio.load(response.data);
  const results: Draw[] = [];

  $("tr.cy").each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})[^\(]+\(([\d\/]+)\)/);
    if (!match) return;

    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
    const drawNum = match[4];

    const nextRow = $(el).next();
    const balls = nextRow
      .find(".displayball li")
      .map((__, li) => parseInt($(li).text().trim(), 10))
      .get()
      .filter((n) => !isNaN(n) && n >= 1 && n <= 49);

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
        extra_number: balls[6],
      });
    }
  });

  return results;
}

export async function fetchLiveDraws(): Promise<Draw[]> {
  try {
    const list = await scrapeLotteryHkEn();
    if (list.length > 0) return list;
  } catch (e: any) {
    console.warn("LotteryHkEn failed:", e.message);
  }

  try {
    const list = await scrapeLotteryHkZh();
    if (list.length > 0) return list;
  } catch (e: any) {
    console.warn("LotteryHkZh failed:", e.message);
  }

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

  // Fetch recent 50 draws from Firestore to check diff
  const drawsCol = collection(db, "draws");
  const q = query(drawsCol, orderBy("date", "desc"), limit(50));
  const snap = await getDocs(q);
  const existingMap = new Map<string, Draw>();
  snap.forEach((docSnap) => {
    const d = docSnap.data() as Draw;
    existingMap.set(d.draw_number, d);
  });

  let updatedCount = 0;
  for (const draw of scraped) {
    const existing = existingMap.get(draw.draw_number);
    const isNewOrDifferent =
      !existing ||
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
      await setDoc(doc(db, "draws", docId), draw, { merge: true });
      existingMap.set(draw.draw_number, draw);
      updatedCount++;
    }
  }

  const allDraws = await loadAllDraws(db);
  const latestDraw = allDraws[0];
  if (latestDraw?.date) {
    await scrapeLatestPrizeMeta(latestDraw.date);
  }
  const nextDraw = getNextDrawSchedule(latestDraw);

  if (allDraws.length >= 1000) {
    const summary = computeStatsSummary(allDraws);
    try {
      await setDoc(doc(db, "meta", "stats"), {
        ...summary,
        nextDraw,
        updatedAt: Date.now(),
      });
    } catch {
      // Non-fatal
    }
  }

  return {
    success: true,
    updatedCount,
    totalDraws: allDraws.length,
    latestDraw,
    nextDraw,
    message:
      updatedCount > 0
        ? `Successfully updated ${updatedCount} new draw(s). Latest: Draw ${latestDraw?.draw_number || ""} (${latestDraw?.date || ""})`
        : `Records are up to date. Latest: Draw ${latestDraw?.draw_number || ""} (${latestDraw?.date || ""})`,
    timestamp: Date.now(),
  };
}
