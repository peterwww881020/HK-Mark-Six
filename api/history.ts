import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getFirebaseDb, Draw } from "./_syncCore";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const limitParam = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const count = isNaN(limitParam) ? 50 : Math.min(limitParam, 200);

    const db = getFirebaseDb();
    const q = query(collection(db, "draws"), orderBy("date", "desc"), limit(count));
    const snap = await getDocs(q);
    const data: Draw[] = [];
    snap.forEach(d => {
      data.push(d.data() as Draw);
    });

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Vercel /api/history Error:", error.message || error);
    return res.status(500).json({ error: error.message || "Failed to fetch history" });
  }
}
