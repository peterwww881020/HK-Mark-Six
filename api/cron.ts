import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import * as cheerio from "cheerio";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    let firebaseConfig;
    
    // Validate ENV values securely without relying on fs for Vercel
    if (process.env.FIREBASE_CONFIG) {
      try {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch (parseError) {
        return res.status(500).json({ success: false, error: "FIREBASE_CONFIG is not a valid JSON string. Please check Vercel environment variables." });
      }
    } else if (process.env.VITE_FIREBASE_PROJECT_ID) {
      firebaseConfig = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || "(default)",
      };
    } else {
      return res.status(500).json({ success: false, error: "Missing Firebase configuration. Please set FIREBASE_CONFIG or VITE_FIREBASE_PROJECT_ID in Vercel settings." });
    }

    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");

    console.log("Scraping latest page...");
    
    const response = await fetch("https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from website: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    // Handle cheerio import interop 
    const isCheerioFunction = typeof cheerio === "function";
    const $ = isCheerioFunction ? (cheerio as any).load(html) : ((cheerio as any).default?.load ? (cheerio as any).default.load(html) : (cheerio as any).load(html));
    
    let pageCount = 0;
    const rows = $("table tbody tr").toArray();
    
    for (const el of rows) {
      const tds = $(el).find("td");
      if (tds.length >= 3) {
        const drawNum = $(tds[0]).text().trim();
        const rawDate = $(tds[1]).text().trim();
        const numbersStr = $(tds[2]).text().trim();
        const extraStr = $(tds[3]).text().trim();
        
        let numbers: number[] = numbersStr.split(",").map((n: string) => parseInt(n.trim())).filter((n: number) => !isNaN(n));
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
            
            await setDoc(doc(db, "draws", docId), drawData, { merge: true });
            pageCount++;
          } catch(e: any) {
            console.error("Firestore Error for draw", drawNum, e.message);
          }
        }
      }
    }
    
    return res.status(200).json({ success: true, message: `Updated ${pageCount} recent draws.` });
  } catch (error: any) {
    console.error("Cron Error:", error.stack || error.message || error);
    return res.status(500).json({ success: false, error: error.message || "Unknown error" });
  }
}
