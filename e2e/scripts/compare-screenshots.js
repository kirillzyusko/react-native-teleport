/* eslint-disable no-undef */
const BASE = base;
const TARGET = target;
const DIFF = diff;
const FLOW = MAESTRO_FILENAME;

const response = http.post("http://localhost:3000", {
  body: JSON.stringify({
    base: BASE,
    target: TARGET,
    diff: DIFF,
    flow: FLOW,
  }),
});

output.matches = json(response.body).matches;
