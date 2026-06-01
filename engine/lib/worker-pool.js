"use strict";

const { Worker } = require("worker_threads");
const path = require("path");
const os = require("os");

const WorkerPool = function (workerPath, options = {}) {

  this.workerPath = path.resolve(__dirname, workerPath);
  this.maxWorkers = options.maxWorkers || Math.max(1, os.cpus().length - 1);
  this.workerData = options.workerData || null;

  this.__workers = [];
  this.__free = [];
  this.__queue = [];
  this.__nextId = 1;

  this._spawn();

};

WorkerPool.prototype.getStats = function () {

  return {
    total: this.__workers.length,
    free: this.__free.length,
    queued: this.__queue.length,
  };

};

WorkerPool.prototype._spawn = function () {

  for (let i = 0; i < this.maxWorkers; i++) {
    const worker = new Worker(this.workerPath, {
      workerData: this.workerData,
    });

    worker.__busy = false;
    worker.__resolver = null;

    worker.on("message", (result) => {
      worker.__busy = false;
      if (worker.__resolver) {
        worker.__resolver(result);
        worker.__resolver = null;
      }
      this.__free.push(worker);
      this._drain();
    });

    worker.on("error", (err) => {
      worker.__busy = false;
      if (worker.__resolver) {
        worker.__resolver(Promise.reject(err));
        worker.__resolver = null;
      }
      this.__free.push(worker);
      this._drain();
    });

    worker.on("exit", (code) => {
      worker.__busy = false;
      if (code !== 0 && worker.__resolver) {
        worker.__resolver(Promise.reject(new Error(`Worker exited with code ${code}`)));
        worker.__resolver = null;
      }
    });

    this.__workers.push(worker);
    this.__free.push(worker);
  }

};

WorkerPool.prototype._drain = function () {

  while (this.__free.length > 0 && this.__queue.length > 0) {
    const worker = this.__free.pop();
    const { task, data, resolver } = this.__queue.shift();
    worker.__busy = true;
    worker.__resolver = resolver;
    worker.postMessage({ task, data });
  }

};

WorkerPool.prototype.exec = function (task, data) {

  return new Promise((resolve, reject) => {
    this.__queue.push({
      task,
      data,
      resolver: (result) => {
        if (result && result.__error) {
          reject(new Error(result.__error));
        } else {
          resolve(result);
        }
      },
    });
    this._drain();
  });

};

WorkerPool.prototype.broadcast = function (task, data) {

  for (const worker of this.__workers) {
    worker.postMessage({ task, data });
  }

};

WorkerPool.prototype.terminate = function () {

  for (const worker of this.__workers) {
    worker.terminate();
  }
  this.__workers = [];
  this.__free = [];
  this.__queue = [];

};

module.exports = WorkerPool;
