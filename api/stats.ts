import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, getOrComputeStatsSummary, getNextDrawSchedule } from "./_syncCore.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = getFirebaseDb();
    const summary = await getOrComputeStatsSummary(db);
    const nextDraw = summary.nextDraw && (!summary.latestDraw?.date || summary.nextDraw.date > summary.latestDraw.date)
      ? summary.nextDraw
      : getNextDrawSchedule(summary.latestDraw || undefined);

    return res.status(200).json({
      main: summary.main,
      extra: summary.extra,
      totalDraws: summary.totalDraws,
      oldestYear: summary.oldestYear || "1993",
      latestDraw: summary.latestDraw || null,
      nextDraw,
      lastSyncTimestamp: summary.updatedAt || Date.now(),
    });
  } catch (error: any) {
    console.error("Vercel /api/stats Error:", error.message || error);
    return res.status(500).json({ error: error.message || "Failed to calculate stats" });
  }
}
