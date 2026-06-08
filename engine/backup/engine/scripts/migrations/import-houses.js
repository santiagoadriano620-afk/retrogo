"use strict";

const fs = require("fs");
const path = require("path");
const { parseStringPromise } = require("xml2js");

const HOUSES_XML = path.resolve(__dirname, "../../data/world/map-house.xml");
const HOUSES_DEF = path.resolve(__dirname, "../../data/houses/definitions.json");
const HOUSES_DIR = path.resolve(__dirname, "../../data/houses/definitions");

async function main() {
  // Parse XML
  const xml = fs.readFileSync(HOUSES_XML, "utf8");
  const parsed = await parseStringPromise(xml);
  const entries = parsed.houses.house;

  // Delete all existing house item files
  if (fs.existsSync(HOUSES_DIR)) {
    const existingFiles = fs.readdirSync(HOUSES_DIR).filter(f => f.endsWith(".json"));
    for (const file of existingFiles) {
      fs.unlinkSync(path.join(HOUSES_DIR, file));
    }
  } else {
    fs.mkdirSync(HOUSES_DIR, { recursive: true });
  }

  // Build new definitions from XML (all houses start fresh, no owner)
  let definitions = {};

  for (let entry of entries) {
    let id = Number(entry.$.houseid);

    definitions[String(id)] = {
      "owner": "",
      "rent": Number(entry.$.rent),
      "exit": {
        "x": Number(entry.$.entryx),
        "y": Number(entry.$.entryy),
        "z": Number(entry.$.entryz)
      },
      "invited": [],
      "name": entry.$.name,
      "guildhall": entry.$.guildhall === "true",
      "rentDueDate": null,
      "rentPending": false,
      "rentPrice": 0,
      "sellPrice": 0,
      "forRent": false,
      "forSale": false,
      "boughtOutright": false,
      "finalWarningSent": false,
      "renterName": "",
      "rentStartDate": null,
      "ownerReclaimDate": null
    };

    // Create empty items file for each house
    fs.writeFileSync(path.join(HOUSES_DIR, id + ".json"), "[]");
  }

  // Write definitions.json
  fs.writeFileSync(HOUSES_DEF, JSON.stringify(definitions, null, 2));

  console.log("Imported %d houses from map-house.xml. All houses reset to unowned state.", entries.length);
}

main().catch(console.error);
