import type { VercelRequest, VercelResponse } from "@vercel/node";
import { performDrawsSync, getUpcomingDrawInfo } from "./_syncCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const result = await performDrawsSync();
    return res.status(200).json({
      ...result,
      nextDraw: getUpcomingDrawInfo()
    });
  } catch (error: any) {
    console.error("Vercel /api/update Error:", error.message || error);
    return res.status(500).json({
      success: false,
      updatedCount: 0,
      message: `Sync failed: ${error.message || "Unknown error"}`,
      timestamp: Date.now()
    });
  }
}
