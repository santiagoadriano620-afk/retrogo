"use strict";

const AREAS = {};

AREAS.SINGLE = [[1]];

AREAS.WAVE3 = [
  [1, 1, 1],
  [1, 1, 1],
  [0, 3, 0]
];

AREAS.WAVE4 = [
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 3, 0, 0]
];

AREAS.WAVE6 = [
  [0, 0, 0, 0, 0],
  [0, 1, 3, 1, 0],
  [0, 0, 0, 0, 0]
];

AREAS.SQUAREWAVE5 = [
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [0, 1, 0],
  [0, 3, 0]
];

AREAS.SQUAREWAVE6 = [
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0]
];

AREAS.SQUAREWAVE7 = [
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0]
];

AREAS.DIAGONAL_WAVE4 = [
  [0, 0, 0, 0, 1, 0],
  [0, 0, 0, 1, 1, 0],
  [0, 0, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 3]
];

AREAS.DIAGONAL_SQUAREWAVE5 = [
  [1, 1, 1, 0, 0],
  [1, 1, 1, 0, 0],
  [1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 0, 3]
];

AREAS.DIAGONAL_WAVE6 = [
  [0, 0, 1],
  [0, 3, 0],
  [1, 0, 0]
];

AREAS.BEAM1 = [[3]];

AREAS.BEAM5 = [
  [1],
  [1],
  [1],
  [1],
  [3]
];

AREAS.BEAM7 = [
  [1],
  [1],
  [1],
  [1],
  [1],
  [1],
  [3]
];

AREAS.BEAM8 = [
  [1],
  [1],
  [1],
  [1],
  [1],
  [1],
  [1],
  [3]
];

AREAS.DIAGONAL_BEAM5 = [
  [1, 0, 0, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 0, 0, 3]
];

AREAS.DIAGONAL_BEAM7 = [
  [1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 1, 0],
  [0, 0, 0, 0, 0, 0, 3]
];

AREAS.CIRCLE2X2 = [
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [1, 1, 3, 1, 1],
  [1, 1, 1, 1, 1],
  [0, 1, 1, 1, 0]
];

AREAS.CIRCLE3X3 = [
  [0, 0, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 3, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0]
];

AREAS.CROSS1X1 = [
  [0, 1, 0],
  [1, 3, 1],
  [0, 1, 0]
];

AREAS.CIRCLE5X5 = [
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]
];

AREAS.CIRCLE6X6 = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
];

AREAS.SQUARE1X1 = [
  [1, 1, 1],
  [1, 3, 1],
  [1, 1, 1]
];

AREAS.WALLFIELD = [
  [1, 1, 1, 3, 1, 1, 1]
];

AREAS.DIAGONAL_WALLFIELD = [
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1, 1],
  [0, 0, 0, 0, 1, 1, 0],
  [0, 0, 1, 3, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 0]
];

AREAS.WALLFIELD_SMALL = [
  [1, 1, 3, 1, 1]
];

AREAS.DIAGONAL_WALLFIELD_SMALL = [
  [0, 0, 0, 0, 1],
  [0, 0, 0, 1, 1],
  [0, 1, 3, 1, 0],
  [1, 1, 0, 0, 0],
  [1, 0, 0, 0, 0]
];

/*
 * Resolve area tiles relative to caster position with direction
 * Returns an array of {x, y, z} offsets from caster
 */
AREAS.resolveArea = function (areaMatrix, casterDirection) {
  if (!areaMatrix) return [{ x: 0, y: 0 }];

  let offsets = [];
  let casterRow = -1;
  let casterCol = -1;

  for (let row = 0; row < areaMatrix.length; row++) {
    for (let col = 0; col < areaMatrix[row].length; col++) {
      if (areaMatrix[row][col] === 3) {
        casterRow = row;
        casterCol = col;
        break;
      }
    }
    if (casterRow >= 0) break;
  }

  let rotation = 0;
  switch (casterDirection) {
    case 0: rotation = 0; break;
    case 1: rotation = 1; break;
    case 2: rotation = 2; break;
    case 3: rotation = 3; break;
  }

  for (let row = 0; row < areaMatrix.length; row++) {
    for (let col = 0; col < areaMatrix[row].length; col++) {
      if (areaMatrix[row][col] !== 1) continue;
      offsets.push(AREAS.__rotateOffset(row - casterRow, col - casterCol, rotation));
    }
  }

  return offsets;
};

/*
 * Filter offsets to exclude tiles that block projectiles (walls, mountains, etc.)
 * Checks both isBlockProjectile and isBlockSolid, plus line-of-sight from caster
 */
AREAS.filterBlocked = function (world, casterPosition, offsets) {

  return offsets.filter(function (off) {
    let pos = { x: casterPosition.x + off.x, y: casterPosition.y + off.y, z: casterPosition.z };
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile) return false;

    // Tile itself blocks spells
    if (tile.isBlockProjectile() || tile.isBlockSolid()) {
      return false;
    }

    // No line of sight: a wall lies between caster and target
    if (!casterPosition.inLineOfSight(pos)) {
      return false;
    }

    return true;
  });

};

AREAS.__rotateOffset = function (dr, dc, rotation) {
  switch (rotation) {
    case 0: return { x: dc, y: dr };
    case 1: return { x: -dr, y: dc };
    case 2: return { x: -dc, y: -dr };
    case 3: return { x: dr, y: -dc };
  }
  return { x: dc, y: dr };
};

module.exports = AREAS;
