import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { PageLayout } from "@shared/components/page-layout";
import { Segmented } from "@shared/ui";
import changelogMd from "@/content/changelog.md?raw";
import roadmapMd from "@/content/roadmap.md?raw";

type Tab = "changelog" | "roadmap";

const TABS = [
  { id: "changelog", label: "Novedades" },
  { id: "roadmap", label: "Próximamente" },
];

export function NovedadesPage() {
  const [tab, setTab] = useState<Tab>("changelog");
  const md = tab === "changelog" ? changelogMd : roadmapMd;

  return (
    <PageLayout width="md" noPadding className="pb-10">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
          Novedades
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Lo que cambió y lo que se viene en PropOS.
        </p>
      </div>

      <Segmented
        items={TABS}
        value={tab}
        onChange={(id) => setTab(id as Tab)}
        className="mb-6"
      />

      <article
        className="px-5 text-[15px] leading-relaxed text-muted-foreground
          [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground
          [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground
          [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground
          [&_p]:mb-4
          [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-faint
          [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:marker:text-faint
          [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline
          [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-foreground
          [&_strong]:font-semibold [&_strong]:text-foreground"
      >
        <ReactMarkdown>{md}</ReactMarkdown>
      </article>
    </PageLayout>
  );
}
