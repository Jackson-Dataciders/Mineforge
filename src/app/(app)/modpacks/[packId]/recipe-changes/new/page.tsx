import { notFound } from "next/navigation";
import { RecipeChangeEditor } from "@/components/modpacks/recipe-change-editor";
import { requireUser } from "@/server/session";
import { loadModpacks } from "@/storage";

export default async function NewRecipeChangePage({
  params,
}: PageProps<"/modpacks/[packId]/recipe-changes/new">) {
  await requireUser();
  const { packId } = await params;
  if (!(await loadModpacks()).some((p) => p.data.id === packId)) notFound();
  return <RecipeChangeEditor packId={packId} />;
}
