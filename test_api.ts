import axios from 'axios';
async function test() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/kitce/marker/master/data/records/2023.json');
    console.log(res.data.slice(0, 500));
  } catch (e) { console.error(e.message); }
}
test();
