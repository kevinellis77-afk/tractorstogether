'use strict';

const POSITIVE_WORDS = [
  'great','brilliant','excellent','class','quality','love','good','nice','win','winning','won','legend','buzzing','happy','top','solid','decent','cool','ace','up the town','uppa','get in','come on'
];

const NEGATIVE_WORDS = [
  'bad','awful','shit','shite','crap','rubbish','terrible','poor','hate','angry','fuming','worst','bottled','bottlejob','embarrassing','dogshit','useless','problem','worry','concern','injury','injured','loss','lose','losing','fuck','fucking','bollocks'
];

const SOFTENERS = ['maybe','perhaps','not sure','unsure','could','might','if'];
const SARCASM_MARKERS = ['😂','🤣','😅','🙃','sure','yeah right','as if','lol'];

function countMatches(text, phrases) {
  const lower = text.toLowerCase();
  return phrases.reduce((n, p) => n + (lower.includes(p) ? 1 : 0), 0);
}

function scoreSentiment(text) {
  const clean = String(text || '').trim();
  if (!clean) return { sentimentLabel: 'neutral', sentimentScore: 0 };

  const pos = countMatches(clean, POSITIVE_WORDS);
  const neg = countMatches(clean, NEGATIVE_WORDS);
  const soft = countMatches(clean, SOFTENERS);
  const sarcasm = countMatches(clean, SARCASM_MARKERS);

  let score = pos - neg;
  if (soft > 0) score *= 0.8;
  if (sarcasm > 0 && Math.abs(score) <= 1) score *= 0.5;

  const normalized = Math.max(-1, Math.min(1, Number((score / 3).toFixed(3))));
  if (normalized >= 0.15) return { sentimentLabel: 'positive', sentimentScore: normalized };
  if (normalized <= -0.15) return { sentimentLabel: 'negative', sentimentScore: normalized };
  return { sentimentLabel: 'neutral', sentimentScore: normalized };
}

module.exports = { scoreSentiment };
