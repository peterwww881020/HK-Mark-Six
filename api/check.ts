import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, loadAllDraws } from "./_syncCore.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const numbers: number[] = body?.numbers;

    if (!Array.isArray(numbers) || numbers.length !== 6) {
      return res.status(400).json({ error: "Please provide exactly 6 numbers." });
    }

    const db = getFirebaseDb();
    const allDraws = await loadAllDraws(db);

    const results = allDraws
      .map((draw) => {
        const drawNumbers = [draw.n1, draw.n2, draw.n3, draw.n4, draw.n5, draw.n6];
        const matchCount = numbers.filter((n) => drawNumbers.includes(n)).length;
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
          prize,
        };
      })
      .filter((r) => r.prize !== "No Prize");

    const prizeOrder: Record<string, number> = {
      "1st Prize": 1,
      "2nd Prize": 2,
      "3rd Prize": 3,
      "4th Prize": 4,
      "5th Prize": 5,
      "6th Prize": 6,
      "7th Prize": 7,
    };

    results.sort((a, b) => {
      const rankDiff = prizeOrder[a.prize] - prizeOrder[b.prize];
      if (rankDiff !== 0) return rankDiff;
      return b.date.localeCompare(a.date);
    });

    return res.status(200).json({ wins: results, totalDrawsChecked: allDraws.length });
  } catch (error: any) {
    console.error("Vercel /api/check Error:", error.message || error);
    return res.status(500).json({ error: error.message || "Failed to check numbers" });
  }
}
