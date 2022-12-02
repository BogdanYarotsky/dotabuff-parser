import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import Adblocker from "puppeteer-extra-plugin-adblocker";
import { HTTPRequest, Page } from "puppeteer";
import { DotabuffItemRow } from "./DotabuffItemRow";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const rowSelector = "article > table > tbody > tr";

(async function main() {
  const browser = await StartBrowser(chromePath);
  const page = await browser.newPage();
  await FilterUnusedData(page);
  await page.goto("https://dotabuff.com/heroes/huskar/items");
  const items = await ParseItemRows(page);
  await browser.close();
})();

async function StartBrowser(exePath: string) {
  return await puppeteer
    .use(Adblocker({ blockTrackersAndAnnoyances: true }))
    .use(StealthPlugin())
    .launch({
      headless: false,
      executablePath: exePath,
    });
}

async function FilterUnusedData(page: Page) {
  await page.setRequestInterception(true);
  page.on("request", (r) => {
    if (r.resourceType() === "document") {
      r.continue();
    } else {
      r.abort();
    }
  });
}

async function ParseItemRows(page: Page) {
  const itemRows = await page.$$eval(rowSelector, (rows) => {
    return Array.from(rows, (row) => {
      const columns = row.querySelectorAll("td");
      return Array.from(columns, (column) => column.innerText);
    });
  });
  return itemRows.map((row) => new DotabuffItemRow(row));
}
