import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import * as cheerio from "cheerio";
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import fs from "fs";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/history", (req, res) => {
    res.json(cachedDraws.slice(0, 50));
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

    res.json({ main: stats, extra: extraStats, totalDraws: cachedDraws.length });
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

  app.post("/api/update", async (req, res) => {
    try {
      let totalCount = 0;
      
      const scrapeAll = async () => {
        for (let page = 1; page <= 35; page++) {
          try {
            console.log(`Scraping page ${page}...`);
            const response = await axios.get(`https://en.lottolyzer.com/history/hong-kong/mark-six/page/${page}/per-page/50/summary-view`, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              }
            });

            const $ = cheerio.load(response.data);
            let pageCount = 0;

            const rows = $("table tbody tr").toArray();
            for (const el of rows) {
              const tds = $(el).find("td");
              if (tds.length >= 3) {
                const drawNum = $(tds[0]).text().trim();
                const rawDate = $(tds[1]).text().trim();
                
                const numbersStr = $(tds[2]).text().trim();
                const extraStr = $(tds[3]).text().trim();
                
                let numbers: number[] = numbersStr.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n));
                const extra = parseInt(extraStr);

                if (numbers.length === 6 && !isNaN(extra)) {
                  numbers.sort((a, b) => a - b);
                  
                  try {
                    const dateStr = new Date(rawDate).toISOString().split("T")[0];
                    const docId = drawNum.replace(/\//g, "-");
                    
                    const drawData: Draw = {
                      date: dateStr,
                      draw_number: drawNum,
                      n1: numbers[0],
                      n2: numbers[1],
                      n3: numbers[2],
                      n4: numbers[3],
                      n5: numbers[4],
                      n6: numbers[5],
                      extra_number: extra
                    };
                    
                    // Push to firestore
                    await setDoc(doc(db, 'draws', docId), drawData, { merge: true });
                    pageCount++;
                    totalCount++;
                  } catch(e) {}
                }
              }
            }
            if (pageCount === 0) break; // Reached end of available data
            await new Promise(r => setTimeout(r, 500)); // Respectful delay
          } catch (err: any) {
            console.error("Failed on page", page, err.message);
            break; // Stop on network error
          }
        }
        console.log(`Firestore populated with ${totalCount} historical draws.`);
        await refreshCache();
      };

      // Run asynchronously
      scrapeAll().catch(e => console.error("Background scrape failed:", e));

      res.json({ success: true, message: "Started integrating ~10 years of historical data into Firestore in the background. It will be available shortly." });
    } catch (err: any) {
      console.error("Update initialization error:", err.message);
      res.json({ success: false, message: "Failed to start data update process." });
    }
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
    
    // Auto-populate database if empty and load cache
    refreshCache().then(() => {
      if (cachedDraws.length === 0) {
        console.log("Firestore is empty. Triggering background scrape...");
        axios.post(`http://127.0.0.1:${PORT}/api/update`, {}).catch(err => {
          console.error("Auto-population failed:", err.message);
        });
      }
    });
  });
}

startServer();
