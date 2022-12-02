import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import Adblocker from "puppeteer-extra-plugin-adblocker";
import { Page } from "puppeteer";
import { HeroInfo, ItemRow } from "./Dotabuff";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const rowSelector = "article > table > tbody > tr";
const heroItemsUrl = "https://dotabuff.com/heroes/huskar/items";

(async function main() {
  const browser = await StartBrowser(chromePath);
  const page = await browser.newPage();
  await FilterUnusedData(page);
  await page.goto(heroItemsUrl);
  const hero = await ParseHeroInfo(page);
  hero.items = await ParseItemRows(page);
  // add to hero object
  // insert to database

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

async function FilterUnusedData(page: Page) {
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
  throw new Error("Function not implemented.");
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
