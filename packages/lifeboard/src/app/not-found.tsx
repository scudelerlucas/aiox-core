import Link from "next/link";

/**
 * Página 404 em português (antes era a página em inglês do Next).
 * Endereço errado nunca é um beco: sempre tem a porta de volta.
 */
export default function NaoEncontrada(): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-bone-50">
        Essa página não existe
      </h1>
      <p className="mt-3 text-sm text-bone-300">
        O endereço que você abriu não corresponde a nenhuma tela deste painel.
      </p>
      <Link
        href="/frentes"
        className="mt-5 inline-flex min-h-[44px] items-center rounded-md border border-navy-700 bg-navy-850 px-4 text-sm text-bone-100 hover:border-gold-600"
      >
        voltar para os assuntos
      </Link>
    </main>
  );
}
