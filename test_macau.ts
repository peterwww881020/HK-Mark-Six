import axios from 'axios';
async function test() {
  try {
    const url = 'https://bet.hkjc.com/marksix/index.aspx?lang=en';
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(response.data.slice(0, 1000));
  } catch (e) { console.error(e.message); }
}
test();
