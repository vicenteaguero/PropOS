import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PRIVACY_POLICY_MD } from "@features/legal/lib/privacy-policy-text";
import { PublicFooter } from "@shared/components/public-footer/public-footer";

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
          >
            <ArrowLeft className="size-4" strokeWidth={1.8} />
            Inicio
          </Link>
          <Link
            to="/derechos"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Tus derechos
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <article
          className="text-[15px] leading-relaxed text-muted-foreground
            [&_h1]:mb-6 [&_h1]:text-[28px] [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:tracking-tight [&_h1]:text-foreground
            [&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground
            [&_p]:mb-4
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:marker:text-faint
            [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5 [&_ol]:marker:text-faint
            [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline
            [&_strong]:font-semibold [&_strong]:text-foreground
            [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_code]:text-foreground
            [&_blockquote]:my-5 [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-border [&_blockquote]:bg-card [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-[13px] [&_blockquote_p]:mb-0
            [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px]
            [&_th]:border-b [&_th]:border-line-strong [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground
            [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{PRIVACY_POLICY_MD}</ReactMarkdown>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
