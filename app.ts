import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import Adblocker from "puppeteer-extra-plugin-adblocker";
import { Browser, Page } from "puppeteer";
import { HeroInfo, ItemRow } from "./Models/Dotabuff";
import { Client as Db, QueryResult } from "pg";

import { DotabuffHero, DotabuffItem } from "./Entities/Dotabuff";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const heroItemsUrl = (name: string) =>
  `https://dotabuff.com/heroes/${name}/items`;
const rowSelector = "article > table > tbody > tr";
const winrateSelector =
  "body > div.container-outer.seemsgood > div.skin-container > div.container-inner.container-inner-content > div.header-content-container > div.header-content > div.header-content-secondary > dl:nth-child(2) > dd > span";
const nameSelector = "h1";

const heroNames = ["slark", "troll-warlord", "lone-druid", "naga-siren"];

(async function main() {
  const browser = await StartBrowser(chromePath);
  const heroes = await GetHeroesInfo(browser, heroNames);
  await browser.close();
  await SaveInDatabase(heroes);
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

interface DbEntry {
  id: number;
}

interface DbItem extends DbEntry {
  name: string;
  localized_name: string;
}

async function SaveInDatabase(heroes: HeroInfo[]) {
  const db = new Db({
    user: "postgres",
    database: "dota",
    password: "password1337",
  });

  await db.connect();

  // create update
  const updateInsert = (await db.query(
    "INSERT INTO dotabuff_updates(timestamp) VALUES(current_timestamp) RETURNING id"
  )) as QueryResult<DbEntry>;

  await SaveAsDotabuffUpdate(db, updateInsert.rows[0], heroes);
  await db.end();
}

async function GetHeroesInfo(browser: Browser, heroNames: string[]) {
  const heroes: HeroInfo[] = [];
  const page = await browser.newPage();
  await InterceptUselessRequests(page);

  for (const heroName of heroNames) {
    await page.goto(heroItemsUrl(heroName));
    const hero = await ParseHeroInfo(page);
    hero.items = await ParseItemRows(page);
    heroes.push(hero);
  }

  return heroes;
}

async function SaveAsDotabuffUpdate(
  db: Db,
  update: DbEntry,
  heroes: HeroInfo[]
) {
  const dbItems = (await db.query(
    "SELECT id, name, localized_name FROM items WHERE recipe IS FALSE"
  )) as QueryResult<DbItem>;
  const itemsMap = new Map(dbItems.rows.map(r => [r.localized_name, r.id]));
  const dbDagons = dbItems.rows.filter(i => i.localized_name == "Dagon");

  for (const hero of heroes) {
    // find hero id
    const heroIds = (await db.query(
      "SELECT id FROM heroes WHERE localized_name = $1",
      [hero.name]
    )) as QueryResult<DbEntry>;

    // insert dotabuff_hero
    const dbHeroInsert = (await db.query(
      "INSERT INTO dotabuff_heroes(update_id, game_id, winrate) VALUES($1, $2, $3) RETURNING id",
      [update.id, heroIds.rows[0].id, hero.winrate]
    )) as QueryResult<DbEntry>;

    // insert dotabuff_items
    const itemsToInsert = hero.items
      .filter(i => !i.name.startsWith("Recipe"))
      .map(i => {
        let itemId: number;

        if (i.name.startsWith("Dagon")) {
          // find number from i.name
          const dagonNum = i.name.slice(-2)[0];
          if (isNaN(parseInt(dagonNum))) {
            const firstDagon = dbDagons.find(d => d.name.endsWith("n"));
            if (!firstDagon) {
              throw new Error("First dagon not found in db");
            }

            itemId = firstDagon.id;
          } else {
            const dbDagon = dbDagons.find(d => d.name.endsWith(dagonNum));
            if (!dbDagon) {
              throw new Error(`dagon number ${dagonNum} not found in db`);
            }
            itemId = dbDagon.id;
          }
        } else {
          const foundId = itemsMap.get(i.name);
          if (!foundId) throw new Error(`${i.name} not found in database`);
          itemId = foundId;
        }

        return new DotabuffItem(
          dbHeroInsert.rows[0].id,
          itemId,
          i.matches,
          i.winrate
        );
      });

    var tasks = itemsToInsert.map(i => {
      return db.query(
        "INSERT INTO dotabuff_items(hero_id, game_id, matches, winrate) VALUES($1, $2, $3, $4)",
        [i.hero_id, i.game_id, i.matches, i.winrate]
      );
    });

    await Promise.all(tasks);
  }
}
