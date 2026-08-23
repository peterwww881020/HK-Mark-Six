import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  try {
    const response = await axios.get('https://lottery.hk/mark-six/results', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    console.log("Title:", $('title').text());
    
    // the results might be in a table
    const draws = [];
    $('table tr').each((i, el) => {
      draws.push($(el).text().replace(/\s+/g, ' ').trim());
    });
    console.log(draws.slice(0, 5));
  } catch (e) { console.error(e.message); }
}
test();
