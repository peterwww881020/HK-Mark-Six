import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, Draw } from "./_syncCore";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = getFirebaseDb();
    const q = query(collection(db, "draws"), orderBy("date", "desc"));
    const snap = await getDocs(q);
    const allDraws: Draw[] = [];
    snap.forEach(d => {
      allDraws.push(d.data() as Draw);
    });

    const freqMap: Record<number, number> = {};
    const extraFreqMap: Record<number, number> = {};

    allDraws.forEach(draw => {
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

    const oldestDrawDate = allDraws[allDraws.length - 1]?.date;
    const oldestYear = oldestDrawDate ? oldestDrawDate.split("-")[0] : "";

    return res.status(200).json({
      main: stats,
      extra: extraStats,
      totalDraws: allDraws.length,
      oldestYear,
      latestDraw: allDraws[0],
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error("Vercel /api/stats Error:", error.message || error);
    return res.status(500).json({ error: error.message || "Failed to calculate stats" });
  }
}
