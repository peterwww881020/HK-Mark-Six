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
    const db = getFirebaseDb();
    const [topSnap, summary] = await Promise.all([
      getDocs(query(collection(db, "draws"), orderBy("date", "desc"), limit(1))),
      getOrComputeStatsSummary(db),
    ]);

    let latestDraw: Draw | undefined = undefined;
    topSnap.forEach((d) => {
      latestDraw = d.data() as Draw;
    });

    const nextDraw = summary.nextDraw && (!latestDraw?.date || summary.nextDraw.date > latestDraw.date)
      ? summary.nextDraw
      : getNextDrawSchedule(latestDraw);

    return res.status(200).json({
      status: "online",
      totalDraws: summary.totalDraws,
      latestDraw,
      lastSyncTimestamp: summary.updatedAt || Date.now(),
      nextDraw,
    });
  } catch (error: any) {
    console.error("Vercel /api/status Error:", error.message || error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Failed to get status",
      nextDraw: getNextDrawSchedule(),
    });
  }
}
