import puppeteer from 'puppeteer';

async function test() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('response', async (response) => {
    if (response.url().includes('mark') || response.url().includes('result') || response.url().includes('json')) {
      console.log('URL:', response.url());
      if (response.headers()['content-type']?.includes('json')) {
        try {
          const text = await response.text();
          if (text.length > 0) {
            console.log('JSON Length:', text.length);
            console.log(text.slice(0, 200));
          }
        } catch (e) {}
      }
    }
  });

  await page.goto('https://bet.hkjc.com/marksix/index.aspx?lang=en', { waitUntil: 'networkidle2' });
  await browser.close();
}
test().catch(console.error);
