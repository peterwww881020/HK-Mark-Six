const axios = require('axios');
const cheerio = require('cheerio');

axios.get('https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view', {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }
}).then(res => {
  const $ = cheerio.load(res.data);
  console.log('table trs:', $(".table-responsive table tbody tr").length);
  const firstTr = $(".table-responsive table tbody tr").first();
  console.log('First TR HTML:', firstTr.html());
}).catch(console.error);
