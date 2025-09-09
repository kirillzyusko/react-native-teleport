const BASE = base;
const TARGET = target;
const DIFF = diff;

const response = http.post("http://localhost:3000", {
  body: JSON.stringify({
    "base": BASE,
    "target": TARGET,
    "diff": DIFF,
  }),
});

output.matches = json(response.body).matches;
