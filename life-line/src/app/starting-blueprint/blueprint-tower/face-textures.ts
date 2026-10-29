import { Color } from 'three';
import { BLUEPRINT_LEVEL_COUNT, BLUEPRINT_TRAITS } from '../model/starting-blueprint';

export const FACE_TEXTURE_SIZE = 1024;
/** Lower levels are slightly lighter while keeping the vivid palette. */
const LEVEL_TINT = [0.2, 0.13, 0.06, 0];

type Ctx = CanvasRenderingContext2D;

export function faceColor(traitIndex: number, levelIndex: number): string {
  const color = new Color(BLUEPRINT_TRAITS[traitIndex].color).lerp(
    new Color('white'),
    LEVEL_TINT[levelIndex],
  );
  return `#${color.getHexString()}`;
}

/** Draws one cube face: white silhouette, single-line topic and level text. */
export function drawFace(x: Ctx, traitIndex: number, levelIndex: number): void {
  const trait = BLUEPRINT_TRAITS[traitIndex];
  const l = levelIndex;
  x.fillStyle = faceColor(traitIndex, levelIndex);
  x.fillRect(0, 0, FACE_TEXTURE_SIZE, FACE_TEXTURE_SIZE);
  x.fillStyle = x.strokeStyle = 'white';
  x.lineWidth = 16;
  x.lineCap = 'round';

  if (traitIndex === 0) {
    person(x, 460, 455, 280, l > 1);
    heart(x, 700, 470, 85);
    if (l > 1) {
      shield(x);
    }
  } else if (traitIndex === 1) {
    x.beginPath();
    x.moveTo(220, 380);
    x.lineTo(470, 210);
    x.lineTo(710, 380);
    x.stroke();
    person(x, 360, 500, 190);
    person(x, 550, 500, 190);
    person(x, 455, 570, 115);
    for (let a = 0; a <= l; a++) {
      x.beginPath();
      x.ellipse(760, 650 - a * 48, 65, 20, 0, 0, Math.PI * 2);
      x.stroke();
    }
  } else if (traitIndex === 2) {
    person(x, 510, 500, 290, l > 1);
    if (l < 2) {
      x.beginPath();
      x.ellipse(510, 240, 130, 50, 0, 0, Math.PI * 2);
      x.fill();
      for (let a = 0; a < 4; a++) {
        x.beginPath();
        x.moveTo(420 + a * 60, 310);
        x.lineTo(400 + a * 60, 355);
        x.stroke();
      }
    } else {
      heart(x, 735, 430, 90);
      x.beginPath();
      x.moveTo(730, 300);
      x.lineTo(820, 350);
      x.lineTo(800, 500);
      x.lineTo(730, 570);
      x.lineTo(660, 500);
      x.lineTo(640, 350);
      x.closePath();
      x.stroke();
    }
  } else {
    person(x, l < 2 ? 510 : 350, 490, 260);
    if (l > 1) {
      person(x, 660, 490, 260, true);
    }
    x.beginPath();
    roundRect(x, 360, 200, 280, 110, 35);
    x.stroke();
    for (let a = 0; a < l + 1; a++) {
      x.beginPath();
      x.arc(420 + a * 42, 253, 9, 0, Math.PI * 2);
      x.fill();
    }
  }

  x.textAlign = 'center';
  x.font = '600 44px Arial';
  x.fillText(trait.name.toUpperCase(), 512, 840, 900);
  x.font = '400 35px Arial';
  x.fillText(`${trait.levels[l]}  \u00b7  ${l + 1}/${BLUEPRINT_LEVEL_COUNT}`, 512, 910, 900);
}

function person(c: Ctx, x: number, y: number, s: number, raised = false): void {
  c.lineWidth = s * 0.13;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(x, y - s * 0.38, s * 0.12, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(x, y - s * 0.17);
  c.lineTo(x, y + s * 0.25);
  c.moveTo(x, y + s * 0.2);
  c.lineTo(x - s * 0.17, y + s * 0.53);
  c.moveTo(x, y + s * 0.2);
  c.lineTo(x + s * 0.17, y + s * 0.53);
  const armY = y + (raised ? -0.34 : 0.2) * s;
  c.moveTo(x, y - s * 0.08);
  c.lineTo(x - s * 0.26, armY);
  c.moveTo(x, y - s * 0.08);
  c.lineTo(x + s * 0.26, armY);
  c.stroke();
}

function heart(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y + s * 0.4);
  c.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s * 0.7, x, y - s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y - s * 0.7, x + s, y - s * 0.2, x, y + s * 0.4);
  c.fill();
}

/** Health shield outline around the heart; inherits the silhouette stroke width. */
function shield(c: Ctx): void {
  c.beginPath();
  c.moveTo(700, 340);
  c.lineTo(780, 375);
  c.lineTo(770, 490);
  c.quadraticCurveTo(750, 555, 700, 580);
  c.quadraticCurveTo(640, 540, 630, 490);
  c.lineTo(620, 375);
  c.closePath();
  c.stroke();
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  if (typeof c.roundRect === 'function') {
    c.roundRect(x, y, w, h, r);
    return;
  }
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
