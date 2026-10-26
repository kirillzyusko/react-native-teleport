import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A Recap service disappearing with no contacts is normal. An unknown sender
// alone is also insufficient: its registration can catch up before release.
// Keep sender-matched active-contact cancellations distinct from both cases.
export function analyzeTouchCancellations(text) {
  const devices = new Map();
  const device = (id) => {
    const senderId = `0x${id.replace(/^0x/i, "").toLowerCase()}`;
    if (!devices.has(senderId)) {
      devices.set(senderId, {
        senderId,
        recap: false,
        added: [],
        attached: [],
        unknown: [],
        incomplete: [],
      });
    }
    return devices.get(senderId);
  };

  for (const line of text.split(/\r?\n/)) {
    if (!/\bbackboardd\[/.test(line)) continue;
    const added = line.match(/Service added:.*?\bid:(0x[\da-f]+)/i);
    if (added && /transport:Recap\b/.test(line)) {
      const entry = device(added[1]);
      entry.recap = true;
      entry.added.push(line);
    }
    const attached = line.match(/digitizer attached \(sender ([\da-f]+)\)/i);
    if (attached) device(attached[1]).attached.push(line);
    const unknown = line.match(/unknown senderID:\s*(0x[\da-f]+)/i);
    if (unknown) device(unknown[1]).unknown.push(line);
    const cancelled = line.match(
      /cancel -- digitizer did disappear:.*?senderID:\s*(0x[\da-f]+)/i,
    );
    if (!cancelled) continue;
    const contacts = line.match(/contacts:\s*(?:contacts:\s*)?\[([^\]]*)\]/);
    if (
      contacts &&
      /\bpathIndex:/.test(contacts[1]) &&
      /\btouching\b/.test(contacts[1])
    ) {
      device(cancelled[1]).incomplete.push(line);
    }
  }

  const recap = [...devices.values()].filter((entry) => entry.recap);
  return {
    recapDeviceCount: recap.length,
    unknownSenderCount: recap.filter((entry) => entry.unknown.length).length,
    confirmedRegistrationRaces: recap.filter(
      (entry) => entry.unknown.length && entry.incomplete.length,
    ),
    otherIncompleteGestures: recap.filter(
      (entry) => !entry.unknown.length && entry.incomplete.length,
    ),
  };
}

function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || process.argv.length > 4) {
    throw new Error(
      "Usage: check-ios-touch-cancellations.mjs <simulator.log> [report.json]",
    );
  }
  const report = analyzeTouchCancellations(readFileSync(input, "utf8"));
  if (output) writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.recapDeviceCount) {
    throw new Error(
      "No Recap service records found; input evidence is missing",
    );
  }
  const incomplete = [
    ...report.confirmedRegistrationRaces,
    ...report.otherIncompleteGestures,
  ];
  if (incomplete.length) {
    for (const entry of incomplete) {
      console.error(
        `FAIL: simulator cancelled an active touch from ${entry.senderId}`,
      );
      for (const line of [...entry.unknown, ...entry.incomplete]) {
        console.error(line);
      }
    }
    process.exitCode = 1;
    return;
  }
  console.log(
    `PASS: ${report.recapDeviceCount} Recap devices, no active-contact cancellations ` +
      `(${report.unknownSenderCount} unknown-sender observations without cancellation)`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
