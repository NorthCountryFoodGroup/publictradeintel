"use strict";
// Explicitly selected local fictional fixtures only. Import has no effects.
async function main(argv) {
  if (argv[0] !== "--fixture" || !argv[1]) { console.log("Offline fixture only: --fixture <initialized-temp-directory> pending|inspect|approve|deny|result|status"); return 1; }
  const cli = require("../kronos/research-qualification-operator-cli");
  try { cli.parse(argv.slice(2)); } catch { console.log('{"error":"OPERATOR_REFUSED"}'); return 1; }
  const fixture = require("./fixtures/kronos-operator-evidence"), readline = require("node:readline/promises");
  let x, terminal;
  try {
    fixture.assertFixture(argv[1]); terminal = readline.createInterface({input: process.stdin, output: process.stdout});
    // The text models fixture presence only. It is explicitly not operational authentication.
    const ask = prompt => new Promise((resolve, reject) => { const cancel = () => reject(Error("OPERATOR_CANCELLED")); terminal.once("close", cancel); terminal.question(prompt).then(value => { terminal.off("close", cancel); resolve(value); }, reject); });
    const present = await ask("FICTIONAL FIXTURE ONLY. Type FIXTURE OPERATOR PRESENT: ");
    x = fixture.setup(argv[1], {mode: "open-existing", confirm: async v => { console.log(cli.render({action: v.action, reason: v.reason, summary: v.summary})); return ask(v.phrase + "\nRepeat the exact phrase to confirm: "); }});
    const session = await x.provider.authenticate({fixtureUserPresence: present === "FIXTURE OPERATOR PRESENT"});
    return await cli.run({argv: argv.slice(2), controller: x.controller, session, write: v => console.log(v)});
  } catch { console.log('{"error":"OPERATOR_REFUSED"}'); return 1; }
  finally { x?.close(); terminal?.close(); }
}
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }, () => { console.log('{"error":"OPERATOR_REFUSED"}'); process.exitCode = 1; });
module.exports = {main};
