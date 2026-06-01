"use strict";

const express = require("express");
const router = express.Router();
const { getItemSprite } = require("../lib/sprite-extractor");

router.get("/:id", async function (req, res) {
  const itemId = parseInt(req.params.id, 10);
  if (isNaN(itemId) || itemId < 1) {
    return res.status(400).json({ error: "Invalid item ID" });
  }

  try {
    const png = await getItemSprite(itemId);
    if (!png) {
      return res.status(404).json({ error: "Sprite not found for item " + itemId });
    }
    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(png);
  } catch (err) {
    console.error("[sprites] Error serving sprite for item", itemId, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
