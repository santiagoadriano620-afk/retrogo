"use strict";

const { parentPort } = require("worker_threads");

const worker = new PathfinderWorker();

parentPort.on("message", (msg) => {
  switch (msg.task) {
    case "findPath":
      parentPort.postMessage(worker.findPath(msg.data));
      break;
    case "setGrid":
      worker.setGrid(msg.data);
      parentPort.postMessage({ ok: true });
      break;
    default:
      parentPort.postMessage({ __error: "Unknown task: " + msg.task });
  }
});

function PathfinderWorker() {

  this.grids = new Map();

}

PathfinderWorker.prototype.setGrid = function (data) {

  this.grids.set(data.z, {
    width: data.width,
    height: data.height,
    weights: data.weights,
  });

};

PathfinderWorker.prototype.getWeight = function (z, x, y) {

  const g = this.grids.get(z);
  if (!g) return 0;
  if (x < 0 || x >= g.width || y < 0 || y >= g.height) return 0;
  return g.weights[y * g.width + x];

};

PathfinderWorker.prototype.findPath = function (data) {

  const { fromX, fromY, toX, toY, z, mode, width, height, weights, occupied } = data;

  const ADJACENT = 0;
  const EXACT = 1;

  const occupiedSet = new Set(occupied || []);

  let grid = { width, height, weights };

  const AVERAGE_FRICTION = 130;
  const dirs = [
    { dx: 0, dy: -1, cost: 1 },
    { dx: 1, dy: -1, cost: 1.5 },
    { dx: 1, dy: 0, cost: 1 },
    { dx: 1, dy: 1, cost: 1.5 },
    { dx: 0, dy: 1, cost: 1 },
    { dx: -1, dy: 1, cost: 1.5 },
    { dx: -1, dy: 0, cost: 1 },
    { dx: -1, dy: -1, cost: 1.5 },
  ];

  function heuristic(ax, ay, bx, by) {
    return AVERAGE_FRICTION * (Math.abs(ax - bx) + Math.abs(ay - by));
  }

  function isWalkable(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    if (occupiedSet.has(x + "," + y)) return false;
    return weights[y * width + x] > 0;
  }

  function key(x, y) { return x + "," + y; }

  let openHeap = [];
  const gScore = new Map();
  const fScore = new Map();
  const parent = new Map();
  const closed = new Set();
  const visited = new Set();

  const startKey = key(fromX, fromY);
  const targetKey = key(toX, toY);

  gScore.set(startKey, 0);
  fScore.set(startKey, heuristic(fromX, fromY, toX, toY));
  openHeap.push({ x: fromX, y: fromY, f: fScore.get(startKey) });

  function heapPop() {
    let best = 0;
    for (let i = 1; i < openHeap.length; i++) {
      if (openHeap[i].f < openHeap[best].f) best = i;
    }
    const node = openHeap[best];
    openHeap[best] = openHeap[openHeap.length - 1];
    openHeap.pop();
    return node;
  }

  let iterations = 0;
  const MAX_ITERATIONS = 10000;

  while (openHeap.length > 0) {
    if (++iterations > MAX_ITERATIONS) break;

    const current = heapPop();
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (mode === ADJACENT) {
      if (Math.abs(current.x - toX) <= 1 && Math.abs(current.y - toY) <= 1 && isWalkable(current.x, current.y)) {
        return reconstruct(current.x, current.y, parent);
      }
    } else if (mode === EXACT) {
      if (current.x === toX && current.y === toY) {
        return reconstruct(current.x, current.y, parent);
      }
    }

    for (let d = 0; d < dirs.length; d++) {
      const nx = current.x + dirs[d].dx;
      const ny = current.y + dirs[d].dy;
      const nk = key(nx, ny);

      if (!isWalkable(nx, ny)) continue;
      if (closed.has(nk)) continue;

      // Diagonal: check both cardinal tiles are walkable
      if (dirs[d].cost > 1) {
        if (!isWalkable(current.x + dirs[d].dx, current.y) || !isWalkable(current.x, current.y + dirs[d].dy)) {
          continue;
        }
      }

      const tentG = gScore.get(ck) + dirs[d].cost;

      if (!visited.has(nk)) {
        visited.add(nk);
        gScore.set(nk, tentG);
        fScore.set(nk, tentG + heuristic(nx, ny, toX, toY));
        parent.set(nk, { x: current.x, y: current.y });
        openHeap.push({ x: nx, y: ny, f: fScore.get(nk) });
      } else if (tentG < gScore.get(nk)) {
        gScore.set(nk, tentG);
        fScore.set(nk, tentG + heuristic(nx, ny, toX, toY));
        parent.set(nk, { x: current.x, y: current.y });
      }
    }
  }

  return [];

  function reconstruct(tx, ty, parent) {
    const path = [];
    let cx = tx, cy = ty;
    const pk = key(cx, cy);
    while (parent.has(pk)) {
      path.push({ x: cx, y: cy });
      const p = parent.get(pk);
      cx = p.x;
      cy = p.y;
    }
    path.push({ x: fromX, y: fromY });
    return path;
  }

};
