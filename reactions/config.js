const EMOJI = {
  brilliant: "<:Brilliant:1574421479636865196>",
  great: "<:great:1574438575481819156>",
  best: "<:best:1574439751157551104>",
  excellent: "<:excellent:1574436379893436436>",
  good: "<:good:1574437173397291119>",
  book: "<:bookmove:1574440954059030648>",
  inaccuracy: "<:inaccuracy:1574437933547786310>",
  mistake: "<:mistake:1574439150420238516>",
  miss: "<:miss:1574435829206745240>",
  blunder: "<:Blunder:1574425714839654511>",
};

// Weights for the random fallback (higher = more common).
const WEIGHTS = {
  book: 18,
  good: 18,
  excellent: 16,
  best: 14,
  inaccuracy: 8,
  mistake: 6,
  great: 5,
  miss: 5,
  brilliant: 2,
  blunder: 2,
};

// Chance (0 to 1) that an otherwise unmatched message gets "brilliant".
const BRILLIANT_CHANCE = 0.02;

// Words that trigger a blunder reaction. Edit freely.
const TOXIC_WORDS = ["idiot", "stupid", "trash", "noob", "dumb"];

module.exports = { EMOJI, WEIGHTS, BRILLIANT_CHANCE, TOXIC_WORDS };
