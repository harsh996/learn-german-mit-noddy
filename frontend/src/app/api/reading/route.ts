import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";
import { getStories } from "@/lib/reading";

// Story text is static per deploy; let the browser reuse it (also makes hover-prefetch effective).
const CACHE = { "Cache-Control": "private, max-age=600" };

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  const stories = getStories();
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const story = stories.find((s) => s.id === id);
    if (!story) return jsonError("Story not found", 404);
    return jsonOk({ story }, { headers: CACHE });
  }
  return jsonOk({ stories: stories.map(({ paragraphs: _p, ...rest }) => rest) }, { headers: CACHE });
}
