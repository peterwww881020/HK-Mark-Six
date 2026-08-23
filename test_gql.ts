import axios from 'axios';
async function test() {
  const query = `
    query getDrawResults($dateStr: String!) {
      marksixDrawResults(date: $dateStr) {
        id
        drawNumber
        date
        no1
        no2
        no3
        no4
        no5
        no6
        sno
      }
    }
  `;
  try {
    const res = await axios.post('https://is.hkjc.com/graphql', {
      query: `query { marksixDrawResults(last: 10) { date drawNumber no1 no2 no3 no4 no5 no6 sno } }`
    }, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(res.data);
  } catch (e) { console.error(e.message); }
}
test();
