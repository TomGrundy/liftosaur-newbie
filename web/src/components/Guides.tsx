export function HowToAdd() {
  return (
    <section className="guide" aria-labelledby="how-heading">
      <h2 id="how-heading">How to add a program to Liftosaur</h2>
      <h3>Option 1: copy and paste</h3>
      <ol>
        <li>Press <strong>Copy script</strong> on a program above.</li>
        <li>
          In the Liftosaur app, or on{" "}
          <a href="https://www.liftosaur.com/planner" target="_blank" rel="noreferrer">liftosaur.com/planner</a>, create a new program.
        </li>
        <li>
          In the program editor, switch to the full-text (plain text) mode. The exact button label may differ between app versions.
        </li>
        <li>Paste the script over the existing text, then save the program and start your first workout.</li>
      </ol>
      <h3>Option 2: upload with the CLI</h3>
      <p>Needs Liftosaur Premium. Create an API key in the app under Me → API Keys (menu names may vary), then:</p>
      <pre className="plain-pre"><code>{`export LIFTOSAUR_API_KEY=your-key
npm run cli -- upload programs/<id>.json`}</code></pre>
    </section>
  );
}

export function GenerateMore() {
  return (
    <section className="guide" aria-labelledby="gen-heading">
      <h2 id="gen-heading">Generate more programs</h2>
      <p>Can't find one that fits? Generate your own for your equipment, intensity, session length and days per week.</p>
      <h3>GitHub Action</h3>
      <p>
        In the repository go to <strong>Actions → Generate program → Run workflow</strong>, choose your equipment, intensity, session
        length and days per week, and run it. The new program is committed and the site rebuilds with it.
      </p>
      <h3>Command line</h3>
      <pre className="plain-pre"><code>npm run cli -- generate</code></pre>
      <p className="muted">Follow the prompts, or run <code>npm run cli -- generate --help</code> for flags.</p>
    </section>
  );
}
