import { createApp } from './app.js';

const { app, config } = createApp();

app.listen(config.port, () => {
  console.log(`Smart Parking Auth API listening on http://localhost:${config.port}`);
});
