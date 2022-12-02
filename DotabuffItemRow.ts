export interface ItemRow {
  name: string;
  matches: number;
  winrate: number;
}

export class DotabuffItemRow implements ItemRow {
  name: string;
  matches: number;
  winrate: number;

  constructor(columns: string[]) {
    this.name = columns[1];
    this.matches = parseInt(columns[2]);
    this.winrate = parseFloat(columns[3]);
  }
}
