import { isProtectedFixturePreview } from "../src/server/community-pulse/environment.ts";
import { readCommunityPulse } from "../src/server/community-pulse/runtime.ts";

export default {
  fetch(request: Request): Promise<Response> {
    return readCommunityPulse(request, isProtectedFixturePreview(process.env), {
      async read() {
        const { fixtureDataSource } = await import("../src/server/community-pulse/fixtureDataSource.ts");
        return fixtureDataSource.read();
      }
    });
  }
};
