import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import Adblocker from "puppeteer-extra-plugin-adblocker";
import { Page } from "puppeteer";
import { HeroInfo, ItemRow } from "./Models/Dotabuff";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const heroItemsUrl = "https://dotabuff.com/heroes/huskar/items";
const rowSelector = "article > table > tbody > tr";
const winrateSelector =
  "body > div.container-outer.seemsgood > div.skin-container > div.container-inner.container-inner-content > div.header-content-container > div.header-content > div.header-content-secondary > dl:nth-child(2) > dd > span";
const nameSelector = "h1";

// todo
// 1. save hero to database
// 1.1 design schema
// 1.2 create database
// 1.3 add "pg" to the project
// 1.4 save 5 heroes to database
// proceed with front end part to display them

(async function main() {
  const browser = await StartBrowser(chromePath);
  const page = await browser.newPage();
  await InterceptUselessRequests(page);
  await page.goto(heroItemsUrl);
  const hero = await ParseHeroInfo(page);
  hero.items = await ParseItemRows(page);
  await browser.close();
})();

async function StartBrowser(exePath: string) {
  return await puppeteer
    .use(Adblocker({ blockTrackersAndAnnoyances: true }))
    .use(StealthPlugin())
    .launch({
      headless: true,
      executablePath: exePath,
    });
}

async function InterceptUselessRequests(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", r => {
    if (r.resourceType() === "document") {
      r.continue();
    } else {
      r.abort();
    }
  });
}

async function ParseHeroInfo(page: Page): Promise<HeroInfo> {
  var heroName = await page.$eval(nameSelector, e => e.innerText);
  var heroWinrate = await page.$eval(winrateSelector, e =>
    parseFloat(e.innerText)
  );
  return new HeroInfo(heroName.replace("Items", ""), heroWinrate);
}

async function ParseItemRows(page: Page): Promise<ItemRow[]> {
  const itemRows = await page.$$eval(rowSelector, rows =>
    Array.from(rows, row =>
      Array.from(row.querySelectorAll("td"), column => column.innerText)
    )
  );

  return itemRows.map(row => {
    return {
      name: row[1],
      matches: parseInt(row[2].replace(/,/g, "")),
      winrate: parseFloat(row[3]),
    };
  });
}
