import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, getOrComputeStatsSummary, getNextDrawSchedule, Draw } from "./_syncCore.js";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const count = isNaN(limitParam) ? 50 : Math.min(limitParam, 200);

    const db = getFirebaseDb();
    const [histSnap, summary] = await Promise.all([
      getDocs(query(collection(db, "draws"), orderBy("date", "desc"), limit(count))),
      getOrComputeStatsSummary(db),
    ]);

    const history: Draw[] = [];
    histSnap.forEach((d) => {
      history.push(d.data() as Draw);
    });

    const latestDraw = history[0] || summary.latestDraw || null;
    const nextDraw = summary.nextDraw && (!latestDraw?.date || summary.nextDraw.date > latestDraw.date)
      ? summary.nextDraw
      : getNextDrawSchedule(latestDraw || undefined);

    return res.status(200).json({
      history,
      stats: {
        main: summary.main,
        extra: summary.extra,
        totalDraws: summary.totalDraws,
        oldestYear: summary.oldestYear || "1993",
      },
      latestDraw,
      nextDraw,
      lastSyncTimestamp: summary.updatedAt || Date.now(),
    });
  } catch (error: any) {
    console.error("Vercel /api/bootstrap Error:", error.message || error);
    return res.status(500).json({ error: error.message || "Failed to load bootstrap data" });
  }
}
