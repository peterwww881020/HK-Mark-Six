const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
  const response = await axios.get(`https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });

  const $ = cheerio.load(response.data);
  let pageCount = 0;
  console.log("HTML length:", response.data.length);
  
  const rows = $("table tbody tr").toArray();
  console.log("Rows count:", rows.length);
  for (const el of rows) {
    const tds = $(el).find("td");
    if (tds.length >= 3) {
      const drawNum = $(tds[0]).text().trim();
      const rawDate = $(tds[1]).text().trim();
      
      const numbersStr = $(tds[2]).text().trim();
      const extraStr = $(tds[3]).text().trim();
      
      console.log(drawNum, rawDate, numbersStr, extraStr);
      pageCount++;
      if (pageCount > 5) break;
    }
  }
}

test().catch(console.error);
