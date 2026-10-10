import { AnimatedSprite, Container, Graphics, Rectangle, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js';
import type { GameSession, NodeInfo } from '../../application/GameSession';
import type { Resources } from '../../domain/economy';
import type { NodeKind, ThreatLabel } from '../../domain/exploration';
import { icon, type Icons } from '../assets/icons';
import type { MapAsset } from '../assets/maps';
import { frames, type PixelAssets } from '../assets/pixel';
import { formatNumber } from '../format';
import { FOG_LEVELS, fogDensity, type FogHole } from '../map/FogOfWar';
import { RoadNetwork, type Leg, type RoadPos } from '../map/RoadNetwork';
import { Tweens } from '../Tweens';
import { COLORS, FONT } from '../theme';
import { Button } from '../ui/Button';
import { PixelUnit } from '../ui/PixelUnit';
import { ResourceBar } from '../ui/ResourceBar';
import { Scene } from './Scene';

const BOTTOM_BAR = 76;
const CARD_H = 236;
const PAD = 16;
/** Pointer travel (px) before a press on the map becomes a pan instead of a tap. */
const DRAG_THRESHOLD = 8;
/** Pan speed keeps this share of itself per 16 ms frame after a flick. */
const FRICTION = 0.9;
/** Party walking speed, in map art pixels per second. */
const WALK_SPEED = 80;
/** How far from a road (screen px) a tap still counts as a tap on it. */
const ROAD_TAP_RADIUS = 26;
/** Fog is drawn in blocks of this many art pixels, so its dithered edge reads as pixel art. */
const FOG_CELL = 2;
/** Fog colour and its opacity at each density level (0 is clear). */
const FOG_RGB = [0x4a, 0x55, 0x62] as const;
const FOG_ALPHA = [0, 0.5, 0.8, 1] as const;

export const THREAT_COLORS: Record<ThreatLabel, number> = {
  trivial: 0x9aa4ac,
  easy: COLORS.good,
  fair: COLORS.gold,
  hard: 0xe0883a,
  deadly: COLORS.danger,
};

const THREAT_NAMES: Record<ThreatLabel, string> = { trivial: 'Trivial', easy: 'Easy', fair: 'Fair', hard: 'Hard', deadly: 'Deadly' };

const KIND_ICONS: Record<NodeKind, string> = {
  camp: 'camping-tent',
  encounter: 'crossed-swords',
  elite: 'skull-crossed-bones',
  ruin: 'ancient-ruins',
  resource: 'fishing-pole',
  boss: 'crowned-skull',
};

const KIND_NAMES: Record<NodeKind, string> = {
  camp: 'Camp',
  encounter: 'Encounter',
  elite: 'Elite',
  ruin: 'Ruin',
  resource: 'Resource site',
  boss: 'Boss',
};

export interface MapSceneOptions {
  /** Node to centre the view on (the one just fought). Defaults to where the view was last time. */
  focus?: string;
  /** Nodes just brought out of the fog: their clouds dissolve as the scene opens. */
  reveal?: readonly string[];
}

export interface MapSceneActions {
  onCamp: () => void;
  onFight: (nodeId: string) => void;
}

interface Marker {
  root: Container;
  disc: Graphics;
  badge: Sprite;
  label: Text;
}

/** Where the view was, so coming back from a battle or the camp keeps the player's place. */
let lastView: { x: number; y: number } | null = null;
/** Where the party stood, including partway along a road. */
let lastParty: RoadPos | null = null;

/** A walk in progress: the legs left, how far along the current one, and the node to open on arrival. */
interface Walking {
  legs: Leg[];
  d: number;
  target: string | null;
}

/**
 * The island map (GDD 04, 11): the baked isometric region art, node markers coloured by Threat,
 * fog clouds over unexplored nodes, and a card for the tapped node. Tap a node or a road and the
 * party walks there along the roads, through cleared nodes only. Drag (or scroll) to pan.
 */
export class MapScene extends Scene {
  private readonly tweens = new Tweens();
  private readonly bar: ResourceBar;
  private readonly world = new Container();
  private readonly ground: Sprite;
  private readonly fx = new Container();
  private readonly markerLayer = new Container();
  private readonly fog = new Container();
  private readonly fogCanvas: HTMLCanvasElement;
  private readonly fogSheet: Sprite;
  /** How far each revealed node's clear patch has opened, 0 to 1. */
  private readonly fogHoles = new Map<string, { scale: number }>();
  private fogDirty = true;
  private readonly markers = new Map<string, Marker>();
  private readonly clouds = new Map<string, Container>();
  private readonly glints: AnimatedSprite[] = [];
  private readonly bottom = new Graphics();
  private readonly campButton: Button;
  private readonly progress: Text;
  private readonly card = new Container();
  private readonly zoomHint: Text;
  private readonly roads: RoadNetwork;
  private readonly party = new Container();
  private readonly partyUnit: PixelUnit;
  private partyPos: RoadPos;
  private walking: Walking | null = null;
  private walked = 0;
  private follow = false;
  private zoom = 2;
  private screenW = 0;
  private screenH = 0;
  private selected: string | null = null;
  private press: { x: number; y: number; viewX: number; viewY: number; dragging: boolean; lastX: number; lastY: number; t: number } | null = null;
  private velocity = { x: 0, y: 0 };
  private refreshIn = 0;
  private revealing: ReadonlySet<string>;

  constructor(
    private readonly session: GameSession,
    private readonly icons: Icons,
    private readonly pixel: PixelAssets,
    private readonly map: MapAsset,
    private readonly options: MapSceneOptions,
    private readonly actions: MapSceneActions,
  ) {
    super();
    this.revealing = new Set(options.reveal ?? []);
    this.bar = new ResourceBar(icons, this.tweens);
    this.bar.set(session.wallet.balance);
    this.ground = new Sprite(map.texture);
    this.roads = new RoadNetwork(map.roads);
    this.partyPos = startingPosition(session.partyAt);
    // The bosun, edged in white so the token stands out on the island.
    this.partyUnit = new PixelUnit(pixel, 'map/party', () => 1, false);
    this.party.addChild(this.partyUnit);
    this.world.addChild(this.ground, this.fx, this.markerLayer, this.party, this.fog);

    this.campButton = new Button({
      label: 'Camp',
      width: 140,
      height: 52,
      fontSize: 18,
      icon: icon(icons, 'camping-tent'),
      onTap: () => actions.onCamp(),
    });
    this.progress = new Text({ text: '', style: { fontFamily: FONT, fontSize: 13, fill: COLORS.muted, lineHeight: 18 } });
    this.progress.anchor.set(0, 0.5);
    this.zoomHint = new Text({ text: 'Tap to move · drag to look around', style: { fontFamily: FONT, fontSize: 13, fontWeight: 'bold', fill: COLORS.text, stroke: { color: 0x000000, width: 3 } } });
    this.zoomHint.anchor.set(0.5);

    this.eventMode = 'static';
    this.on('pointerdown', (e) => this.onDown(e));
    this.on('globalpointermove', (e) => this.onMove(e));
    this.on('pointerup', (e) => this.onUp(e));
    this.on('pointerupoutside', (e) => this.onUp(e));
    this.on('wheel', (e) => {
      this.velocity = { x: 0, y: 0 };
      this.panTo(this.world.x - e.deltaX, this.world.y - e.deltaY);
    });

    this.buildFx();
    this.buildMarkers();
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = Math.ceil(map.width / FOG_CELL);
    this.fogCanvas.height = Math.ceil(map.height / FOG_CELL);
    const fogTexture = Texture.from(this.fogCanvas);
    fogTexture.source.scaleMode = 'nearest';
    this.fogSheet = new Sprite(fogTexture);
    this.fog.addChild(this.fogSheet);
    this.buildFog();
    this.addChild(this.world, this.zoomHint, this.bottom, this.campButton, this.progress, this.card, this.bar);
    this.tweens.play(this.zoomHint, { alpha: [1, 0], delay: 2200, duration: 600, ease: 'inQuad' });
  }

  layout(width: number, height: number): void {
    const firstLayout = this.screenW === 0;
    this.screenW = width;
    this.screenH = height;
    this.bar.layout(width);
    // Integer zoom keeps the pixel art crisp: x2 on phones, x3 on big screens.
    const zoom = width >= 720 && height >= 900 ? 3 : 2;
    if (zoom !== this.zoom || firstLayout) {
      this.zoom = zoom;
      this.ground.scale.set(zoom);
      this.partyUnit.setSize(Math.max(1, zoom - 1));
      this.placeWorldObjects();
    }
    this.hitArea = new Rectangle(0, 0, width, height);

    const by = height - BOTTOM_BAR;
    this.bottom.clear().rect(0, by, width, BOTTOM_BAR).fill(COLORS.panel).rect(0, by, width, 2).fill(COLORS.panelLight);
    this.campButton.position.set(width - PAD - this.campButton.buttonWidth / 2, by + BOTTOM_BAR / 2);
    this.progress.position.set(PAD, by + BOTTOM_BAR / 2);
    this.fitProgress();
    this.zoomHint.position.set(width / 2, ResourceBar.HEIGHT + 24);

    if (firstLayout) {
      const focus = this.options.focus ?? (lastView ? null : this.session.campId);
      if (focus) this.centerOn(focus);
      else if (lastView) this.panTo(lastView.x, lastView.y);
      this.playReveals();
    } else {
      this.panTo(this.world.x, this.world.y);
    }
    this.refresh();
  }

  override update(deltaMs: number): void {
    if (!this.press && (Math.abs(this.velocity.x) > 0.05 || Math.abs(this.velocity.y) > 0.05)) {
      const f = deltaMs / 16;
      this.panTo(this.world.x + this.velocity.x * f, this.world.y + this.velocity.y * f);
      const decay = FRICTION ** f;
      this.velocity.x *= decay;
      this.velocity.y *= decay;
    }
    for (const g of this.glints) if (!g.playing && Math.random() < deltaMs / 2500) g.gotoAndPlay(0);
    this.stepWalk(deltaMs);
    if (this.fogDirty) this.drawFog();
    // Respawn timers and resource sites tick on the wall clock.
    this.refreshIn -= deltaMs;
    if (this.refreshIn <= 0) this.refresh();
  }

  override destroy(options?: Parameters<Scene['destroy']>[0]): void {
    lastView = { x: this.world.x, y: this.world.y };
    lastParty = this.partyPos;
    this.tweens.cancelAll();
    this.fogSheet.texture.destroy(true);
    super.destroy(options);
  }

  // --- camera ----------------------------------------------------------------------------------

  private get viewTop(): number {
    return ResourceBar.HEIGHT;
  }

  private get viewBottom(): number {
    return this.screenH - BOTTOM_BAR;
  }

  /** Keeps the map covering the view; a map narrower than the view stays centred. */
  private panTo(x: number, y: number): void {
    const mapW = this.map.width * this.zoom;
    const mapH = this.map.height * this.zoom;
    const viewH = this.viewBottom - this.viewTop;
    const clamp = (v: number, size: number, view: number, offset: number): number =>
      size <= view ? offset + (view - size) / 2 : Math.min(offset, Math.max(offset + view - size, v));
    this.world.position.set(Math.round(clamp(x, mapW, this.screenW, 0)), Math.round(clamp(y, mapH, viewH, this.viewTop)));
  }

  private centerOn(nodeId: string): void {
    const p = this.map.nodes[nodeId];
    if (!p) return;
    const viewMid = (this.viewTop + this.viewBottom) / 2;
    // Lean towards the middle of the island so the paths on both sides stay in view.
    const x = (p.x + this.map.width / 2) / 2;
    this.panTo(this.screenW / 2 - x * this.zoom, viewMid - p.y * this.zoom);
  }

  private onDown(e: FederatedPointerEvent): void {
    this.velocity = { x: 0, y: 0 };
    this.follow = false; // the player takes the camera
    if (e.global.y < this.viewTop || e.global.y > this.cardTop()) return;
    this.press = { x: e.global.x, y: e.global.y, viewX: this.world.x, viewY: this.world.y, dragging: false, lastX: e.global.x, lastY: e.global.y, t: performance.now() };
  }

  private onMove(e: FederatedPointerEvent): void {
    const p = this.press;
    if (!p) return;
    if (!p.dragging && Math.hypot(e.global.x - p.x, e.global.y - p.y) < DRAG_THRESHOLD) return;
    p.dragging = true;
    const now = performance.now();
    const dt = Math.max(1, now - p.t);
    this.velocity = { x: ((e.global.x - p.lastX) / dt) * 16, y: ((e.global.y - p.lastY) / dt) * 16 };
    p.lastX = e.global.x;
    p.lastY = e.global.y;
    p.t = now;
    this.panTo(p.viewX + e.global.x - p.x, p.viewY + e.global.y - p.y);
  }

  private onUp(e: FederatedPointerEvent): void {
    const p = this.press;
    this.press = null;
    if (!p) return;
    if (p.dragging) {
      if (performance.now() - p.t > 80) this.velocity = { x: 0, y: 0 }; // held still before letting go
      return;
    }
    if (e.type !== 'pointerup') return;
    this.onTap(e.global.x, e.global.y);
  }

  /** Shrinks the progress lines on narrow screens so they never run under the Camp button. */
  private fitProgress(): void {
    this.progress.scale.set(1);
    const room = this.campButton.x - this.campButton.buttonWidth / 2 - PAD - 8;
    if (room > 0 && this.progress.width > room) this.progress.scale.set(room / this.progress.width);
  }

  // --- movement --------------------------------------------------------------------------------

  /** Tap on a node: walk there and show its card. Tap on a road: walk to that spot. Else close the card. */
  private onTap(x: number, y: number): void {
    const id = this.nodeAt(x, y);
    if (id) {
      this.selected = id;
      this.ensureVisible(id);
      if (!this.isPartyAt(id)) this.goTo({ node: id }, id, x, y);
      this.refresh();
      return;
    }
    const revealed = (n: string): boolean => this.session.map.isRevealed(n);
    const spot = this.roads.nearest((x - this.world.x) / this.zoom, (y - this.world.y) / this.zoom, ROAD_TAP_RADIUS / this.zoom, (a, b) => revealed(a) && revealed(b));
    this.selected = spot && 'node' in spot ? spot.node : null;
    if (spot) this.goTo(spot, this.selected, x, y);
    this.refresh();
  }

  /** Plans a walk from where the party is now (even mid-walk) and sets off. */
  private goTo(target: RoadPos, openOnArrival: string | null, tapX: number, tapY: number): void {
    const map = this.session.map;
    const walk = this.roads.plan(this.partyPos, target, (n) => map.isConquered(n));
    if (!walk) {
      this.floatAt(tapX - this.world.x, tapY - this.world.y, 'Clear the way first', COLORS.danger);
      return;
    }
    if (!walk.legs.length) return;
    this.walking = { legs: [...walk.legs], d: walk.legs[0]!.from, target: openOnArrival };
    this.follow = true;
    this.drawTargetMark(target);
  }

  private isPartyAt(id: string): boolean {
    return !this.walking && 'node' in this.partyPos && this.partyPos.node === id && this.session.partyAt === id;
  }

  /** Moves the party along its legs; each node it reaches becomes its place in the session. */
  private stepWalk(deltaMs: number): void {
    const w = this.walking;
    if (!w) return;
    let budget = (WALK_SPEED * deltaMs) / 1000;
    while (budget > 0 && w.legs.length) {
      const leg = w.legs[0]!;
      const dir = Math.sign(leg.to - leg.from) || 1;
      const left = Math.abs(leg.to - w.d);
      const step = Math.min(left, budget);
      w.d += dir * step;
      budget -= step;
      this.walked += step;
      this.partyPos = { a: leg.a, b: leg.b, d: w.d };
      if (step >= left) {
        w.legs.shift();
        const len = this.roads.length(leg.a, leg.b);
        const node = leg.to <= 0 ? leg.a : leg.to >= len ? leg.b : null;
        if (node) {
          this.partyPos = { node };
          this.session.travel(node);
        }
        if (w.legs.length) w.d = w.legs[0]!.from;
      }
    }
    this.placeParty(true);
    if (this.follow) this.followParty();
    if (!w.legs.length) {
      this.walking = null;
      this.clearTargetMark();
      this.partyUnit.body.y = 0;
      this.refresh();
    }
  }

  private placeParty(moving = false): void {
    const z = this.zoom;
    const p = this.roads.pointAt(this.partyPos);
    const prevX = this.party.x;
    // Near a node the party steps aside so its marker stays readable.
    const pos = this.partyPos;
    const fromNode = 'node' in pos ? 0 : Math.min(pos.d, this.roads.length(pos.a, pos.b) - pos.d);
    const aside = Math.max(0, 1 - fromNode / 14) * 13;
    this.party.position.set(Math.round((p.x + aside) * z), Math.round((p.y + aside * 0.3) * z) - 6 * z);
    if (moving) {
      const dx = this.party.x - prevX;
      if (Math.abs(dx) > 0.5) this.partyUnit.body.scale.x = dx < 0 ? -1 : 1;
      this.partyUnit.body.y = -Math.abs(Math.sin(this.walked * 0.35)) * 2 * z; // little hop per step
    }
  }

  /** Keeps the walking party in the middle of the view, easing towards it. */
  private followParty(): void {
    const viewMid = (this.viewTop + Math.min(this.viewBottom, this.cardTop())) / 2;
    const tx = this.screenW / 2 - this.party.x;
    const ty = viewMid - this.party.y;
    this.panTo(this.world.x + (tx - this.world.x) * 0.08, this.world.y + (ty - this.world.y) * 0.08);
  }

  private readonly targetMark = new Graphics();

  private drawTargetMark(target: RoadPos): void {
    const z = this.zoom;
    const p = this.roads.pointAt(target);
    this.targetMark
      .clear()
      .ellipse(0, 0, 7 * z, 3.5 * z)
      .stroke({ width: z, color: COLORS.text, alpha: 0.9 });
    this.targetMark.position.set(p.x * z, p.y * z);
    if (!this.targetMark.parent) this.world.addChildAt(this.targetMark, this.world.getChildIndex(this.party));
    this.targetMark.alpha = 1;
  }

  private clearTargetMark(): void {
    this.targetMark.clear();
  }

  /** The visible node whose marker is under a screen point, if any. */
  private nodeAt(x: number, y: number): string | null {
    let best: string | null = null;
    let bestD = 30;
    for (const [id, m] of this.markers) {
      if (!m.root.visible) continue;
      const gx = this.world.x + m.root.x;
      const gy = this.world.y + m.root.y - 16;
      const d = Math.hypot(x - gx, y - gy);
      if (d < bestD) {
        best = id;
        bestD = d;
      }
    }
    return best;
  }

  private cardTop(): number {
    return this.selected ? this.screenH - BOTTOM_BAR - CARD_H : this.viewBottom;
  }

  // --- world objects ---------------------------------------------------------------------------

  private buildFx(): void {
    for (const _ of this.map.fires) {
      const fire = new AnimatedSprite({ textures: frames(this.pixel, 'map/fire'), animationSpeed: 0.15, autoPlay: true });
      fire.anchor.set(0.5, 1);
      this.fx.addChild(fire);
    }
    for (const _ of this.map.glints) {
      const glint = new AnimatedSprite({ textures: frames(this.pixel, 'map/glint'), animationSpeed: 0.12, loop: false });
      glint.anchor.set(0.5);
      glint.onComplete = () => glint.gotoAndStop(0);
      glint.alpha = 0.9;
      this.glints.push(glint);
      this.fx.addChild(glint);
    }
  }

  private buildMarkers(): void {
    for (const id of this.session.map.ids) {
      const node = this.session.node(id);
      const root = new Container();
      const disc = new Graphics();
      const badge = new Sprite(icon(this.icons, KIND_ICONS[node.kind]));
      badge.anchor.set(0.5);
      const label = new Text({ text: '', style: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', fill: COLORS.text, stroke: { color: 0x000000, width: 3 } } });
      label.anchor.set(0.5, 0);
      root.addChild(disc, badge, label);
      this.markerLayer.addChild(root);
      this.markers.set(id, { root, disc, badge, label });
    }
  }

  /**
   * Thick fog over the whole island except around revealed nodes and the roads between them, with
   * clouds drifting over every node still in the fog, plus the ones about to be revealed.
   */
  private buildFog(): void {
    for (const id of this.session.map.ids) {
      if (this.session.map.isRevealed(id)) this.fogHoles.set(id, { scale: this.revealing.has(id) ? 0 : 1 });
    }
    const textures = frames(this.pixel, 'map/cloud');
    let n = 0;
    for (const id of this.session.map.ids) {
      if (this.session.map.isRevealed(id) && !this.revealing.has(id)) continue;
      const group = new Container();
      const offsets = [
        [-22, -14],
        [20, -18],
        [0, 2],
        [-16, 16],
        [22, 12],
      ];
      for (const [dx, dy] of offsets) {
        const cloud = new Sprite(textures[n++ % textures.length]);
        cloud.anchor.set(0.5);
        cloud.position.set(dx!, dy!);
        group.addChild(cloud);
      }
      this.fog.addChild(group);
      this.clouds.set(id, group);
    }
  }

  /** Repaints the fog sheet from the current clear patches. */
  private drawFog(): void {
    this.fogDirty = false;
    const holes: FogHole[] = [];
    for (const [id, hole] of this.fogHoles) {
      const p = this.map.nodes[id]!;
      holes.push({ x: p.x, y: p.y, scale: hole.scale });
    }
    // A road clears once both its ends are fully out of the fog.
    const open = (id: string): boolean => (this.fogHoles.get(id)?.scale ?? 0) >= 1;
    const roads = Object.entries(this.map.roads)
      .filter(([key]) => key.split('|').every(open))
      .map(([, line]) => line);
    const { width, height } = this.fogCanvas;
    const density = fogDensity(this.map.width, this.map.height, FOG_CELL, holes, roads);
    const ctx = this.fogCanvas.getContext('2d')!;
    const image = ctx.createImageData(width, height);
    const [r, g, b] = FOG_RGB;
    for (let i = 0; i < density.length; i++) {
      const o = i * 4;
      image.data[o] = r;
      image.data[o + 1] = g;
      image.data[o + 2] = b;
      image.data[o + 3] = Math.round(FOG_ALPHA[Math.min(density[i]!, FOG_LEVELS - 1)]! * 255);
    }
    ctx.putImageData(image, 0, 0);
    this.fogSheet.texture.source.update();
  }

  private placeWorldObjects(): void {
    const z = this.zoom;
    this.fogSheet.scale.set(z * FOG_CELL);
    this.map.fires.forEach(([x, y], i) => {
      const fire = this.fx.children[i] as AnimatedSprite;
      fire.scale.set(z);
      fire.position.set(x * z, (y + 2) * z);
    });
    this.map.glints.forEach(([x, y], i) => {
      const g = this.glints[i]!;
      g.scale.set(z);
      g.position.set(x * z, y * z);
    });
    for (const [id, m] of this.markers) {
      const p = this.map.nodes[id]!;
      m.root.position.set(p.x * z, p.y * z);
    }
    for (const [id, group] of this.clouds) {
      const p = this.map.nodes[id]!;
      group.position.set(p.x * z, (p.y - 8) * z);
      group.scale.set(z);
    }
    this.placeParty();
  }

  private playReveals(): void {
    let delay = 350;
    for (const id of this.revealing) {
      const group = this.clouds.get(id);
      const marker = this.markers.get(id);
      // Revealed after the scene opened (auto-clear): its patch starts shut.
      const hole = this.fogHoles.get(id) ?? { scale: 0 };
      this.fogHoles.set(id, hole);
      this.tweens.play(hole, { scale: 1, duration: 1000, delay, ease: 'outQuad', onUpdate: () => (this.fogDirty = true) });
      if (group) {
        group.children.forEach((cloud, i) => {
          const dir = cloud.x < 0 ? -1 : 1;
          this.tweens.play(cloud, { x: cloud.x + dir * 30, y: cloud.y - 6, alpha: 0, duration: 900, delay: delay + i * 60, ease: 'inQuad' });
        });
        this.tweens.wait(delay + 1300, () => {
          group.destroy({ children: true });
          this.clouds.delete(id);
        });
      }
      if (marker) {
        // Node unlock pulse (GDD 12).
        marker.root.scale.set(0);
        this.tweens.play(marker.root.scale, { x: [0, 1.25, 1], y: [0, 1.25, 1], duration: 500, delay: delay + 500, ease: 'outBack' });
        this.pulse(marker.root, delay + 700);
      }
      delay += 300;
    }
    this.revealing = new Set();
  }

  private pulse(target: Container, delay: number): void {
    const ring = new Graphics().circle(0, -16, 18).stroke({ width: 3, color: COLORS.rally });
    ring.alpha = 0;
    target.addChildAt(ring, 0);
    this.tweens.play(ring.scale, { x: [0.6, 2], y: [0.6, 2], duration: 700, delay, ease: 'outQuad' });
    this.tweens.play(ring, { alpha: [1, 0], duration: 700, delay, ease: 'outQuad', onComplete: () => ring.destroy() });
  }

  // --- state -----------------------------------------------------------------------------------

  /** Redraws markers, the bottom bar and the card from the session. */
  private refresh(): void {
    if (!this.screenW) return;
    this.refreshIn = 500;
    let cleared = 0;
    let total = 0;
    for (const [id, m] of this.markers) {
      const info = this.session.nodeInfo(id);
      if (info.node.kind !== 'camp') {
        total++;
        if (this.session.map.isConquered(id)) cleared++;
      }
      this.drawMarker(m, info, id === this.selected);
    }
    const region = this.session.map.regionCleared ? 'cleared!' : `${cleared}/${total} cleared`;
    this.progress.text = `Wreck Coast · ${region}\nArmy Power ${formatNumber(this.session.power)}`;
    this.fitProgress();
    this.bar.set(this.session.wallet.balance);
    this.bar.setCaption(this.session.map.regionCleared ? 'Region cleared' : '');
    this.renderCard();
  }

  private drawMarker(m: Marker, info: NodeInfo, selected: boolean): void {
    const status = info.status;
    if (status.kind === 'hidden') {
      m.root.visible = false;
      return;
    }
    const boss = info.node.kind === 'boss';
    const r = boss ? 17 : 14;
    let fill: number = COLORS.panelLight;
    let iconTint: number = COLORS.text;
    let text = '';
    switch (status.kind) {
      case 'camp':
        fill = COLORS.rally;
        iconTint = COLORS.background;
        break;
      case 'open':
        fill = info.label ? THREAT_COLORS[info.label] : COLORS.rally;
        iconTint = COLORS.background;
        if (info.label) text = THREAT_NAMES[info.label];
        break;
      case 'respawning':
        fill = COLORS.disabled;
        iconTint = COLORS.muted;
        text = formatDuration(status.respawnAt - this.session.now());
        break;
      case 'secured':
        fill = COLORS.good;
        iconTint = COLORS.background;
        if (info.harvest) {
          const amount = info.harvest.food + info.harvest.gold;
          text = amount > 0 ? `+${formatNumber(amount)}` : '';
        } else if (boss) text = 'Beaten';
        break;
    }
    m.root.visible = true;
    const cy = -16 - r / 2;
    m.disc
      .clear()
      .ellipse(0, 0, r * 0.9, r * 0.4)
      .fill({ color: 0x000000, alpha: 0.35 })
      // White outline around the pin and disc so markers stand out on sand and fog alike.
      .rect(-2, cy + r - 2, 4, 16 - r / 2 + 3)
      .fill(0xffffff)
      .rect(-1, cy + r - 2, 2, 16 - r / 2 + 2)
      .fill(0x1b1622);
    if (selected) m.disc.circle(0, cy, r + 6).fill(COLORS.rally);
    m.disc
      .circle(0, cy, r + 4)
      .fill(0xffffff)
      .circle(0, cy, r + 2)
      .fill(0x1b1622)
      .circle(0, cy, r)
      .fill(fill);
    m.badge.tint = iconTint;
    m.badge.width = m.badge.height = r * 1.3;
    m.badge.position.set(0, cy);
    m.label.text = text;
    m.label.position.set(0, 4);
    m.label.style.fill = status.kind === 'respawning' ? COLORS.muted : status.kind === 'open' && info.label ? THREAT_COLORS[info.label] : COLORS.text;
  }

  /** Pans so a tapped node is not hidden behind the card. */
  private ensureVisible(id: string): void {
    const p = this.map.nodes[id];
    if (!p) return;
    const sy = this.world.y + p.y * this.zoom;
    const top = this.viewTop + 60;
    const bottom = this.screenH - BOTTOM_BAR - CARD_H - 20;
    if (sy > bottom || sy < top) {
      const targetY = this.world.y + ((top + bottom) / 2 - sy);
      const from = { y: this.world.y };
      this.tweens.play(from, {
        y: targetY,
        duration: 300,
        ease: 'outQuad',
        onUpdate: () => this.panTo(this.world.x, from.y),
      });
    }
  }

  // --- node card -------------------------------------------------------------------------------

  private renderCard(): void {
    for (const child of this.card.removeChildren()) child.destroy({ children: true });
    const id = this.selected;
    if (!id) return;
    const info = this.session.nodeInfo(id);
    const node = info.node;
    const w = this.screenW;
    const y0 = this.screenH - BOTTOM_BAR - CARD_H;
    const bg = new Graphics()
      .roundRect(8, y0, w - 16, CARD_H - 8, 14)
      .fill(COLORS.panel)
      .stroke({ width: 2, color: COLORS.panelLight });
    bg.eventMode = 'static'; // taps on the card never reach the map
    this.card.addChild(bg);

    const bold = { fontFamily: FONT, fontWeight: 'bold' as const };
    const title = new Text({ text: node.name, style: { ...bold, fontSize: 19, fill: COLORS.text } });
    title.position.set(PAD + 4, y0 + 12);
    const floors = node.kind === 'ruin' ? ` · ${node.battles.length} floors` : '';
    const kind = new Text({ text: `${KIND_NAMES[node.kind]}${floors}`, style: { ...bold, fontSize: 12, fill: COLORS.rally } });
    kind.position.set(PAD + 4, y0 + 36);
    const blurb = new Text({
      text: node.blurb,
      style: { fontFamily: FONT, fontSize: 12, fill: COLORS.muted, wordWrap: true, wordWrapWidth: w - 48, lineHeight: 16 },
    });
    blurb.position.set(PAD + 4, y0 + 54);
    this.card.addChild(title, kind, blurb);

    let y = y0 + 58 + blurb.height + 8;
    if (info.threat !== undefined && info.label) {
      const threat = new Text({
        text: `Threat ${formatNumber(info.threat)}  vs  Power ${formatNumber(this.session.power)}`,
        style: { ...bold, fontSize: 13, fill: COLORS.text },
      });
      threat.position.set(PAD + 4, y);
      const label = new Text({ text: THREAT_NAMES[info.label], style: { ...bold, fontSize: 13, fill: THREAT_COLORS[info.label] } });
      label.anchor.set(1, 0);
      label.position.set(w - PAD - 8, y);
      this.card.addChild(threat, label);
      y += 22;
      // Enemy line-up, front row first.
      const size = 34;
      info.enemies.slice(0, 7).forEach((typeId, i) => {
        const unit = new PixelUnit(this.pixel, typeId, () => 1, false);
        unit.setSize(1);
        unit.position.set(PAD + 20 + i * size, y + 18);
        this.card.addChild(unit);
      });
      this.addLoot(info.loot, w - PAD - 8, y + 18);
      y += 42;
    } else if (info.harvest) {
      const p = node.produces!;
      const note = new Text({ text: `Makes ${p.perHour} ${p.currency} an hour, holds up to ${p.capHours} h.`, style: { fontFamily: FONT, fontSize: 12, fill: COLORS.text } });
      note.position.set(PAD + 4, y);
      this.card.addChild(note);
      y += 24;
    }

    const buttons = this.cardButtons(info);
    const by = this.screenH - BOTTOM_BAR - 8 - 34;
    const gap = 10;
    const bw = (w - 32 - gap * (buttons.length - 1)) / buttons.length;
    buttons.forEach((b, i) => {
      b.resize(bw);
      b.position.set(16 + bw / 2 + i * (bw + gap), by);
      this.card.addChild(b);
    });
  }

  private addLoot(loot: Resources, right: number, y: number): void {
    const style = { fontFamily: FONT, fontSize: 14, fontWeight: 'bold' as const, fill: COLORS.text };
    let x = right;
    for (const [slug, amount, tint] of [
      ['meat', loot.food, COLORS.food],
      ['two-coins', loot.gold, COLORS.gold],
    ] as const) {
      if (amount <= 0) continue;
      const t = new Text({ text: formatNumber(amount), style });
      t.anchor.set(1, 0.5);
      t.position.set(x, y);
      const s = new Sprite(icon(this.icons, slug));
      s.anchor.set(0.5);
      s.tint = tint;
      s.width = s.height = 18;
      s.position.set(x - t.width - 12, y);
      this.card.addChild(t, s);
      x -= t.width + 32;
    }
  }

  private cardButtons(info: NodeInfo): Button[] {
    const id = info.node.id;
    const status = info.status;
    const make = (label: string, slug: string, onTap: () => void, color: number = COLORS.rally): Button =>
      new Button({ label, width: 120, height: 52, fontSize: 17, icon: icon(this.icons, slug), color, onTap });
    if (!this.isPartyAt(id) && status.kind !== 'hidden') {
      const heading = this.walking?.target === id;
      const blocked = !heading && !this.roads.plan(this.partyPos, { node: id }, (n) => this.session.map.isConquered(n));
      const go = make(heading ? 'Walking…' : blocked ? 'Clear the way first' : 'Go here', heading ? 'run' : 'treasure-map', () => {
        this.goTo({ node: id }, id, this.screenW / 2, this.cardTop());
        queueMicrotask(() => !this.destroyed && this.refresh()); // the card holding this button is rebuilt
      });
      go.enabled = !heading && !blocked;
      return [go];
    }
    switch (status.kind) {
      case 'camp':
        return [make('Enter camp', 'camping-tent', () => this.actions.onCamp())];
      case 'open': {
        const fight = make(info.node.kind === 'ruin' ? 'Enter ruin' : 'Fight', 'crossed-swords', () => this.actions.onFight(id));
        if (!info.canAutoClear) return [fight];
        const auto = make('Auto ½ loot', 'fast-forward-button', () => this.autoClear(id), COLORS.muted);
        return [auto, fight];
      }
      case 'respawning': {
        const wait = make(`Back in ${formatDuration(status.respawnAt - this.session.now())}`, 'hourglass', () => {});
        wait.enabled = false;
        return [wait];
      }
      case 'secured': {
        if (info.harvest) {
          const amount = info.harvest.food + info.harvest.gold;
          const collect = make(amount > 0 ? `Collect +${formatNumber(amount)}` : 'Nothing yet', 'meat', () => this.harvest(id), COLORS.good);
          collect.enabled = amount > 0;
          return [collect];
        }
        const done = make('Cleared', 'check-mark', () => {});
        done.enabled = false;
        return [done];
      }
      case 'hidden':
        return [];
    }
  }

  private autoClear(id: string): void {
    const marker = this.markers.get(id);
    const { loot, revealed } = this.session.autoClear(id);
    this.floatText(id, `+${loot.gold} gold`);
    this.bar.set(this.session.wallet.balance, true);
    if (marker) this.pulse(marker.root, 0);
    this.revealing = new Set(revealed);
    this.playReveals();
    queueMicrotask(() => !this.destroyed && this.refresh());
  }

  private harvest(id: string): void {
    const amount = this.session.harvest(id);
    this.floatText(id, `+${amount.food + amount.gold} ${amount.food ? 'food' : 'gold'}`);
    queueMicrotask(() => {
      if (this.destroyed) return;
      this.refresh();
      this.bar.set(this.session.wallet.balance, true);
    });
  }

  private floatText(id: string, text: string): void {
    const marker = this.markers.get(id);
    if (marker) this.floatAt(marker.root.x, marker.root.y - 40, text, COLORS.gold);
  }

  /** Text that rises and fades at a point in world (map) coordinates. */
  private floatAt(x: number, y: number, text: string, color: number): void {
    const t = new Text({ text, style: { fontFamily: FONT, fontSize: 15, fontWeight: 'bold', fill: color, stroke: { color: 0x000000, width: 4 } } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.world.addChild(t);
    this.tweens.play(t, { y: t.y - 30, alpha: [1, 0], duration: 1000, ease: 'outCubic', onComplete: () => t.destroy() });
  }
}

/** Where the party starts this scene: where it was last time if that still fits the session, else on its node. */
function startingPosition(partyAt: string): RoadPos {
  const p = lastParty;
  if (p && 'node' in p && p.node === partyAt) return p;
  if (p && !('node' in p) && (p.a === partyAt || p.b === partyAt)) return p;
  return { node: partyAt };
}

/** 1h 42m, 12m, 40s. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  if (s >= 60) return `${Math.ceil(s / 60)}m`;
  return `${s}s`;
}
