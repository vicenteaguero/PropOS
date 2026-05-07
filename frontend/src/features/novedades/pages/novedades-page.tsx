import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PageLayout } from "@shared/components/page-layout";
import { PageHeader } from "@shared/components/page-header";
import { Button } from "@/components/ui/button";
import changelogMd from "@/content/changelog.md?raw";
import roadmapMd from "@/content/roadmap.md?raw";

type Tab = "changelog" | "roadmap";

export function NovedadesPage() {
  const [tab, setTab] = useState<Tab>("changelog");
  const md = tab === "changelog" ? changelogMd : roadmapMd;

  return (
    <PageLayout width="md">
      <PageHeader title="Novedades" description="Lo que cambió y lo que se viene en PropOS." />

      <div className="mb-4 flex gap-2">
        <Button
          variant={tab === "changelog" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("changelog")}
        >
          Novedades
        </Button>
        <Button
          variant={tab === "roadmap" ? "default" : "outline"}
          size="sm"
          onClick={() => setTab("roadmap")}
        >
          Próximamente
        </Button>
      </div>

      <article
        className="space-y-3 text-sm leading-relaxed text-foreground
          [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-semibold
          [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1
          [&_p]:text-muted-foreground
          [&_strong]:text-foreground"
      >
        <ReactMarkdown>{md}</ReactMarkdown>
      </article>
    </PageLayout>
  );
}
