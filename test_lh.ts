import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('https://www.lottery.hk/mark-six/results', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(res.data.slice(0, 500));
  } catch (e) { console.error(e.message); }
}
test();
