import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { GameSession, TavernOffer, TrainingOffer } from '../../application/GameSession';
import { ALL_SLOTS, type Slot } from '../../domain/army';
import type { Resources } from '../../domain/economy';
import { icon, type Icons } from '../assets/icons';
import { formatNumber } from '../format';
import { Tweens } from '../Tweens';
import { COLORS, FONT, ROLE_LABELS } from '../theme';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import { UnitToken } from '../ui/UnitToken';
import { Scene } from './Scene';

type Tab = 'tavern' | 'train';

const PAD = 16;

/** Between battles: see the army, hire at the tavern, train unit types, then fight the next wave. */
export class CampScene extends Scene {
  private readonly tweens = new Tweens();
  private readonly bar: ResourceBar;
  private readonly powerText: Text;
  private readonly grid = new Container();
  private readonly gridHint: Text;
  private readonly tavernTab: Button;
  private readonly trainTab: Button;
  private readonly list = new Container();
  private readonly fightButton: Button;
  private readonly credits: Text;
  private tab: Tab = 'tavern';
  private selected: string | null = null;
  private screenW = 0;

  constructor(
    private readonly session: GameSession,
    private readonly icons: Icons,
    onFight: () => void,
  ) {
    super();
    this.bar = new ResourceBar(icons, this.tweens);
    this.bar.set(session.wallet.balance);
    const bold = { fontFamily: FONT, fontWeight: 'bold' as const };
    this.powerText = new Text({ text: '', style: { ...bold, fontSize: 22, fill: COLORS.text } });
    this.powerText.anchor.set(0.5, 0);
    this.gridHint = new Text({ text: 'Tap two slots to swap', style: { fontFamily: FONT, fontSize: 12, fill: COLORS.muted } });
    this.gridHint.anchor.set(0.5, 0);
    this.tavernTab = new Button({ label: 'Tavern', width: 150, height: 44, fontSize: 16, onTap: () => this.setTab('tavern') });
    this.trainTab = new Button({ label: 'Train', width: 150, height: 44, fontSize: 16, onTap: () => this.setTab('train') });
    this.fightButton = new Button({
      label: `Fight wave ${session.wave}`,
      width: 300,
      height: 60,
      fontSize: 20,
      icon: icon(icons, 'crossed-swords'),
      onTap: () => {
        this.fightButton.enabled = false; // one battle per tap, even on a double tap
        onFight();
      },
    });
    this.credits = new Text({
      text: 'Icons by Lorc, Delapouite & Sbed · game-icons.net · CC BY 3.0',
      style: { fontFamily: FONT, fontSize: 10, fill: COLORS.muted },
    });
    this.credits.anchor.set(0.5, 1);
    this.addChild(this.powerText, this.grid, this.gridHint, this.tavernTab, this.trainTab, this.list, this.fightButton, this.credits, this.bar);
    this.bar.setCaption(`Next: wave ${session.wave}`);
  }

  layout(width: number, height: number): void {
    this.screenW = width;
    this.bar.layout(width);
    this.fightButton.resize(width - PAD * 2);
    this.fightButton.position.set(width / 2, height - 24 - this.fightButton.buttonHeight / 2);
    this.credits.position.set(width / 2, height - 4);
    const tabW = (width - PAD * 3) / 2;
    this.tavernTab.resize(tabW);
    this.trainTab.resize(tabW);
    this.render();
  }

  override destroy(options?: Parameters<Scene['destroy']>[0]): void {
    this.tweens.cancelAll();
    super.destroy(options);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.rerender();
  }

  /** Re-render after the current pointer event finishes, since render() destroys the tapped button. */
  private rerender(): void {
    queueMicrotask(() => {
      if (!this.destroyed) this.render();
    });
  }

