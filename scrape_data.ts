import Database from "better-sqlite3";
import axios from "axios";
import * as cheerio from "cheerio";

const db = new Database("history.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS draws (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE,
    draw_number TEXT,
    n1 INTEGER,
    n2 INTEGER,
    n3 INTEGER,
    n4 INTEGER,
    n5 INTEGER,
    n6 INTEGER,
    extra_number INTEGER
  );
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO draws (date, draw_number, n1, n2, n3, n4, n5, n6, extra_number)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function scrapePages() {
  console.log("Scraping real data from 2016 to 2026...");
  // roughly 50 pages * 50 = 2500 draws (which is ~16 years, enough to cover 2016-2026)
  for (let page = 1; page <= 35; page++) {
    console.log("Fetching page " + page);
    try {
      const response = await axios.get("https://en.lottolyzer.com/history/hong-kong/mark-six/page/" + page + "/per-page/50/summary-view", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
      });

      const $ = cheerio.load(response.data);
      let countPage = 0;
      $("table tbody tr").each((i, el) => {
        const tds = $(el).find("td");
        if (tds.length >= 3) {
          const drawNum = $(tds[0]).text().trim();
          const date = $(tds[1]).text().trim();
          
          const numbersStr = $(tds[2]).text().trim();
          const extraStr = $(tds[3]).text().trim();
          
          let numbers: number[] = numbersStr.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n));
          const extra = parseInt(extraStr);

          if (numbers.length === 6 && !isNaN(extra)) {
            numbers.sort((a, b) => a - b);
            
            try {
              const info = insertStmt.run(
                new Date(date).toISOString().split("T")[0],
                drawNum,
                numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5], extra
              );
              if (info.changes > 0) countPage++;
            } catch (e: any) {
              console.error("Insert error:", e.message);
            }
          }
        }
      });
      console.log("Page " + page + ": Inserted " + countPage + " new draws.");
      await new Promise(r => setTimeout(r, 500)); // Sleep for 500ms
    } catch (err: any) {
      console.error("Failed on page " + page + ":", err.message);
      break;
    }
  }
}

scrapePages().then(() => console.log("Done")).catch(console.error);
