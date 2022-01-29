# Temporal URL Scraper

This repo implements a periodic URL scraper in Temporal.

URL scraping could be implemented with cron workflows with a 1-1 mapping between a URL and an activity. This becomes problematic as you scale the number of URLs as you'll be incurring the expensive cost of running an activity for every new url you add, every scrape interval.

To overcome these performance issues, we'll define the following goal:

> Batching URLs so an activity can process multiple URLs at once, i.e. the number of activities executed per interval should approximately equal (number of urls) / MAX_BATCH_SIZE

### Running this sample

1. Make sure Temporal Server is running locally (see the [quick install guide](https://docs.temporal.io/docs/server/quick-install/)).
2. `npm install` to install dependencies.
3. `npm run start.watch` to start the Worker.
4. Open `client.ts` and enter a url to scrape
5. In another shell, `npm run workflow` to run the Workflow Client.

The client should log the Workflow ID that is started, and you should see it reflected in Temporal Web UI.

You'll see a chain of logs that trace the flow of a new scraped url. After a few seconds, you should find that it attempts to scrape the url every `SCRAPE_INTERVAL`.

### Ensuring batches with gaps are filled after removing a scraped url from the batch

Initially, our batch id assigner doesn't care about past batches, it assumes that all batches before `currentBatchId` are completely full.
This becomes problematic when we want to stop scraping a url. If we remove a url from a batch url list, we'll now have a gap and start to become inefficient in our batching (breaking the goal at the top of this doc).

To overcome this issue, we will record the batches with gaps in the batch id assigner and prioritise batches with gaps when assigning new urls to a batch.

### Upgrading/Versioning

- Changing `SCRAPE_FREQUENCY` doesn't require patching as X

### TODOs

- [x] Cleanup with continueAsNew
- [ ] Heuristic estimation guidelines for continueAsNew & event history
- [ ] Activity implementation
- [ ] Retry failed scrapes via activity heartbeating
- [x] Re-assign batch gaps after removing a url from a batch
- [ ] What to do if you terminate the batch id singleton
- [ ] How to handle failures inside batch id assigner singleton such that it doesn't crash it (e.g. via `handler.signal` etc)

### Overview

https://app.excalidraw.com/l/60O4zdIqdtq/6iZauXuE2DA