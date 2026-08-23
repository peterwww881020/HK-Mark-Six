import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  try {
    const res = await axios.get('https://www.lotteryextreme.com/marksix/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('results')) {
         console.log($(el).text(), href);
      }
    });
  } catch (e) { console.error(e.message); }
}
test();
