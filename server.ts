import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
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



async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/history", (req, res) => {
    const draws = db.prepare("SELECT * FROM draws ORDER BY date DESC LIMIT 50").all();
    res.json(draws);
  });

  app.get("/api/stats", (req, res) => {
    const stats = db.prepare(`
      SELECT num, count(*) as frequency FROM (
        SELECT n1 as num FROM draws
        UNION ALL SELECT n2 FROM draws
        UNION ALL SELECT n3 FROM draws
        UNION ALL SELECT n4 FROM draws
        UNION ALL SELECT n5 FROM draws
        UNION ALL SELECT n6 FROM draws
      )
      GROUP BY num
      ORDER BY frequency DESC
    `).all();

    const extraStats = db.prepare(`
      SELECT extra_number as num, count(*) as frequency FROM draws
      GROUP BY num
      ORDER BY frequency DESC
    `).all();

    const totalDraws = db.prepare("SELECT COUNT(*) as count FROM draws").get() as { count: number };

    res.json({ main: stats, extra: extraStats, totalDraws: totalDraws.count });
  });

  app.post("/api/check", (req, res) => {
    const { numbers }: { numbers: number[] } = req.body;
    if (!numbers || numbers.length !== 6) {
      return res.status(400).json({ error: "Please provide exactly 6 numbers." });
    }

    const draws = db.prepare("SELECT * FROM draws ORDER BY date DESC").all() as any[];
    
    const results = draws.map(draw => {
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
      const response = await axios.get("https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
      });

      const $ = cheerio.load(response.data);
      let count = 0;
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO draws (date, draw_number, n1, n2, n3, n4, n5, n6, extra_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

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
            
            // Format date if needed
            const info = insertStmt.run(
              new Date(date).toISOString().split("T")[0],
              drawNum,
              numbers[0], numbers[1], numbers[2], numbers[3], numbers[4], numbers[5], extra
            );
            if (info.changes > 0) count++;
          }
        }
      });

      res.json({ success: true, updated: count, message: count > 0 ? `Scraped ${count} new draws.` : "No new draws found or scraper failed to parse format. (Mock data is active)" });
    } catch (err: any) {
      console.error("Scraping error:", err.message);
      res.json({ success: false, message: "Failed to scrape the latest results due to network/access limitations, using existing historical database." });
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
  });
}

startServer();
