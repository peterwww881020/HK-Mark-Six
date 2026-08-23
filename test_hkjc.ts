import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
  try {
    const url = 'https://bet.hkjc.com/marksix/index.aspx?lang=en';
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    console.log("Title:", $('title').text());
    console.log("Body:", $('body').text().slice(0, 1000));
  } catch (e) { console.error(e.message); }
}
test();
