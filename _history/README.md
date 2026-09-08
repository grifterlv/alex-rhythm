# Original Git history

The source files in this repository were imported from the deployed Alex Rhythm site.
The original nine Git commits are preserved, unchanged, in `alex-rhythm.bundle`.
This import starts a new GitHub commit lineage; the original commits are inside the bundle, not yet ancestors of this branch.

Original branch: `main`
Original HEAD: `9d598e3c4c46edab94933908a0552604c9c9387c`
Bundle SHA-256: `c1e55585542aca12abc1b9c8ad4ce891e75a26a71779f61cfabac770da809e5d`

## Inspect or restore the original history

Download `alex-rhythm.bundle`, then run:

```sh
git clone alex-rhythm.bundle alex-rhythm-original
cd alex-rhythm-original
git log --oneline
```

All nine original commits, authors, dates, messages, source trees, and commit IDs are retained. The bundle does not include production database contents, local credentials, or the site's Git remote configuration.

## Publish the original history as a separate branch

From the restored clone, with GitHub authentication configured:

```sh
git remote add github https://github.com/grifterlv/alex-rhythm.git
git push github main:refs/heads/original-site-history
```

This publishes the original nine commits without replacing or rewriting the GitHub main branch.

To integrate both histories into main later, use a normal merge on a feature branch, resolve the README and source differences deliberately, and open a pull request. Do not force-push over later work.
