import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import axios from "axios";
import * as cheerio from "cheerio";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const firebaseConfig = require("./firebase-applet-config.json");

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId || "(default)");

async function seedData() {
  console.log("Starting to seed historical data into Firestore...");
  let totalInserted = 0;
  for (let page = 1; page <= 100; page++) {
    try {
      const response = await axios.get(`https://en.lottolyzer.com/history/hong-kong/mark-six/page/${page}/per-page/50/summary-view`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
      });

      const $ = cheerio.load(response.data);
      let countPage = 0;
      
      const rows = $("table tbody tr").toArray();
      if (rows.length === 0) {
        console.log(`No more data found on page ${page}. Stopping.`);
        break;
      }

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
              const dateObj = new Date(rawDate);
              if (isNaN(dateObj.getTime())) continue; // Invalid date format

              const dateStr = dateObj.toISOString().split("T")[0];
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
              countPage++;
            } catch(e: any) {}
          }
        }
      }
      totalInserted += countPage;
      if (page % 10 === 0) {
        console.log(`Processed ${page} pages. Inserted so far: ${totalInserted}`);
      }
      
      await new Promise(res => setTimeout(res, 50));
    } catch (err: any) {
      console.error(`Failed on page ${page}:`, err.message);
      break;
    }
  }
}

seedData().then(() => console.log("Seeding complete.")).catch(console.error);
