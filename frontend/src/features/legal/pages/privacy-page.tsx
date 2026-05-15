import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { PRIVACY_POLICY_MD } from "@features/legal/lib/privacy-policy-text";
import { PublicFooter } from "@shared/components/public-footer/public-footer";

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Inicio
          </Link>
          <Link to="/derechos" className="text-sm text-muted-foreground hover:underline">
            Tus derechos
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-table:text-foreground prose-th:text-foreground prose-td:text-foreground prose-a:text-primary">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{PRIVACY_POLICY_MD}</ReactMarkdown>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
