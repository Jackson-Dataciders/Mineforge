import { notFound } from "next/navigation";
import { RecipeChangeEditor } from "@/components/modpacks/recipe-change-editor";
import { requireUser } from "@/server/session";
import { getStorage, loadModpacks } from "@/storage";
import { getRecipeChange } from "@/storage/recipe-changes";

export default async function RecipeChangePage({
  params,
}: PageProps<"/modpacks/[packId]/recipe-changes/[changeId]">) {
  await requireUser();
  const { packId, changeId } = await params;
  if (!(await loadModpacks()).some((p) => p.data.id === packId)) notFound();
  const change = await getRecipeChange(await getStorage(), packId, changeId);
  if (!change) notFound();
  return (
    <RecipeChangeEditor
      key={change.sha}
      packId={packId}
      existing={{ change: change.data, sha: change.sha }}
    />
  );
}
