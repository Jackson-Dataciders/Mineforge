import { redirect } from "next/navigation";
import { requireUser } from "@/server/session";

export default async function HomePage() {
  await requireUser();
  redirect("/designer");
}
