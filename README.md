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


### Upgrading/Versioning

- Changing `SCRAPE_FREQUENCY` doesn't require patching as X

### TODOs

- Cleanup with continueAsNew
- Activity implementation
- Retry failed scrapes via activity heartbeating
- Re-balancing after removing a url from a batch
- Error handling in stopScrapingUrl
- What to do if you terminate the batch id singleton
- How to handle failures inside batch id assigner singleton such that it doesn't crash it (e.g. via `handler.signal` etc)