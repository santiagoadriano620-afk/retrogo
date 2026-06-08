"use strict";

const FORBIDDEN_NAMES = [
  // Admin / staff
  "admin", "administrator", "adm", "cm", "gamemaster", "gm",
  "moderator", "mod", "tutor", "seniortutor", "senior",
  "cipsoft", "cip",

  // Profanity (Portuguese)
  "caralho", "porra", "merda", "bosta", "cusao", "cusão",
  "puta", "puto", "putinha", "putinho", "vadia", "piranha",
  "arrombado", "arrombada", "babaca", "fdp",
  "filhodaputa", "filhadaputa", "filhoduma", "vaffanculo",

  // Profanity (English)
  "fuck", "fucker", "fucking", "shit", "shitter",
  "asshole", "bitch", "bastard", "dick", "cock",
  "cunt", "motherfucker",

  // Racial slurs
  "macaco", "negrinha", "criolo", "crioulo", "denegrido",
  "branquelo", "judeu", "nazista", "hitler", "kkk",
  "nigger", "nigga", "spic", "chink", "negrama",
  "negroid",
];

function isNameAllowed(name) {
  let lower = name.toLowerCase();
  for (let i = 0; i < FORBIDDEN_NAMES.length; i++) {
    if (lower.includes(FORBIDDEN_NAMES[i])) {
      return false;
    }
  }
  return true;
}

module.exports = { isNameAllowed, FORBIDDEN_NAMES };
