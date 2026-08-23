const axios = require('axios');
async function test() {
  const url = 'https://bet.hkjc.com/marksix/getJSON.aspx?sd=20260101&ed=20261231&tt=0';
  const response = await axios.get(url);
  console.log(response.data);
}
test();
