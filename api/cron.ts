import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";
import axios from "axios";
import * as cheerio from "cheerio";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import firebaseConfig from "../firebase-applet-config.json";

// Load Firebase Config from environment variable or fallback
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");

    console.log("Scraping latest page...");
    // Only scrape page 1 to be lightweight and fast for a cron job
    const response = await axios.get("https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36",
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
            
            const drawData = {
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
            
            // Push to firestore with merge so we update existing draws or insert new ones
            await setDoc(doc(db, "draws", docId), drawData, { merge: true });
            pageCount++;
          } catch(e) {
            console.error("Firestore Error for draw", drawNum, e);
          }
        }
      }
    }
    
    return res.status(200).json({ success: true, message: `Updated ${pageCount} recent draws.` });
  } catch (error: any) {
    console.error("Cron Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
