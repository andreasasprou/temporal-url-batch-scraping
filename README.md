# Hello World

This is the default project that is scaffolded out when you run `npx @temporalio/create@latest ./myfolder`.

The [Hello World Tutorial](https://docs.temporal.io/docs/typescript/hello-world/) walks through the code in this sample.

### Running this sample

1. Make sure Temporal Server is running locally (see the [quick install guide](https://docs.temporal.io/docs/server/quick-install/)).
1. `npm install` to install dependencies.
1. `npm run start.watch` to start the Worker.
1. In another shell, `npm run workflow` to run the Workflow Client.

The client should log the Workflow ID that is started, and you should see it reflected in Temporal Web UI.

Optionally, you can also uncomment the `await handle.result()`, rerun, and see the client script return:

```bash
Hello, Temporal!
```

### Ensuring batches with gaps are filled after removing a scraped url from the batch

Initially, our batch id assigner doesn't care about past batches, it assumes that all batches before `currentBatchId` are completely full.
This becomes problematic when we want to stop scraping a url. If we remove a url from a batch url list, we'll now have a gap and start to become inefficient in our batching (breaking the rule below): 
```
number of activities run ~= (number of urls) / MAX_BATCH_SIZE
```

To overcome this, we will record the batches with gaps in the batch id assigner and prioritise batches with gaps when assigning new urls to a batch.

### Upgrading/Versioning

- Changing `SCRAPE_FREQUENCY` doesn't require patching as X

### TODOs

- Cleanup with continueAsNew ✅
  - Heuristic estimation guidelines for continueAsNew & event history
- Activity implementation
- Retry failed scrapes via activity heartbeating
- Re-assign batch gaps after removing a url from a batch ✅
- What to do if you terminate the batch id singleton
- How to handle failures inside batch id assigner singleton such that it doesn't crash it (e.g. via `handler.signal` etc)