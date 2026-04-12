export default async function EiendomDetaljerPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Eiendom detaljer</h1>
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-sm text-gray-400">Kommer snart</p>
      </div>
    </div>
  );
}
