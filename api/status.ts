import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, getUpcomingDrawInfo, Draw } from "./_syncCore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = getFirebaseDb();
    const q = query(collection(db, "draws"), orderBy("date", "desc"), limit(1));
    const snap = await getDocs(q);
    let latestDraw: Draw | undefined = undefined;
    snap.forEach(d => {
      latestDraw = d.data() as Draw;
    });

    return res.status(200).json({
      status: "online",
      latestDraw,
      lastSyncTimestamp: Date.now(),
      nextDraw: getUpcomingDrawInfo()
    });
  } catch (error: any) {
    console.error("Vercel /api/status Error:", error.message || error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Failed to get status",
      nextDraw: getUpcomingDrawInfo()
    });
  }
}
