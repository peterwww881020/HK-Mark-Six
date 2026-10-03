import type { VercelRequest, VercelResponse } from "@vercel/node";
import { performDrawsSync } from "./_syncCore";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log("Vercel Cron Triggered: Syncing recent Mark Six draws...");
    const result = await performDrawsSync();
    console.log(`Cron sync success: ${result.updatedCount} draws updated.`);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Cron Error:", error.stack || error.message || error);
    return res.status(500).json({ success: false, error: error.message || "Unknown error" });
  }
}
