const puppeteer = require("puppeteer-extra");
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

const { io } = require("socket.io-client");
const parser = require("socket.io-msgpack-parser");

const socket = io('wss://skinport.com', {
  transports: ['websocket'],
  parser,  
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


const min_price = 2.5; // dont change this
const amount_allowed_to_spend = 100000;// in usd
const cvv = "123"
const discount = .20// discount .20 = 20% off

if (amount_allowed_to_spend < min_price)
{
    throw console.error("The Minimum Price Is Too Low!!!\nIt Needs To Be Higher Than $2.50!!!");
}
if (cvv == "123") throw console.error("Please change cvv on line 18")
const Item_name = "Fracture Case";
if (fs.existsSync('./skinport-session')) {
    console.log('Directory exists!');
    (async () =>{
        browser = await puppeteer.launch({
            headless: false, // Show the browser (helps with debugging/logins)
            defaultViewport: null,
            userDataDir: './skinport-session',
        })})();
    socket.on('saleFeed', async (result) => {
    if (result.eventType == "listed")
    {
        for(let item of result.sales)
        {   
            const full_url = `https://skinport.com/item/${item.url}/${item.saleId}`
            console.log(`Item: ${item.url},Discount: ${1-parseFloat(item.salePrice)/parseFloat(item.suggestedPrice)} Full Url: ${full_url}`)
            item.full_url = full_url;
            const price  = item.salePrice / 100;
            console.log(price); // 1.93
            // item.salePrice/item.suggestedPrice <= discount
            //item.salePrice/100 >= min_price
            //item.salePrice/100 <= amount_allowed_to_spend
            if (
            parseFloat(item.salePrice) / parseFloat(item.suggestedPrice) <= 1 - discount &&
            parseFloat(item.salePrice) / 100 >= parseFloat(min_price) &&
            parseFloat(item.salePrice) / 100 <= parseFloat(amount_allowed_to_spend)
            )
                {
                socket.disconnect();
                await Buy_Item(item)
                break
                
            }
            
        }
    }
});

} else {
    (async () =>{
    console.log('Directory does NOT exist!');
    console.log('!!! LOGIN THROUHG STEAM!!!')
    console.log('Then copy the link thats given to you from the email\nPaste the link into this browser')
    await sleep(3*1000)
    browser = await puppeteer.launch({
            headless: false, // Show the browser (helps with debugging/logins)
            defaultViewport: null,
            userDataDir: './skinport-session',
        });
    const page = await browser.newPage();
    page.goto('https://skinport.com/')
    })()


}

// Join Sale Feed with paramters.
socket.emit('saleFeedJoin', {currency: 'USD', locale: 'en', appid: 730})
function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}


async function Buy_Item(item) {
    

    
    const page = await browser.newPage();
    await page.goto(item.full_url)
    const buttonSelector = 'button.SubmitButton.SubmitButton--isFull'
    await page.waitForSelector(buttonSelector);
    await page.click(buttonSelector);
    await page.goto("https://skinport.com/cart")
    await page.waitForSelector('#cb-cancellation-2');
    const inputs = await page.$$('input.Checkbox-input');
    await inputs[0].click();
    await inputs[1].click();
    const checkout = await page.$('button.SubmitButton.CartSummary-checkoutBtn.SubmitButton--isFull')
    await checkout.click()
    await page.waitForSelector('iframe.js-iframe[title="Iframe for security code"]');

    // Get the iframe element handle
    const frameHandle = await page.$('iframe.js-iframe[title="Iframe for security code"]');
    const frame = await frameHandle.contentFrame();

    // Wait for the input to be available inside the iframe
    await frame.waitForSelector('input[data-fieldtype="encryptedSecurityCode"]');

    // Type into the security code input
    const input = await frame.$('input[data-fieldtype="encryptedSecurityCode"]');
    await input.type(cvv.toString()); // example CVV
    const pay = 'button.adyen-checkout__button.adyen-checkout__button--pay'
    await page.waitForSelector(pay)
    const button = await page.$(pay)
    await button.click()
}
