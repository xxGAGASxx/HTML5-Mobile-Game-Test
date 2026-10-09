import { Container, Text } from 'pixi.js';
import type { UnitType } from '../../domain/army';
import { ART_STYLE_LABELS, getArtStyle, nextArtStyle, setArtStyle } from '../art/ArtStyle';
import { createBattleArt, impactKind, pixelScaleFor, type BattleArt, type UnitArtSpec } from '../art/BattleArt';
import type { Icons } from '../assets/icons';
import type { PixelAssets } from '../assets/pixel';
import { Tweens } from '../Tweens';
import { COLORS, FONT } from '../theme';
import { Button } from '../ui/Button';
import type { UnitView } from '../ui/UnitView';
import { Scene } from './Scene';

const COLS = 3;
const FOOTER = 96;

interface Slot {
  spec: UnitArtSpec;
  ranged: boolean;
  label: Text;
  view: UnitView | null;
  x: number;
  y: number;
}

/**
 * Style test gallery (open with `?gallery`): every unit in a grid, looping attack, hit and death,
 * so each art style can be judged on the whole roster, not only the units wave 1 happens to field.
 */
export class GalleryScene extends Scene {
  private readonly tweens = new Tweens();
  private readonly backdrop = new Container();
  private readonly units = new Container({ sortableChildren: true });
  private readonly fx = new Container();
  private readonly slots: Slot[];
  private readonly styleButton: Button;
  private readonly backButton: Button;
  private readonly title: Text;
  private art: BattleArt;
  private screenW = 0;
  private screenH = 0;
  private cell = 0;
  private generation = 0;

  constructor(
    types: readonly { type: UnitType; enemy: boolean }[],
    private readonly icons: Icons,
    private readonly pixel: PixelAssets,
    onBack: () => void,
  ) {
    super();
    this.art = createBattleArt(getArtStyle(), icons, pixel);
    this.slots = types.map(({ type, enemy }) => {
      const label = new Text({ text: type.name, style: { fontFamily: FONT, fontSize: 12, fontWeight: 'bold', fill: COLORS.text, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 0);
      return { spec: { typeId: type.id, icon: type.icon, role: type.role, enemy }, ranged: type.stats.ranged, label, view: null, x: 0, y: 0 };
    });
    this.title = new Text({ text: 'Art style test', style: { fontFamily: FONT, fontSize: 18, fontWeight: 'bold', fill: COLORS.text } });
    this.title.anchor.set(0.5);
    this.styleButton = new Button({ label: ART_STYLE_LABELS[this.art.style], width: 200, height: 56, color: COLORS.text, onTap: () => this.switchStyle() });
    this.backButton = new Button({ label: 'Back', width: 96, height: 56, color: COLORS.muted, onTap: onBack });
    this.addChild(this.backdrop, this.units, this.fx, ...this.slots.map((s) => s.label), this.title, this.styleButton, this.backButton);
  }

  layout(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
    const rows = Math.ceil(this.slots.length / COLS);
    const top = 48;
    const areaH = height - top - FOOTER;
    this.cell = Math.min(width / (COLS + 0.4), areaH / (rows + 0.2), 120);
    const gridW = this.cell * COLS;
    const rowH = Math.min(areaH / rows, this.cell * 1.5);
    for (const [i, slot] of this.slots.entries()) {
      slot.x = Math.round(width / 2 - gridW / 2 + this.cell * ((i % COLS) + 0.5));
      slot.y = Math.round(top + areaH / 2 - (rowH * rows) / 2 + rowH * (Math.floor(i / COLS) + 0.45));
      slot.label.position.set(slot.x, Math.round(slot.y + this.cell * 0.4));
    }
    this.title.position.set(width / 2, 24);
    this.styleButton.resize(width - 48 - this.backButton.buttonWidth);
    this.styleButton.position.set(16 + this.styleButton.buttonWidth / 2, height - FOOTER / 2);
    this.backButton.position.set(width - 16 - this.backButton.buttonWidth / 2, height - FOOTER / 2);
    this.rebuild();
  }

  override update(): void {}

  override destroy(options?: Parameters<Scene['destroy']>[0]): void {
    this.tweens.cancelAll();
    super.destroy(options);
  }

  private switchStyle(): void {
    const style = nextArtStyle(this.art.style);
    setArtStyle(style);
    this.art = createBattleArt(style, this.icons, this.pixel);
    this.styleButton.label = ART_STYLE_LABELS[style];
    this.rebuild();
  }

  private rebuild(): void {
    this.generation++;
    this.tweens.cancelAll();
    for (const c of [...this.backdrop.removeChildren(), ...this.fx.removeChildren()]) c.destroy({ children: true });
    const mid = Math.round((this.screenH - FOOTER) / 2);
    this.art.drawField(this.backdrop, {
      width: this.screenW,
      height: this.screenH - FOOTER,
      mid,
      cell: this.cell,
      pixelScale: pixelScaleFor(this.cell),
      slots: this.slots,
    });
    for (const [i, slot] of this.slots.entries()) {
      this.spawn(slot);
      this.tweens.wait(400 + i * 250, () => this.cycle(slot, 0, this.generation));
    }
  }

  private spawn(slot: Slot): void {
    slot.view?.destroy({ children: true });
    const view = this.art.createUnit(slot.spec, this.tweens);
    view.position.set(slot.x, slot.y);
    view.zIndex = slot.y;
    view.setSize(this.cell * 0.78 * 0.9, pixelScaleFor(this.cell));
    this.units.addChild(view);
    slot.view = view;
  }

  /** attack -> hit -> attack -> hit -> death -> respawn, forever. */
  private cycle(slot: Slot, step: number, generation: number): void {
    if (generation !== this.generation || !slot.view) return;
    const view = slot.view;
    const dy = (slot.spec.enemy ? 1 : -1) * this.cell * 0.6;
    const next = (ms: number): void => this.tweens.wait(ms, () => this.cycle(slot, step + 1, generation));
    switch (step % 5) {
      case 0:
      case 2: {
        const at = view.attack(this.tweens, 0, dy, slot.ranged);
        this.tweens.wait(at, () => this.effect(impactKind(slot.spec, slot.ranged), slot.x, slot.y + dy * 0.6));
        next(1100);
        break;
      }
      case 1:
      case 3:
        view.hit(this.tweens);
        this.effect('spark', slot.x, slot.y);
        view.setHp(step % 5 === 1 ? 0.6 : 0.25);
        next(1000);
        break;
      default:
        view.setHp(0);
        view.die(this.tweens);
        this.tweens.wait(500, () => this.effect('dust', slot.x, slot.y + view.top * 0.8));
        this.tweens.wait(1700, () => {
          if (generation !== this.generation) return;
          this.spawn(slot);
          next(600);
        });
    }
  }

  private effect(kind: Parameters<BattleArt['effect']>[0], x: number, y: number): void {
    const fx = this.art.effect(kind, pixelScaleFor(this.cell), 1);
    if (!fx) return;
    fx.position.set(x, y);
    this.fx.addChild(fx);
  }
}
