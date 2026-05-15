import { Link } from "react-router-dom";

const PRIVACY_EMAIL = "privacidad@propos.cl";

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-background/50 py-6 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-2 px-4">
        <Link to="/privacidad" className="hover:underline">
          Política de privacidad
        </Link>
        <span aria-hidden>·</span>
        <Link to="/derechos" className="hover:underline">
          Tus derechos
        </Link>
        <span aria-hidden>·</span>
        <a href={`mailto:${PRIVACY_EMAIL}`} className="hover:underline">
          {PRIVACY_EMAIL}
        </a>
      </div>
    </footer>
  );
}
