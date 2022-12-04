export class DotabuffHero {
  public id?: number;
  public update_id?: number;
  public game_id?: number;
  public winrate?: number;
}

export class DotabuffItem {
  constructor(
    public hero_id: number,
    public game_id: number,
    public matches: number,
    public winrate: number
  ) {}
}
