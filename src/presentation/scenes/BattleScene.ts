import { Container, Graphics, Rectangle, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';
import type { BattleReport, GameSession } from '../../application/GameSession';
import type { PreparedBattle } from '../../application/combat';
import { RALLY_MAX, TICK_HZ, TICK_MS, TIME_LIMIT_TICKS, type Combatant, type CombatEvent } from '../../domain/combat';
import { impactKind, PixelArt, pixelScaleFor, type ImpactKind, type UnitArtSpec } from '../art/PixelArt';
import { icon, type Icons } from '../assets/icons';
import type { PixelAssets } from '../assets/pixel';
import { Tweens } from '../Tweens';
import { COLORS, FONT } from '../theme';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import type { PixelUnit } from '../ui/PixelUnit';
import { PotionButton } from '../ui/PotionButton';
import { Scene } from './Scene';

export interface BattleActions {
  /** Back to the map once the result is seen. */
  onDone: (report: BattleReport) => void;
  /** Ruins: fight the next floor right away. */
  onNextFloor: () => void;
  /** Ruins: leave between floors, keeping what was found. */
  onRetreat: () => void;
}

const BOTTOM_PANEL = 128;
/** Never simulate more than this many ticks in one frame (after a tab switch, for example). */
const MAX_TICKS_PER_FRAME = 8;

/**
 * Auto-battle view. Steps the domain Battle at a fixed 10 Hz and plays AnimeJS tweens from the
 * CombatEvents it emits. Rendering never changes battle state; input goes through tap()/fireRally().
 */
export class BattleScene extends Scene {
  private readonly tweens = new Tweens();
  private readonly prepared: PreparedBattle;
  private readonly bar: ResourceBar;
  private readonly field = new Container();
  private readonly fieldBg = new Container();
  private readonly units = new Container({ sortableChildren: true });
  private readonly fx = new Container();
  private readonly tokens = new Map<string, PixelUnit>();
  private readonly specs = new Map<string, UnitArtSpec>();
  private readonly art: PixelArt;
  private readonly home = new Map<string, { x: number; y: number }>();
  private readonly dead = new Set<string>();
  private readonly hint: Text;
  private readonly clock: Text;
  private readonly title: Text;
  private readonly panel = new Graphics();
  private readonly meter = new Graphics();
  private readonly meterLabel: Text;
  private readonly rallyButton: Button;
  private readonly speedButton: Button;
  private readonly potionButtons = new Map<string, PotionButton>();
  private readonly overlay = new Container();
  private screenW = 0;
  private screenH = 0;
  private cell = 0;
  private speed = 1;
  private elapsed = 0;
  private tapsSeen = 0;
  private report: BattleReport | null = null;

  constructor(
    private readonly session: GameSession,
    nodeId: string,
    private readonly icons: Icons,
    pixel: PixelAssets,
    private readonly actions: BattleActions,
  ) {
    super();
    this.art = new PixelArt(pixel);
    this.prepared = session.beginBattle(nodeId);
    const node = session.battleNode!;
    const floor = session.ruinFloor;
    this.bar = new ResourceBar(icons, this.tweens);
    this.bar.set(session.wallet.balance);
    this.bar.setCaption(`${this.prepared.power} vs ${this.prepared.threat}`);
    const name = floor ? `${node.name} · Floor ${floor.index + 1}/${floor.count}` : node.name;
    this.title = new Text({ text: name, style: { fontFamily: FONT, fontWeight: 'bold', fontSize: 14, fill: COLORS.text, stroke: { color: 0x000000, width: 3 } } });
    this.title.anchor.set(0, 0.5);

    this.field.eventMode = 'static';
    this.field.on('pointerdown', (e) => this.onFieldTap(e));
    this.field.addChild(this.fieldBg, this.units);

    for (const c of this.prepared.battle.combatants) {
      const enemy = c.spec.side === 'enemy';
      const type = enemy ? this.prepared.enemyTypes.get(c.spec.id) : session.playerCatalog.get(c.spec.typeId);
      const spec: UnitArtSpec = { typeId: type?.id ?? c.spec.typeId, role: c.spec.role, enemy };
      const view = this.art.createUnit(spec, this.tweens);
      this.specs.set(c.spec.id, spec);
      this.tokens.set(c.spec.id, view);
      this.units.addChild(view);
    }

    const label = { fontFamily: FONT, fontWeight: 'bold' as const };
    this.hint = new Text({ text: 'Tap the field to rally!', style: { ...label, fontSize: 16, fill: COLORS.rally } });
    this.hint.anchor.set(0.5);
    this.clock = new Text({ text: '', style: { ...label, fontSize: 14, fill: COLORS.muted } });
    this.clock.anchor.set(1, 0.5);
    this.field.addChild(this.hint, this.clock, this.title, this.fx);
    this.tweens.play(this.hint, { alpha: [1, 0.35], duration: 700, loop: true, alternate: true, ease: 'inOutSine' });

    this.meterLabel = new Text({ text: '', style: { ...label, fontSize: 13, fill: COLORS.text } });
    this.meterLabel.anchor.set(0.5);
    this.rallyButton = new Button({
      label: 'RALLY',
      width: 200,
      height: 56,
      icon: icon(icons, 'sword-clash'),
      onTap: () => this.prepared.battle.fireRally(),
    });
    this.rallyButton.enabled = false;
    this.speedButton = new Button({
      label: '1x',
      width: 72,
      height: 56,
      color: COLORS.muted,
      icon: icon(icons, 'fast-forward-button'),
      fontSize: 16,
      onTap: () => this.toggleSpeed(),
    });
    for (const p of session.battlePotions()) {
      const color = p.effect.kind === 'heal' ? COLORS.good : COLORS.danger;
      this.potionButtons.set(p.potion.id, new PotionButton(icon(icons, p.potion.icon), color, () => this.session.usePotion(p.potion.id)));
    }
    this.addChild(this.field, this.panel, this.meter, this.meterLabel, ...this.potionButtons.values(), this.rallyButton, this.speedButton, this.bar, this.overlay);
    this.refreshHud();
  }

  layout(width: number, height: number): void {
    this.screenW = width;
    this.screenH = height;
    this.bar.layout(width);

    const top = ResourceBar.HEIGHT;
    const fieldH = height - top - BOTTOM_PANEL;
    this.field.position.set(0, top);
    this.field.hitArea = new Rectangle(0, 0, width, fieldH);
    const mid = Math.round(fieldH / 2);

    this.cell = Math.min(width / 3.6, fieldH / 6.8, 96);
    const gap = this.cell * 0.18;
    for (const c of this.prepared.battle.combatants) {
      const lane = c.spec.lane;
      const rowOffset = gap + this.cell * (c.spec.row + 0.5);
      // Whole pixels, so the pixel art stays crisp.
      const x = Math.round(width / 2 + (lane - 1) * this.cell * 1.08);
      // Front rows face each other across the middle line.
      const y = Math.round(c.spec.side === 'player' ? mid + rowOffset : mid - rowOffset);
      this.home.set(c.spec.id, { x, y });
    }
    this.layoutUnits();
    this.drawField(width, fieldH, mid);
    this.hint.position.set(width / 2, mid);
    this.clock.position.set(width - 12, mid - 14);
    this.title.position.set(12, mid - 14);

    const py = height - BOTTOM_PANEL;
    this.panel.clear().rect(0, py, width, BOTTOM_PANEL).fill(COLORS.panel);
    const buttonsY = py + 88;
    this.speedButton.position.set(width - 16 - this.speedButton.buttonWidth / 2, buttonsY);
    // Potions on the left, then Rally filling the room up to the speed toggle.
    let left = 16;
    for (const button of this.potionButtons.values()) {
      button.position.set(left + PotionButton.SIZE / 2, buttonsY);
      left += PotionButton.SIZE + 8;
    }
    this.rallyButton.resize(width - 16 - left - 8 - this.speedButton.buttonWidth);
    this.rallyButton.position.set(left + this.rallyButton.buttonWidth / 2, buttonsY);
    this.meterLabel.position.set(width / 2, py + 26);
    this.drawMeter();
    this.layoutOverlay();
  }

  override update(deltaMs: number): void {
    const battle = this.prepared.battle;
    if (battle.isOver) return;
    this.elapsed += Math.min(deltaMs, 250) * this.speed;
    let steps = 0;
    while (this.elapsed >= TICK_MS && !battle.isOver && steps < MAX_TICKS_PER_FRAME * this.speed) {
      this.elapsed -= TICK_MS;
      steps++;
      for (const event of battle.step()) this.play(event);
    }
    this.refreshHud();
  }

  override destroy(options?: Parameters<Scene['destroy']>[0]): void {
    this.tweens.cancelAll();
    super.destroy(options);
  }

  private onFieldTap(e: FederatedPointerEvent): void {
    const battle = this.prepared.battle;
    if (battle.isOver) return;
    battle.tap();
    if (++this.tapsSeen === 3) this.tweens.play(this.hint, { alpha: 0, duration: 300, loop: false });
    const p = this.field.toLocal(e.global);
    const ring = new Graphics().circle(0, 0, 18).stroke({ width: 3, color: COLORS.rally });
    ring.position.set(p.x, p.y);
    this.fx.addChild(ring);
    this.tweens.play(ring.scale, { x: [0.4, 1.6], y: [0.4, 1.6], duration: 300, ease: 'outQuad' });
    this.tweens.play(ring, { alpha: [1, 0], duration: 300, ease: 'outQuad', onComplete: () => ring.destroy() });
  }

  private toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
    this.tweens.speed = this.speed;
    this.speedButton.label = `${this.speed}x`;
  }

  private play(event: CombatEvent): void {
    switch (event.type) {
      case 'attack':
        this.playAttack(event.attackerId, event.targetId, event.damage, event.killed, event.rally);
        break;
      case 'captainHit':
        this.playHit(event.targetId, event.damage, event.killed, COLORS.rally, 'spark');
        break;
      case 'rallyFired':
        this.playRally(event.efficiency);
        break;
      case 'potionUsed':
        this.playBanner(event.effect === 'heal' ? 'Healed!' : 'Boom!', event.effect === 'heal' ? COLORS.good : COLORS.danger);
        break;
      case 'healed':
        this.playHeal(event.targetId, event.amount);
        break;
      case 'potionHit':
        this.playHit(event.targetId, event.damage, event.killed, COLORS.danger, 'magic');
        break;
      case 'ended':
        this.end();
        break;
    }
  }

  private playAttack(attackerId: string, targetId: string, damage: number, killed: boolean, rally: boolean): void {
    const attacker = this.combatant(attackerId);
    const token = this.tokens.get(attackerId);
    const spec = this.specs.get(attackerId);
    const from = this.home.get(attackerId);
    const to = this.home.get(targetId);
    if (!attacker || !token || !spec || !from || !to) return;
    const color = rally ? COLORS.rally : 0xffffff;
    const ranged = attacker.spec.stats.ranged;
    const kind = impactKind(spec, ranged);
    const impactAt = token.attack(this.tweens, to.x - from.x, to.y - from.y, ranged);
    const land = (): void => this.playHit(targetId, damage, killed, color, kind);
    this.tweens.wait(impactAt, ranged ? () => this.fireProjectile(spec, from, to, land) : land);
  }

  private fireProjectile(spec: UnitArtSpec, from: { x: number; y: number }, to: { x: number; y: number }, onArrive: () => void): void {
    const shot = this.art.projectile(spec, pixelScaleFor(this.cell));
    shot.position.set(from.x, from.y);
    shot.rotation = Math.atan2(to.y - from.y, to.x - from.x);
    this.fx.addChild(shot);
    this.tweens.play(shot, {
      x: to.x,
      y: to.y,
      duration: 220,
      ease: 'linear',
      onComplete: () => {
        shot.destroy();
        onArrive();
      },
    });
  }

  private playHit(targetId: string, damage: number, killed: boolean, color: number, kind: ImpactKind = 'spark'): void {
    const token = this.tokens.get(targetId);
    const target = this.combatant(targetId);
    const pos = this.home.get(targetId);
    if (!token || !target || !pos || this.dead.has(targetId)) return;

    token.setHp(target.hp / target.maxHp);
    token.hit(this.tweens);
    this.spawnEffect(kind, pos.x, pos.y);

    const popup = new Text({
      text: `-${damage}`,
      style: { fontFamily: FONT, fontSize: Math.round(14 + this.cell * 0.08), fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } },
    });
    popup.anchor.set(0.5);
    popup.position.set(pos.x + (Math.random() - 0.5) * this.cell * 0.4, pos.y - token.top);
    this.fx.addChild(popup);
    this.tweens.play(popup, { y: popup.y - this.cell * 0.5, alpha: [1, 0], duration: 650, ease: 'outCubic', onComplete: () => popup.destroy() });

    if (killed || target.hp <= 0) this.playDeath(targetId);
  }

  private playDeath(id: string): void {
    if (this.dead.has(id)) return;
    this.dead.add(id);
    const token = this.tokens.get(id);
    const pos = this.home.get(id);
    const c = this.combatant(id);
    if (!token || !pos || !c) return;
    token.setHp(0);
    token.die(this.tweens);
    this.tweens.wait(500, () => this.spawnEffect('dust', pos.x, pos.y + token.top * 0.8));
    if (c.spec.side === 'enemy') this.flyCoins(pos.x, pos.y);
  }

  private spawnEffect(kind: ImpactKind | 'dust', x: number, y: number): void {
    const effect = this.art.effect(kind, pixelScaleFor(this.cell), this.speed);
    effect.position.set(x, y);
    this.fx.addChild(effect);
  }

  private layoutUnits(): void {
    const scale = pixelScaleFor(this.cell);
    for (const c of this.prepared.battle.combatants) {
      const view = this.tokens.get(c.spec.id);
      const pos = this.home.get(c.spec.id);
      if (!view || !pos) continue;
      view.position.set(pos.x, pos.y);
      view.zIndex = pos.y; // lower rows overlap the rows behind them
      view.setSize(scale);
      view.setHp(c.hp / c.maxHp);
    }
  }

  private drawField(width: number, height: number, mid: number): void {
    for (const child of this.fieldBg.removeChildren()) child.destroy({ children: true });
    this.art.drawField(this.fieldBg, { width, height, mid, cell: this.cell, pixelScale: pixelScaleFor(this.cell), slots: [...this.home.values()] });
  }

  /** Coins arc from the fallen enemy to the gold counter (GDD 02 moment-to-moment loop). */
  private flyCoins(x: number, y: number): void {
    const target = this.field.toLocal(this.bar.goldIcon.getGlobalPosition());
    for (let i = 0; i < 3; i++) {
      const coin = new Sprite(icon(this.icons, 'two-coins'));
      coin.anchor.set(0.5);
      coin.tint = COLORS.gold;
      coin.width = coin.height = Math.max(16, this.cell * 0.22);
      coin.position.set(x + (i - 1) * 10, y);
      this.fx.addChild(coin);
      this.tweens.play(coin, {
        x: { to: target.x, ease: 'inQuad' },
        y: { to: target.y, ease: 'inBack' },
        duration: 650,
        delay: i * 70,
        onComplete: () => {
          coin.destroy();
          this.bar.pulse(this.bar.goldIcon);
        },
      });
    }
  }

  private playRally(efficiency: number): void {
    this.playBanner(efficiency < 1 ? 'Rally (auto)' : 'RALLY!', COLORS.rally);
  }

  private playHeal(targetId: string, amount: number): void {
    const token = this.tokens.get(targetId);
    const target = this.combatant(targetId);
    const pos = this.home.get(targetId);
    if (!token || !target || !pos || this.dead.has(targetId)) return;
    token.setHp(target.hp / target.maxHp);
    const glow = new Graphics().circle(0, 0, this.cell * 0.4).fill({ color: COLORS.good, alpha: 0.35 });
    glow.position.set(pos.x, pos.y - token.top / 2);
    this.fx.addChild(glow);
    this.tweens.play(glow.scale, { x: [0.5, 1.3], y: [0.5, 1.3], duration: 500, ease: 'outQuad' });
    this.tweens.play(glow, { alpha: [1, 0], duration: 500, ease: 'outQuad', onComplete: () => glow.destroy() });
    const popup = new Text({
      text: `+${amount}`,
      style: { fontFamily: FONT, fontSize: Math.round(14 + this.cell * 0.08), fontWeight: 'bold', fill: COLORS.good, stroke: { color: 0x000000, width: 3 } },
    });
    popup.anchor.set(0.5);
    popup.position.set(pos.x, pos.y - token.top);
    this.fx.addChild(popup);
    this.tweens.play(popup, { y: popup.y - this.cell * 0.5, alpha: [1, 0], duration: 800, ease: 'outCubic', onComplete: () => popup.destroy() });
  }

  /** Big word across the middle of the field. */
  private playBanner(label: string, color: number): void {
    const text = new Text({
      text: label,
      style: { fontFamily: FONT, fontSize: 42, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 5 }, padding: 6 },
    });
    // Never wider than the screen on a narrow phone.
    const room = this.screenW - 32;
    if (text.width > room) text.scale.set(room / text.width);
    text.anchor.set(0.5);
    text.position.set(this.screenW / 2, (this.screenH - ResourceBar.HEIGHT - BOTTOM_PANEL) / 2);
    this.fx.addChild(text);
    const s = text.scale.x;
    this.tweens.play(text.scale, { x: [0.3 * s, 1.1 * s, s], y: [0.3 * s, 1.1 * s, s], duration: 400, ease: 'outBack' });
    this.tweens.play(text, { alpha: [1, 1, 0], duration: 1100, ease: 'inQuad', onComplete: () => text.destroy() });
  }

  private end(): void {
    this.report = this.session.finishBattle();
    this.rallyButton.enabled = false;
    for (const [id, button] of this.potionButtons) button.set(this.session.satchel.count(id), false, 0);
    this.tweens.wait(700, () => this.showResults());
  }

  private showResults(): void {
    const report = this.report;
    if (!report || this.overlay.children.length) return;
    const won = report.outcome.winner === 'player';
    const title = won ? (report.regionCleared ? 'Region cleared!' : 'Victory!') : report.outcome.reason === 'timeout' ? "Time's up" : 'Defeated';
    const dim = new Graphics();
    dim.eventMode = 'static'; // swallow taps meant for the field
    const panel = new Graphics();
    const style = { fontFamily: FONT, fontWeight: 'bold' as const };
    const heading = new Text({ text: title, style: { ...style, fontSize: 34, fill: won ? COLORS.good : COLORS.danger } });
    const node = this.session.node(report.nodeId);
    const floor = report.floor;
    let line: string;
    if (!won) line = floor ? `Floor ${floor.index + 1} lost: the run is over` : 'Partial loot. Try again!';
    else if (report.nextFloor && floor) line = `Floor ${floor.index + 1} of ${floor.count} cleared. No healing below!`;
    else if (report.regionCleared) line = 'The Bandit Chief has fallen.';
    else if (report.treasure) line = 'Treasure at the bottom of the ruin!';
    else if (report.revealed.length) line = `${node.name} cleared. New paths open!`;
    else line = `${node.name} cleared`;
    const subtitle = new Text({ text: line, style: { ...style, fontSize: 14, fill: COLORS.muted, wordWrap: true, wordWrapWidth: Math.min(this.screenW - 64, 320), align: 'center' } });
    const loot = new Text({
      text: `+${report.loot.gold} gold   +${report.loot.food} food`,
      style: { ...style, fontSize: 20, fill: COLORS.gold },
    });
    for (const t of [heading, subtitle, loot]) t.anchor.set(0.5);
    const buttons = new Container();
    const done = (): void => this.actions.onDone(report);
    if (report.nextFloor) {
      buttons.addChild(
        new Button({ label: 'Retreat', width: 140, icon: icon(this.icons, 'run'), color: COLORS.muted, onTap: this.actions.onRetreat }),
        new Button({ label: 'Next floor', width: 160, icon: icon(this.icons, 'ancient-ruins'), onTap: this.actions.onNextFloor }),
      );
      buttons.children[0]!.x = -82;
      buttons.children[1]!.x = 72;
    } else {
      buttons.addChild(new Button({ label: 'To map', width: 220, icon: icon(this.icons, 'treasure-map'), onTap: done }));
    }
    const button = buttons;
    dim.label = 'dim';
    panel.label = 'panel';
    this.overlay.addChild(dim, panel, heading, subtitle, loot, button);
    this.layoutOverlay();
    this.overlay.alpha = 0;
    this.tweens.play(this.overlay, { alpha: 1, duration: 250, ease: 'outQuad' });
    this.bar.set(this.session.wallet.balance, true);
  }

  private layoutOverlay(): void {
    if (!this.overlay.children.length) return;
    const [dim, panel, heading, subtitle, loot, button] = this.overlay.children as [Graphics, Graphics, Text, Text, Text, Container];
    const w = Math.min(this.screenW - 32, 360);
    const h = 250;
    const cx = this.screenW / 2;
    const cy = this.screenH / 2;
    dim.clear().rect(0, ResourceBar.HEIGHT, this.screenW, this.screenH - ResourceBar.HEIGHT).fill({ color: 0x000000, alpha: 0.6 });
    panel.clear().roundRect(cx - w / 2, cy - h / 2, w, h, 16).fill(COLORS.panel).stroke({ width: 2, color: COLORS.panelLight });
    heading.position.set(cx, cy - 80);
    subtitle.position.set(cx, cy - 42);
    loot.position.set(cx, cy);
    button.position.set(cx, cy + 70);
  }

  private refreshHud(): void {
    const battle = this.prepared.battle;
    this.rallyButton.enabled = battle.rallyReady && !battle.isOver;
    const left = Math.max(0, Math.ceil((TIME_LIMIT_TICKS - battle.tick) / TICK_HZ));
    this.clock.text = `${left}s`;
    for (const p of this.session.battlePotions()) this.potionButtons.get(p.potion.id)?.set(p.owned, p.canUse, p.cooldown);
    this.meterLabel.text = battle.rallyReady ? 'Rally ready!' : `Rally ${battle.rally}/${RALLY_MAX}`;
    this.drawMeter();
  }

  private drawMeter(): void {
    if (!this.screenW) return;
    const battle = this.prepared.battle;
    const x = 16;
    const y = this.screenH - BOTTOM_PANEL + 16;
    const w = this.screenW - 32;
    const h = 20;
    this.meter
      .clear()
      .roundRect(x, y, w, h, 6)
      .fill(0x000000)
      .roundRect(x, y, Math.max(0, w * (battle.rally / RALLY_MAX)), h, 6)
      .fill(battle.rallyReady ? COLORS.gold : COLORS.rally);
  }

  private combatant(id: string): Combatant | undefined {
    return this.prepared.battle.get(id);
  }
}
