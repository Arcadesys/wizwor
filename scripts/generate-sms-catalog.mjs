import { generateConsoleCatalog } from "./catalog-shared/console-catalog-generator.mjs";
import { catalogConfigs } from "./catalog-shared/home-console-configs.mjs";

await generateConsoleCatalog(catalogConfigs.sms);
