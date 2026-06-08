const https = require('https');

https.get('https://en.lottolyzer.com/history/hong-kong/mark-six/page/1/per-page/50/summary-view', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 2000)));
});
