import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  try {
    const res = await axios.get('https://www.lotteryextreme.com/marksix/results', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const tbl = $('table').eq(4);
    console.log(tbl.html().slice(0, 1000));
  } catch (e) { console.error(e.message); }
}
test();