  /** Rebuilds everything that depends on session state. Cheap enough for a handful of rows. */
  private render(): void {
    const width = this.screenW;
    if (!width) return;
    const top = ResourceBar.HEIGHT + 10;
    this.powerText.text = `Army Power ${formatNumber(this.session.power)}`;
    this.powerText.position.set(width / 2, top);

    // Size the formation grid and list rows to fit the screen height.
    const fightTop = this.fightButton.y - this.fightButton.buttonHeight / 2 - 10;
    const rows = this.tab === 'tavern' ? this.session.tavernOffers().length : this.session.trainingOffers().length;
    const free = fightTop - (top + 34) - 18 - 56;
    const rowH = Math.max(52, Math.min(64, (free * 0.55) / Math.max(rows, 4)));
    const cell = Math.max(40, Math.min(68, (free - rowH * Math.max(rows, 4)) / 3));

    const gridTop = top + 34;
    this.renderGrid(width / 2, gridTop, cell);
    this.gridHint.position.set(width / 2, gridTop + cell * 3 + 2);

    const tabsY = gridTop + cell * 3 + 18 + 28;
    this.tavernTab.position.set(PAD + this.tavernTab.buttonWidth / 2, tabsY);
    this.trainTab.position.set(width - PAD - this.trainTab.buttonWidth / 2, tabsY);
    this.tavernTab.alpha = this.tab === 'tavern' ? 1 : 0.7;
    this.trainTab.alpha = this.tab === 'train' ? 1 : 0.7;

    this.list.position.set(PAD, tabsY + 30);
    this.renderList(width - PAD * 2, rowH);
    this.bar.set(this.session.wallet.balance);
  }

  private renderGrid(cx: number, top: number, cell: number): void {
    for (const child of this.grid.removeChildren()) child.destroy({ children: true });
    const left = cx - cell * 1.5;
    // Front row on top, facing where the enemy will be; back row at the bottom.
    for (const slot of ALL_SLOTS) {
      const x = left + slot.lane * cell + cell / 2;
      const y = top + slot.row * cell + cell / 2;
      const unit = this.session.army.unitAt(slot);
      const tile = new Graphics()
        .roundRect(-cell / 2 + 3, -cell / 2 + 3, cell - 6, cell - 6, 8)
        .fill(slot.row === 0 ? COLORS.panelLight : COLORS.panel)
        .stroke({ width: 2, color: unit && unit.id === this.selected ? COLORS.rally : 0x000000, alpha: 0.6 });
      tile.position.set(x, y);
      tile.eventMode = 'static';
      tile.cursor = 'pointer';
      tile.on('pointertap', () => this.onSlotTap(slot));
      this.grid.addChild(tile);
      if (unit) {
        const type = this.session.playerCatalog.get(unit.typeId)!;
        const token = new UnitToken(this.icons, type.icon, type.role, false, false);
        token.setSize(cell * 0.72);
        token.setSelected(unit.id === this.selected);
        token.position.set(x, y);
        token.eventMode = 'none';
        this.grid.addChild(token);
      }
    }
  }

  private onSlotTap(slot: Slot): void {
    const unit = this.session.army.unitAt(slot);
    if (!this.selected) {
      this.selected = unit?.id ?? null;
    } else {
      if (unit?.id !== this.selected) this.session.moveUnit(this.selected, slot);
      this.selected = null;
    }
    this.rerender();
  }

  private renderList(width: number, rowH: number): void {
    for (const child of this.list.removeChildren()) child.destroy({ children: true });
    const rows: Container[] =
      this.tab === 'tavern'
        ? this.session.tavernOffers().map((o) => this.tavernRow(o, width, rowH))
        : this.session.trainingOffers().map((o) => this.trainRow(o, width, rowH));
    rows.forEach((row, i) => {
      row.y = i * rowH;
      this.list.addChild(row);
    });
    if (this.tab === 'tavern' && this.session.army.isFull) {
      const note = new Text({
        text: `Army full (${this.session.army.capacity}/${this.session.army.capacity}). Train units instead.`,
        style: { fontFamily: FONT, fontSize: 12, fill: COLORS.muted },
      });
      note.y = rows.length * rowH + 4;
      this.list.addChild(note);
    }
  }

