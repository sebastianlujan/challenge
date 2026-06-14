import { createApp } from './src/app.ts';
import { initSchema } from './src/db/pool.ts';

const port = process.env.PORT;

await initSchema();

const app = createApp();

app.listen(port, () => {
  console.log(`Listen ${port}`);
});
