import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeRecent() {
  try {
    const res = await axios.get('https://www.lotteryextreme.com/marksix/results', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const tbl = $('table').eq(4);
    
    const rows = tbl.find('tr').toArray();
    let currentDraw: any = null;
    let count = 0;
    
    for (const row of rows) {
      if ($(row).hasClass('cy')) {
        const text = $(row).text().trim(); // "22/08/2026 Saturday (26/092)   Winners"
        const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})[^\(]+\(([\d\/]+)\)/);
        if (match) {
          currentDraw = {
            date: `${match[3]}-${match[2]}-${match[1]}`,
            draw_number: match[4]
          };
        }
      } else if (currentDraw && $(row).find('.displayball').length > 0) {
        const lis = $(row).find('.displayball li').toArray();
        const nums = [];
        for (const li of lis) {
          const n = parseInt($(li).text().trim());
          if (!isNaN(n)) nums.push(n);
        }
        if (nums.length === 7) {
          const drawData = {
            date: currentDraw.date,
            draw_number: currentDraw.draw_number,
            n1: nums[0],
            n2: nums[1],
            n3: nums[2],
            n4: nums[3],
            n5: nums[4],
            n6: nums[5],
            extra_number: nums[6]
          };
          console.log(drawData);
          count++;
        }
        currentDraw = null;
      }
    }
    console.log("Total draws found:", count);
  } catch (e) { console.error(e.message); }
}
scrapeRecent();
