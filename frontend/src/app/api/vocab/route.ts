import { getSession } from "@/lib/auth";
import { jsonOk, unauthorized } from "@/lib/api";
import { buildLookup, getVocab } from "@/lib/vocab";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const entries = getVocab();
  return jsonOk({ entries, lookup: buildLookup(entries) });
}
