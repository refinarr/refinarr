import { describe, test, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPoster } from "@/app/api/radarr/movies/poster/route";
import { POST as createInstance } from "@/app/api/instances/route";
import { mswServer, http, HttpResponse } from "@/test/msw";

const ctxNone = { params: Promise.resolve({}) };
const baseUrl = "http://192.168.1.10:7878";

async function makeInstance(
  type: "radarr" | "sonarr" = "radarr",
): Promise<number> {
  const port = type === "radarr" ? 7878 : 8989;
  const res = await createInstance(
    new NextRequest("http://localhost/api/instances", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type,
        name: type,
        url: `http://192.168.1.10:${port}`,
        apiKey: "abcd1234abcd1234abcd1234abcd1234",
      }),
    }),
    ctxNone,
  );
  return (await res.json()).id as number;
}

function posterReq(instanceId: number, mediaId: number): NextRequest {
  return new NextRequest(
    `http://localhost/api/radarr/movies/poster?instanceId=${instanceId}&mediaId=${mediaId}`,
  );
}

describe("GET /api/radarr/movies/poster", () => {
  test("streams the upstream poster bytes + content-type behind the proxy", async () => {
    const instanceId = await makeInstance();
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    mswServer.use(
      http.get(`${baseUrl}/api/v3/mediacover/5/poster.jpg`, ({ request }) => {
        // The instance API key travels server→*arr only, never to the browser.
        expect(request.headers.get("X-Api-Key")).toBe(
          "abcd1234abcd1234abcd1234abcd1234",
        );
        return HttpResponse.arrayBuffer(bytes.buffer, {
          headers: { "content-type": "image/jpeg" },
        });
      }),
    );

    const res = await getPoster(posterReq(instanceId, 5));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, max-age=86400");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  test("returns 404 when the upstream has no poster", async () => {
    const instanceId = await makeInstance();
    mswServer.use(
      http.get(
        `${baseUrl}/api/v3/mediacover/9/poster.jpg`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const res = await getPoster(posterReq(instanceId, 9));
    expect(res.status).toBe(404);
  });

  test("rejects a sonarr instance with 400 (arr-type mismatch)", async () => {
    const sonarrId = await makeInstance("sonarr");
    const res = await getPoster(posterReq(sonarrId, 5));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("ARR_TYPE_MISMATCH");
  });

  test("returns 404 for an unknown instance", async () => {
    const res = await getPoster(posterReq(99999, 5));
    expect(res.status).toBe(404);
  });

  test("400 on a non-positive mediaId", async () => {
    const instanceId = await makeInstance();
    const res = await getPoster(posterReq(instanceId, 0));
    expect(res.status).toBe(400);
  });
});
