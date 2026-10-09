import { Container, Graphics, Rectangle, Sprite, Text, type FederatedPointerEvent } from 'pixi.js';
import type { BattleReport, GameSession } from '../../application/GameSession';
import type { PreparedBattle } from '../../application/combat';
import { RALLY_MAX, TICK_HZ, TICK_MS, TIME_LIMIT_TICKS, type Combatant, type CombatEvent } from '../../domain/combat';
import { icon, type Icons } from '../assets/icons';
import { Tweens } from '../Tweens';
import { COLORS, FONT, ROLE_COLORS } from '../theme';
import { Button } from '../ui/Button';
import { ResourceBar } from '../ui/ResourceBar';
import { UnitToken } from '../ui/UnitToken';
import { Scene } from './Scene';

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
  private readonly fieldBg = new Graphics();
  private readonly fx = new Container();
  private readonly tokens = new Map<string, UnitToken>();
  private readonly home = new Map<string, { x: number; y: number }>();
  private readonly dead = new Set<string>();
  private readonly hint: Text;
  private readonly clock: Text;
  private readonly panel = new Graphics();
  private readonly meter = new Graphics();
  private readonly meterLabel: Text;
  private readonly rallyButton: Button;
  private readonly speedButton: Button;
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
    private readonly icons: Icons,
    private readonly onContinue: () => void,
  ) {
    super();
    this.prepared = session.beginBattle();
    this.bar = new ResourceBar(icons, this.tweens);
    this.bar.set(session.wallet.balance);
    this.bar.setCaption(`Wave ${session.wave} · ${this.prepared.power} vs ${this.prepared.threat}`);

    this.field.eventMode = 'static';
    this.field.on('pointerdown', (e) => this.onFieldTap(e));
    this.field.addChild(this.fieldBg);

    for (const c of this.prepared.battle.combatants) {
      const enemy = c.spec.side === 'enemy';
      const slug = enemy
        ? (this.prepared.enemyTypes.get(c.spec.id)?.icon ?? 'pirate-skull')
        : (session.playerCatalog.get(c.spec.typeId)?.icon ?? 'broadsword');
      const token = new UnitToken(icons, slug, c.spec.role, enemy);
      this.tokens.set(c.spec.id, token);
      this.field.addChild(token);
    }

    const label = { fontFamily: FONT, fontWeight: 'bold' as const };
    this.hint = new Text({ text: 'Tap the field to rally!', style: { ...label, fontSize: 16, fill: COLORS.rally } });
    this.hint.anchor.set(0.5);
    this.clock = new Text({ text: '', style: { ...label, fontSize: 14, fill: COLORS.muted } });
    this.clock.anchor.set(1, 0.5);
    this.field.addChild(this.hint, this.clock, this.fx);
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

    this.addChild(this.field, this.panel, this.meter, this.meterLabel, this.rallyButton, this.speedButton, this.bar, this.overlay);
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
    this.fieldBg.clear().rect(0, 0, width, fieldH).fill(COLORS.background);
    const mid = fieldH / 2;
    this.fieldBg.rect(0, 0, width, mid).fill({ color: COLORS.enemy, alpha: 0.18 });
    this.fieldBg.moveTo(16, mid).lineTo(width - 16, mid).stroke({ width: 2, color: COLORS.muted, alpha: 0.3 });

    this.cell = Math.min(width / 3.6, fieldH / 6.8, 96);
    const gap = this.cell * 0.18;
    for (const c of this.prepared.battle.combatants) {
      const lane = c.spec.lane;
      const rowOffset = gap + this.cell * (c.spec.row + 0.5);
      const x = width / 2 + (lane - 1) * this.cell * 1.08;
      // Front rows face each other across the middle line.
      const y = c.spec.side === 'player' ? mid + rowOffset : mid - rowOffset;
      this.home.set(c.spec.id, { x, y });
      const token = this.tokens.get(c.spec.id)!;
      token.position.set(x, y);
      token.setSize(this.cell * 0.78);
      token.setHp(c.hp / c.maxHp);
    }
    this.hint.position.set(width / 2, mid);
    this.clock.position.set(width - 12, mid - 14);

    const py = height - BOTTOM_PANEL;
    this.panel.clear().rect(0, py, width, BOTTOM_PANEL).fill(COLORS.panel);
    const buttonsY = py + 88;
    this.speedButton.position.set(width - 16 - this.speedButton.buttonWidth / 2, buttonsY);
    this.rallyButton.resize(width - 48 - this.speedButton.buttonWidth);
    this.rallyButton.position.set(16 + this.rallyButton.buttonWidth / 2, buttonsY);
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
        this.playHit(event.targetId, event.damage, event.killed, COLORS.rally);
        break;
      case 'rallyFired':
        this.playRally(event.efficiency);
        break;
      case 'ended':
        this.end();
        break;
    }
  }

  private playAttack(attackerId: string, targetId: string, damage: number, killed: boolean, rally: boolean): void {
    const attacker = this.combatant(attackerId);
    const token = this.tokens.get(attackerId);
    const from = this.home.get(attackerId);
    const to = this.home.get(targetId);
    if (!attacker || !token || !from || !to) return;
    const color = rally ? COLORS.rally : 0xffffff;

    if (attacker.spec.stats.ranged) {
      const shot = new Graphics().circle(0, 0, Math.max(4, this.cell * 0.07)).fill(ROLE_COLORS[attacker.spec.role]);
      shot.position.set(from.x, from.y);
      this.fx.addChild(shot);
      this.tweens.play(shot, {
        x: to.x,
        y: to.y,
        duration: 220,
        ease: 'linear',
        onComplete: () => {
          shot.destroy();
          this.playHit(targetId, damage, killed, color);
        },
      });
      return;
    }

    // Melee: lunge a third of the way to the target and back; the hit lands at the peak.
    const dx = (to.x - from.x) * 0.35;
    const dy = (to.y - from.y) * 0.35;
    this.tweens.play(token.body, { x: [0, dx, 0], y: [0, dy, 0], duration: 240, ease: 'outQuad' });
    this.tweens.wait(110, () => this.playHit(targetId, damage, killed, color));
  }

  private playHit(targetId: string, damage: number, killed: boolean, color: number): void {
    const token = this.tokens.get(targetId);
    const target = this.combatant(targetId);
    const pos = this.home.get(targetId);
    if (!token || !target || !pos || this.dead.has(targetId)) return;

    token.setHp(target.hp / target.maxHp);
    this.tweens.play(token.flashLayer, { alpha: [0.85, 0], duration: 160, ease: 'outQuad' });
    this.tweens.play(token.body.scale, { x: [1.18, 1], y: [0.84, 1], duration: 200, ease: 'outBack' });

    const popup = new Text({
      text: `-${damage}`,
      style: { fontFamily: FONT, fontSize: Math.round(14 + this.cell * 0.08), fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 3 } },
    });
    popup.anchor.set(0.5);
    popup.position.set(pos.x + (Math.random() - 0.5) * this.cell * 0.4, pos.y - token.radius);
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
    this.tweens.play(token, { alpha: 0, duration: 380, ease: 'inQuad' });
    this.tweens.play(token.scale, { x: 0.5, y: 0.5, duration: 380, ease: 'inQuad' });
    if (c.spec.side === 'enemy') this.flyCoins(pos.x, pos.y);
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
    const text = new Text({
      text: efficiency < 1 ? 'Rally (auto)' : 'RALLY!',
      style: { fontFamily: FONT, fontSize: 42, fontWeight: 'bold', fill: COLORS.rally, stroke: { color: 0x000000, width: 5 } },
    });
    text.anchor.set(0.5);
    text.position.set(this.screenW / 2, (this.screenH - ResourceBar.HEIGHT - BOTTOM_PANEL) / 2);
    this.fx.addChild(text);
    this.tweens.play(text.scale, { x: [0.3, 1.1, 1], y: [0.3, 1.1, 1], duration: 400, ease: 'outBack' });
    this.tweens.play(text, { alpha: [1, 1, 0], duration: 1100, ease: 'inQuad', onComplete: () => text.destroy() });
  }

  private end(): void {
    this.report = this.session.finishBattle();
    this.rallyButton.enabled = false;
    this.tweens.wait(700, () => this.showResults());
  }

  private showResults(): void {
    const report = this.report;
    if (!report || this.overlay.children.length) return;
    const won = report.outcome.winner === 'player';
    const title = won ? 'Victory!' : report.outcome.reason === 'timeout' ? "Time's up" : 'Defeated';
    const dim = new Graphics();
    dim.eventMode = 'static'; // swallow taps meant for the field
    const panel = new Graphics();
    const style = { fontFamily: FONT, fontWeight: 'bold' as const };
    const heading = new Text({ text: title, style: { ...style, fontSize: 36, fill: won ? COLORS.good : COLORS.danger } });
    const subtitle = new Text({
      text: won ? `Wave ${report.wave} cleared` : `Wave ${report.wave}: partial loot`,
      style: { ...style, fontSize: 16, fill: COLORS.muted },
    });
    const loot = new Text({
      text: `+${report.loot.gold} gold   +${report.loot.food} food`,
      style: { ...style, fontSize: 20, fill: COLORS.gold },
    });
    for (const t of [heading, subtitle, loot]) t.anchor.set(0.5);
    const button = new Button({ label: 'To camp', width: 220, icon: icon(this.icons, 'camping-tent'), onTap: this.onContinue });
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
    const [dim, panel, heading, subtitle, loot, button] = this.overlay.children as [Graphics, Graphics, Text, Text, Text, Button];
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
