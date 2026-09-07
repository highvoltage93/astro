import { AstroWorkbench } from "@/components/astro-workbench";

export default function WorkspacePage({ searchParams }: { searchParams: { chartId?: string; forecastId?: string } }) {
  const workspaceKey = searchParams.forecastId
    ? `forecast:${searchParams.forecastId}`
    : "natal";
  return <AstroWorkbench key={workspaceKey} />;
}
