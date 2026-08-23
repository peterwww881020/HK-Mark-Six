import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  try {
    const res = await axios.get('https://www.lotteryextreme.com/marksix/results', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    $('a').each((i, el) => {
      const text = $(el).text();
      const href = $(el).attr('href');
      if (text.includes('202') || text.includes('201')) {
         console.log(text, href);
      }
    });
  } catch (e) { console.error(e.message); }
}
test();
