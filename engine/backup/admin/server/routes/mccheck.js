"use strict";

const http = require("http");
const https = require("https");
const db = require("../lib/database");
const bridge = require("../lib/game-bridge");

const router = require("express").Router();

const IP_CACHE = {};
const IP_CACHE_TTL = 3600000;

function lookupIpReputation(ip) {
  return new Promise(function (resolve) {
    if (IP_CACHE[ip] && Date.now() - IP_CACHE[ip].ts < IP_CACHE_TTL) {
      return resolve(IP_CACHE[ip].data);
    }
    if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost") {
      return resolve(null);
    }
    var req = https.get("http://ip-api.com/json/" + ip + "?fields=status,proxy,hosting,isp,org,country,city", function (res) {
      var data = "";
      res.on("data", function (c) { data += c; });
      res.on("end", function () {
        try {
          var result = JSON.parse(data);
          if (result.status === "success") {
            IP_CACHE[ip] = { data: result, ts: Date.now() };
            resolve(result);
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", function () { resolve(null); });
    req.setTimeout(3000, function () { req.destroy(); resolve(null); });
  });
}

router.get("/scan", async function (req, res) {
  try {
    var accounts = db.getAllAccounts();
    var status = await bridge.getStatus();
    var onlinePlayers = (status && status.players) || [];

    var engineError = null;
    if (status && (status.error || status.code)) {
      engineError = status.error + (status.code ? " (" + status.code + ")" : "");
    }

    var onlineByIp = {};
    for (var i = 0; i < onlinePlayers.length; i++) {
      var op = onlinePlayers[i];
      if (!op.ip) continue;
      if (!onlineByIp[op.ip]) onlineByIp[op.ip] = [];
      onlineByIp[op.ip].push(op);
    }

    var regByIp = {};
    for (var a = 0; a < accounts.length; a++) {
      var acc = accounts[a];
      var regIp = acc.regIp || acc.lastIp;
      if (!regIp) continue;
      if (!regByIp[regIp]) regByIp[regIp] = [];
      regByIp[regIp].push(acc);
    }

    var allIps = new Set();
    Object.keys(onlineByIp).forEach(function (ip) { allIps.add(ip); });
    Object.keys(regByIp).forEach(function (ip) { allIps.add(ip); });

    var clusters = [];
    var ipList = Array.from(allIps);

    for (var j = 0; j < ipList.length; j++) {
      var ip = ipList[j];
      var onlineHere = onlineByIp[ip] || [];
      var regHere = regByIp[ip] || [];

      if (onlineHere.length < 2 && regHere.length < 2) continue;

      var clusterAccounts = [];
      for (var k = 0; k < regHere.length; k++) {
        var ra = regHere[k];
        var onlineChars = [];
        for (var m = 0; m < onlineHere.length; m++) {
          var oh = onlineHere[m];
          var accountChars = ra.chars || [];
          if (accountChars.indexOf(oh.name) !== -1) {
            onlineChars.push(oh.name);
          }
        }
        clusterAccounts.push({
          accountId: ra.accountId,
          accountName: ra.accountName,
          chars: ra.chars,
          onlineChars: onlineChars
        });
      }

      var onlineMissing = [];
      for (var n = 0; n < onlineHere.length; n++) {
        var oh2 = onlineHere[n];
        var found = false;
        for (var p = 0; p < clusterAccounts.length; p++) {
          if ((clusterAccounts[p].chars || []).indexOf(oh2.name) !== -1) {
            found = true;
            break;
          }
        }
        if (!found) {
          onlineMissing.push(oh2);
        }
      }

      var reputation = await lookupIpReputation(ip);
      var flag = null;
      if (reputation && (reputation.proxy || reputation.hosting)) {
        flag = "vpn";
      } else if (onlineHere.length >= 2) {
        flag = "shared_online";
      } else if (regHere.length >= 2) {
        flag = "shared_reg";
      }

      clusters.push({
        ip: ip,
        flag: flag,
        isp: reputation ? (reputation.isp || null) : null,
        org: reputation ? (reputation.org || null) : null,
        country: reputation ? (reputation.country || null) : null,
        city: reputation ? (reputation.city || null) : null,
        online: onlineHere.map(function (o) {
          return { name: o.name, level: o.level, vocation: o.vocation };
        }),
        missingAccounts: onlineMissing.map(function (o) {
          return { name: o.name, level: o.level };
        }),
        accounts: clusterAccounts
      });
    }

    clusters.sort(function (a, b) {
      var order = { vpn: 0, shared_online: 1, shared_reg: 2 };
      var fa = order[a.flag] || 99;
      var fb = order[b.flag] || 99;
      if (fa !== fb) return fa - fb;
      return (b.online.length + b.accounts.length) - (a.online.length + a.accounts.length);
    });

    var vpnCount = 0;
    var sharedOnline = 0;
    var sharedReg = 0;
    for (var q = 0; q < clusters.length; q++) {
      if (clusters[q].flag === "vpn") vpnCount++;
      if (clusters[q].flag === "shared_online") sharedOnline++;
      if (clusters[q].flag === "shared_reg") sharedReg++;
    }

    res.json({
      clusters: clusters,
      engineError: engineError,
      summary: {
        totalClusters: clusters.length,
        vpnDetected: vpnCount,
        sharedOnlineIps: sharedOnline,
        sharedRegIps: sharedReg,
        totalOnline: onlinePlayers.length
      }
    });
  } catch (e) {
    console.error("MC Check error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
