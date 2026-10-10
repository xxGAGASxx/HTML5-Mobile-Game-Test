import { Container, Graphics, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';
import type { GameSession, TavernOffer, TrainingOffer } from '../../application/GameSession';
import { ALL_SLOTS, type Slot } from '../../domain/army';
import type { Resources } from '../../domain/economy';
import { icon, type Icons } from '../assets/icons';
import type { PixelAssets } from '../assets/pixel';
import { formatNumber } from '../format';
import { Tweens } from '../Tweens';
import { COLORS, FONT, ROLE_LABELS } from '../theme';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import { PixelUnit } from '../ui/PixelUnit';
import { Scene } from './Scene';

type Tab = 'tavern' | 'train';

const PAD = 16;
/** Pointer travel (px) before a press on a unit becomes a drag instead of a tap. */
const DRAG_THRESHOLD = 8;

/** A press on a formation tile; with a unit on it, it turns into a drag once the pointer travels. */
interface Press {
  from: Slot;
  startX: number;
  startY: number;
  unit?: { id: string; token: PixelUnit };
  dragging: boolean;
}

/** Between battles: see the army, hire at the tavern, train unit types, then head back out to the map. */
export class CampScene extends Scene {
  private readonly tweens = new Tweens();
  private readonly bar: ResourceBar;
  private readonly powerText: Text;
  private readonly grid = new Container();
  private readonly gridHint: Text;
  private readonly tavernTab: Button;
  private readonly trainTab: Button;
  private readonly list = new Container();
  private readonly mapButton: Button;
  private readonly galleryButton: Button;
  private readonly credits: Text;
  private tab: Tab = 'tavern';
  private selected: string | null = null;
  private press: Press | null = null;
  private gridGeometry = { left: 0, top: 0, cell: 0 };
  private readonly tiles = new Map<string, Graphics>();
  private screenW = 0;

  constructor(
    private readonly session: GameSession,
    private readonly icons: Icons,
    private readonly pixel: PixelAssets,
    onMap: () => void,
    onGallery: () => void,
  ) {
    super();
    this.bar = new ResourceBar(icons, this.tweens);
    this.bar.set(session.wallet.balance);
    const bold = { fontFamily: FONT, fontWeight: 'bold' as const };
    this.powerText = new Text({ text: '', style: { ...bold, fontSize: 22, fill: COLORS.text } });
    this.powerText.anchor.set(0.5, 0);
    this.gridHint = new Text({ text: 'Drag a unit to move it', style: { fontFamily: FONT, fontSize: 12, fill: COLORS.muted } });
    this.gridHint.anchor.set(0.5, 0);
    this.tavernTab = new Button({ label: 'Tavern', width: 150, height: 44, fontSize: 16, onTap: () => this.setTab('tavern') });
    this.trainTab = new Button({ label: 'Train', width: 150, height: 44, fontSize: 16, onTap: () => this.setTab('train') });
    this.mapButton = new Button({
      label: 'To map',
      width: 300,
      height: 60,
      fontSize: 20,
      icon: icon(icons, 'treasure-map'),
      onTap: () => {
        this.mapButton.enabled = false; // one scene change per tap, even on a double tap
        onMap();
      },
    });
    // Unit gallery: every unit looping its animations.
    this.galleryButton = new Button({ label: 'Units', width: 80, height: 60, fontSize: 16, color: COLORS.text, onTap: onGallery });
    this.credits = new Text({
      text: 'Icons by Lorc, Delapouite & Skoll · game-icons.net · CC BY 3.0',
      style: { fontFamily: FONT, fontSize: 10, fill: COLORS.muted },
    });
    this.credits.anchor.set(0.5, 1);
    this.grid.eventMode = 'static';
    this.grid.on('globalpointermove', (e) => this.onDragMove(e));
    this.addChild(this.powerText, this.grid, this.gridHint, this.tavernTab, this.trainTab, this.list, this.mapButton, this.galleryButton, this.credits, this.bar);
    this.bar.setCaption('Wreck Camp');
  }

  layout(width: number, height: number): void {
    this.screenW = width;
    this.bar.layout(width);
    this.mapButton.resize(width - PAD * 3 - this.galleryButton.buttonWidth);
    this.mapButton.position.set(PAD + this.mapButton.buttonWidth / 2, height - 24 - this.mapButton.buttonHeight / 2);
    this.galleryButton.position.set(width - PAD - this.galleryButton.buttonWidth / 2, this.mapButton.y);
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
    const buttonTop = this.mapButton.y - this.mapButton.buttonHeight / 2 - 10;
    const rows = this.tab === 'tavern' ? this.session.tavernOffers().length : this.session.trainingOffers().length;
    const free = buttonTop - (top + 34) - 18 - 56;
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
    this.tiles.clear();
    this.press = null;
    const left = cx - cell * 1.5;
    this.gridGeometry = { left, top, cell };
    // Front row on top, facing where the enemy will be; back row at the bottom.
    for (const slot of ALL_SLOTS) {
      const x = left + slot.lane * cell + cell / 2;
      const y = top + slot.row * cell + cell / 2;
      const unit = this.session.army.unitAt(slot);
      const tile = new Graphics();
      this.drawTile(tile, slot, cell, unit !== undefined && unit.id === this.selected);
      tile.position.set(x, y);
      tile.eventMode = 'static';
      tile.cursor = unit ? 'grab' : 'pointer';
      this.tiles.set(slotKey(slot), tile);
      this.grid.addChild(tile);
      let held: Press['unit'];
      if (unit) {
        const token = this.portrait(unit.typeId, cell);
        token.setSelected(unit.id === this.selected);
        // The type's training level in the tile's top-left corner; it rides along when the unit is dragged.
        const level = new Text({
          text: `Lv ${this.session.levels.of(unit.typeId)}`,
          style: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', fill: COLORS.text, stroke: { color: COLORS.background, width: 3 } },
        });
        level.position.set(-cell / 2 + 6, -cell / 2 + 4);
        token.addChild(level);
        token.position.set(x, y);
        token.eventMode = 'none';
        this.grid.addChild(token);
        held = { id: unit.id, token };
      }
      tile.on('pointerdown', (e) => {
        this.press = { from: slot, startX: e.global.x, startY: e.global.y, unit: held, dragging: false };
      });
      // Only the pressed tile handles the release: pointerup if it ends on it, pointerupoutside if not.
      tile.on('pointerup', (e) => this.onRelease(slot, e));
      tile.on('pointerupoutside', (e) => this.onRelease(slot, e));
    }
  }

  private drawTile(tile: Graphics, slot: Slot, cell: number, highlight: boolean): void {
    tile
      .clear()
      .roundRect(-cell / 2 + 3, -cell / 2 + 3, cell - 6, cell - 6, 8)
      .fill(slot.row === 0 ? COLORS.panelLight : COLORS.panel)
      .stroke({ width: 2, color: highlight ? COLORS.rally : 0x000000, alpha: highlight ? 1 : 0.6 });
  }

  /** The formation slot under a global point, if any. */
  private slotAt(globalX: number, globalY: number): Slot | undefined {
    const p = this.grid.toLocal({ x: globalX, y: globalY });
    const { left, top, cell } = this.gridGeometry;
    const lane = Math.floor((p.x - left) / cell);
    const row = Math.floor((p.y - top) / cell);
    return ALL_SLOTS.find((s) => s.lane === lane && s.row === row);
  }

  private onDragMove(e: FederatedPointerEvent): void {
    const press = this.press;
    if (!press?.unit) return;
    const token = press.unit.token;
    if (!press.dragging) {
      if (Math.hypot(e.global.x - press.startX, e.global.y - press.startY) < DRAG_THRESHOLD) return;
      press.dragging = true;
      this.selected = null;
      token.setSelected(false);
      token.scale.set(1.2);
      token.alpha = 0.9;
      this.grid.addChild(token); // on top of every tile
      this.grid.cursor = 'grabbing';
    }
    const p = this.grid.toLocal(e.global);
    token.position.set(p.x, p.y);
    const target = this.slotAt(e.global.x, e.global.y);
    const { cell } = this.gridGeometry;
    for (const slot of ALL_SLOTS) this.drawTile(this.tiles.get(slotKey(slot))!, slot, cell, target !== undefined && sameSlot(slot, target));
  }

  private onRelease(tile: Slot, e: FederatedPointerEvent): void {
    const press = this.press;
    if (!press || !sameSlot(press.from, tile)) return;
    this.press = null;
    if (press.dragging && press.unit) {
      this.grid.cursor = 'default';
      const target = this.slotAt(e.global.x, e.global.y);
      // Dropping on another slot moves the unit there, swapping with whoever stands in it.
      if (target && !sameSlot(target, press.from)) this.session.moveUnit(press.unit.id, target);
      this.rerender();
      return;
    }
    // A plain tap keeps the tap-two-slots way of swapping.
    if (e.type === 'pointerup') this.onSlotTap(tile);
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
    return this.row(offer.type.id, offer.type.name, subtitle, offer.price, 'Hire', offer.canHire, width, rowH, () => {
      this.session.hire(offer.type.id);
      this.rerender();
    });
  }

  private trainRow(offer: TrainingOffer, width: number, rowH: number): Container {
    const maxed = offer.blockedBy === 'max-level';
    const subtitle = maxed ? `Lv ${offer.level} · max level` : `Lv ${offer.level} → ${offer.level + 1} · Power +${formatNumber(offer.powerAfter - this.session.power)}`;
    return this.row(offer.type.id, offer.type.name, subtitle, maxed ? null : offer.price, 'Train', offer.canTrain, width, rowH, () => {
      this.session.train(offer.type.id);
      this.rerender();
    });
  }

  private row(
    typeId: string,
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
    const token = this.portrait(typeId, h);
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

  /** Idle pixel sprite of a unit type, at the largest whole zoom that fits a `box` px square. */
  private portrait(typeId: string, box: number): PixelUnit {
    const unit = new PixelUnit(this.pixel, typeId, () => 1, false);
    unit.setSize(Math.max(1, Math.floor(box / 40)));
    return unit;
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

function slotKey(slot: Slot): string {
  return `${slot.row}:${slot.lane}`;
}

function sameSlot(a: Slot, b: Slot): boolean {
  return a.row === b.row && a.lane === b.lane;
}
