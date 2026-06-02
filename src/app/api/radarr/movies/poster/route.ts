import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/server/lib/handler";
import { assertArrType, notFound, positiveInt } from "@/server/lib/api-errors";
import { instanceRepository } from "@/server/repositories/InstanceRepository";
import { createTypedClient } from "@/server/arr/composition";
import { safeImageContentType } from "@/server/lib/image-content-type";

// Poster art is immutable for a given (instance, movie) so cache hard.
// `private` because the stream is auth-gated — a shared proxy must not
// cache + cross-serve it. The instance API key never reaches the
// browser; the stream is same-origin, so the app CSP stays locked.
const POSTER_CACHE = "private, max-age=86400";

export const GET = createApiHandler(
  async (req: NextRequest) => {
    const s = req.nextUrl.searchParams;
    const instanceId = positiveInt(
      s.get("instanceId") ?? undefined,
      "instanceId",
    );
    const mediaId = positiveInt(s.get("mediaId") ?? undefined, "mediaId");

    const instance = await instanceRepository.findById(instanceId);
    if (!instance) throw notFound("Instance not found");
    assertArrType(instance, "radarr");

    const upstream = await createTypedClient(
      instance,
      "radarr",
    ).getPosterStream(mediaId, { signal: req.signal });
    if (!upstream.ok || !upstream.body) throw notFound("Poster not found");

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": safeImageContentType(
          upstream.headers.get("content-type"),
        ),
      },
    });
  },
  { cacheControl: POSTER_CACHE },
);
