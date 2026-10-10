import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Assuming frontend runs on 5173
  await page.goto('http://localhost:5173/?demo=1');
  
  // Wait for app to load
  await page.waitForSelector('button:has-text("Load Demo")');
  await page.click('button:has-text("Load Demo")');
  
  // Wait for routes
  await page.waitForSelector('text=Alternative Routes', { timeout: 15000 }).catch(e => console.log('Timeout waiting for routes'));
  
  // Click first alternative route
  const buttons = await page.$$('button:has-text("Alternative")');
  if (buttons.length > 0) {
    console.log(`Found ${buttons.length} alternative routes. Clicking the first one.`);
    await buttons[0].click();
    
    // Check if map active layer changed (this is tricky to verify in playwright, but we can check if UI updated)
    await page.waitForTimeout(1000);
    console.log('Clicked alternative route. Waiting to see if Active Route Summary updated.');
  } else {
    console.log('No alternative routes found.');
  }
  
  // Let's also check for any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`PAGE ERROR: ${msg.text()}`);
  });

  await browser.close();
})();
