import { createApiApp } from '../server/app.ts';

const app = createApiApp({ mountRootAliases: true });

export default app;
