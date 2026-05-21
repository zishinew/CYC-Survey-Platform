const text = "This is a test of the definition feature";
const definitions = [ { term: "definition", definition: "the meaning of a word" } ];

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sortedDefs = [...definitions].sort((a, b) => b.term.length - a.term.length);
const pattern = new RegExp(`\\b(${sortedDefs.map(d => escapeRegExp(d.term)).join('|')})\\b`, 'gi');

console.log("Pattern:", pattern);
const parts = text.split(pattern);
console.log("Parts:", parts);
