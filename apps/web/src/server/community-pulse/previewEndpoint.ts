import { isProtectedFixturePreview } from "./environment.ts";
import { readCommunityPulse } from "./runtime.ts";

export default {
  fetch(request: Request): Promise<Response> {
    return readCommunityPulse(request, isProtectedFixturePreview(process.env), {
      async read() {
        const { fixtureDataSource } = await import("./fixtureDataSource.ts");
        return fixtureDataSource.read();
      }
    });
  }
};
