import axios from 'axios';
import * as cheerio from 'cheerio';

axios.get('https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view', {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }
}).then(res => {
  const $ = cheerio.load(res.data);
  console.log('table trs:', $("table tbody tr").length);
  const firstTr = $("table tbody tr").first();
  const tds = firstTr.find("td");
  const drawNum = $(tds[0]).text().trim();
  const date = $(tds[1]).text().trim();
  const numbersStr = $(tds[2]).text().trim();
  const extraStr = $(tds[3]).text().trim();
  console.log({drawNum, date, numbersStr, extraStr});
  let numbers = numbersStr.split(",").map(n=>parseInt(n.trim())).filter(n=>!isNaN(n));
  const extra = parseInt(extraStr);
  console.log({numbers, extra, dateStr: new Date(date).toISOString().split("T")[0]});
}).catch(console.error);
