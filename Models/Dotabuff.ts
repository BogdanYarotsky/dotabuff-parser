export interface ItemRow {
  name: string;
  matches: number;
  winrate: number;
}

export class HeroInfo {
  public items: ItemRow[];

  constructor(public name: string, public winrate: number) {
    this.items = [];
  }
}