  private tavernRow(offer: TavernOffer, width: number, rowH: number): Container {
    const subtitle = `${ROLE_LABELS[offer.type.role]} · Power +${formatNumber(offer.powerAfter - this.session.power)}`;
    return this.row(offer.type.icon, offer.type.role, offer.type.name, subtitle, offer.price, 'Hire', offer.canHire, width, rowH, () => {
      this.session.hire(offer.type.id);
      this.rerender();
    });
  }

  private trainRow(offer: TrainingOffer, width: number, rowH: number): Container {
    const maxed = offer.blockedBy === 'max-level';
    const subtitle = maxed ? `Lv ${offer.level} · max level` : `Lv ${offer.level} → ${offer.level + 1} · Power +${formatNumber(offer.powerAfter - this.session.power)}`;
    return this.row(offer.type.icon, offer.type.role, offer.type.name, subtitle, maxed ? null : offer.price, 'Train', offer.canTrain, width, rowH, () => {
      this.session.train(offer.type.id);
      this.rerender();
    });
  }

  private row(
    iconSlug: string,
    role: TavernOffer['type']['role'],
    name: string,
    subtitle: string,
    price: Resources | null,
    action: string,
    enabled: boolean,
    width: number,
    rowH: number,
    onTap: () => void,
  ): Container {
    const row = new Container();
    const h = rowH - 6;
    row.addChild(new Graphics().roundRect(0, 0, width, h, 10).fill(COLORS.panel));
    const token = new UnitToken(this.icons, iconSlug, role, false, false);
    token.setSize(h * 0.72);
    token.position.set(h / 2 + 2, h / 2);
    const title = new Text({ text: name, style: { fontFamily: FONT, fontSize: 15, fontWeight: 'bold', fill: COLORS.text } });
    title.position.set(h + 6, h / 2 - 18);
    const sub = new Text({ text: subtitle, style: { fontFamily: FONT, fontSize: 11, fill: COLORS.muted } });
    sub.position.set(h + 6, h / 2 + 1);
    row.addChild(token, title, sub);

    const buttonW = 96;
    // Long names shrink to fit beside the price column.
    const titleRoom = width - buttonW - 70 - title.x;
    if (title.width > titleRoom) title.scale.set(titleRoom / title.width);
    const button = new Button({ label: action, width: buttonW, height: Math.min(44, h - 4), fontSize: 15, color: COLORS.good, onTap });
    button.enabled = enabled;
    button.position.set(width - buttonW / 2 - 4, h / 2);
    row.addChild(button);

    if (price) {
      const priceRight = width - buttonW - 14;
      const goldText = this.priceText(price.gold, this.session.wallet.balance.gold >= price.gold);
      const foodText = this.priceText(price.food, this.session.wallet.balance.food >= price.food);
      goldText.position.set(priceRight, h / 2 - 9);
      foodText.position.set(priceRight, h / 2 + 10);
      const gold = this.smallIcon('two-coins', COLORS.gold, priceRight - goldText.width - 10, h / 2 - 9);
      const food = this.smallIcon('meat', COLORS.food, priceRight - foodText.width - 10, h / 2 + 10);
      row.addChild(gold, goldText, food, foodText);
    }
    return row;
  }

  private priceText(amount: number, affordable: boolean): Text {
    const t = new Text({
      text: formatNumber(amount),
      style: { fontFamily: FONT, fontSize: 14, fontWeight: 'bold', fill: affordable ? COLORS.text : COLORS.danger },
    });
    t.anchor.set(1, 0.5);
    return t;
  }

  private smallIcon(slug: string, tint: number, x: number, y: number): Sprite {
    const s = new Sprite(icon(this.icons, slug));
    s.anchor.set(0.5);
    s.tint = tint;
    s.width = s.height = 16;
    s.position.set(x, y);
    return s;
  }
}
