export default async function LeietakerDetaljerPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Leietaker detaljer</h1>
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
        <p className="text-sm text-gray-400">Kommer snart</p>
      </div>
    </div>
  );
}
